import { app, ipcMain, shell, dialog, BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { buildXml } from './vmix-output'

// File-based vMix data source, the same shape BibleShow uses: the app keeps a
// folder on disk in sync with whatever is on the projector, and vMix reads the
// files directly. No network, no ports — the right choice when vMix runs on this
// same machine. The HTTP endpoint on :7788 remains for the two-machine case.
//
//   <output>/data1.xml    the current verse/lyrics as XML   (vMix data source)
//   <output>/image1.png   the projector, rendered           (vMix image source)

const XML_FILE = 'data1.xml'
const IMG_FILE = 'image1.png'

let outputDir = ''
let enabled = false
let getProjector: (() => BrowserWindow | null) | null = null

// Serialises writes so a burst of display changes can't interleave, and collapses
// them so holding an arrow key doesn't queue up a hundred screen captures.
let writing = false
let pending = false

export function getOutputDir(): string {
  return outputDir
}

export function isFileOutputRunning(): boolean {
  return enabled
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// Write via a temp file then rename. vMix polls these files on an interval and
// will happily read one mid-write, showing a truncated verse; rename is atomic on
// both Windows and macOS, so vMix only ever sees a complete file.
function writeAtomic(file: string, data: Buffer | string): void {
  const tmp = file + '.tmp'
  writeFileSync(tmp, data)
  renameSync(tmp, file)
}

async function flush(): Promise<void> {
  if (writing) { pending = true; return }
  writing = true

  try {
    ensureDir(outputDir)
    writeAtomic(join(outputDir, XML_FILE), buildXml() + '\n')

    const win = getProjector?.()
    if (win && !win.isDestroyed()) {
      // Let the projector paint the new content before grabbing it, otherwise the
      // capture is one verse behind.
      await new Promise((r) => setTimeout(r, 180))
      const img = await win.webContents.capturePage()
      if (!img.isEmpty()) writeAtomic(join(outputDir, IMG_FILE), img.toPNG())
    }
  } catch (err) {
    // Never let an output failure take down a service — a locked file or a
    // disconnected drive should degrade to "graphics stop updating", not a crash.
    console.error('[file-output] write failed:', err)
  } finally {
    writing = false
    if (pending) { pending = false; void flush() }
  }
}

/** Called on every display change. No-op unless file output is switched on. */
export function writeFileOutput(): void {
  if (!enabled || !outputDir) return
  void flush()
}

export function setupFileOutputHandlers(projectorAccessor: () => BrowserWindow | null): void {
  getProjector = projectorAccessor
  outputDir = join(app.getPath('documents'), 'ICGC Live Word', 'Output')

  ipcMain.handle('fileout:status', () => ({ running: enabled, dir: outputDir }))

  ipcMain.handle('fileout:start', () => {
    ensureDir(outputDir)
    enabled = true
    void flush() // write immediately so vMix has files to bind against
    return { running: true, dir: outputDir }
  })

  ipcMain.handle('fileout:stop', () => {
    enabled = false
    return { running: false, dir: outputDir }
  })

  ipcMain.handle('fileout:choose-dir', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Choose vMix Output Folder',
      defaultPath: outputDir,
      properties: ['openDirectory', 'createDirectory'],
    })
    if (canceled || !filePaths[0]) return { running: enabled, dir: outputDir }
    outputDir = filePaths[0]
    if (enabled) void flush()
    return { running: enabled, dir: outputDir }
  })

  ipcMain.handle('fileout:reveal', () => {
    ensureDir(outputDir)
    shell.openPath(outputDir)
  })
}
