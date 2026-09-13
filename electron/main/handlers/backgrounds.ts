import { app, ipcMain, dialog, nativeImage } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync, writeFileSync } from 'fs'
import { join, extname, basename } from 'path'

// A library of projector background images kept on disk, so choosing a new one
// never discards the old. Files live in userData rather than localStorage —
// a handful of full-resolution photos as base64 would blow the ~5MB web storage
// quota, and the operator expects these to survive reinstalls of the renderer.

const DIR_NAME = 'backgrounds'
const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp']

function dir(): string {
  const d = join(app.getPath('userData'), DIR_NAME)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

function mimeFor(ext: string): string {
  const e = ext.toLowerCase()
  if (e === '.png') return 'image/png'
  if (e === '.webp') return 'image/webp'
  return 'image/jpeg'
}

/** Full-size image as a data URL — what actually gets shown on the projector. */
function fullDataUrl(file: string): string | null {
  const img = nativeImage.createFromPath(file)
  if (img.isEmpty()) return null
  // Re-encode rather than read raw bytes so an odd file cannot poison the theme.
  return mimeFor(extname(file)) === 'image/png' ? img.toDataURL() : img.toDataURL()
}

/** Small preview for the settings grid — keeps the IPC payload sane. */
function thumbDataUrl(file: string): string | null {
  const img = nativeImage.createFromPath(file)
  if (img.isEmpty()) return null
  return img.resize({ width: 200, quality: 'good' }).toDataURL()
}

interface BgEntry { id: string; name: string; thumb: string; addedAt: number }

function listEntries(): BgEntry[] {
  return readdirSync(dir())
    .filter((f) => ALLOWED.includes(extname(f).toLowerCase()))
    .map((f) => {
      const full = join(dir(), f)
      const thumb = thumbDataUrl(full)
      if (!thumb) return null
      return { id: f, name: basename(f).replace(/^\d+-/, ''), thumb, addedAt: statSync(full).mtimeMs }
    })
    .filter((e): e is BgEntry => e !== null)
    .sort((a, b) => b.addedAt - a.addedAt)
}

export function setupBackgroundHandlers(): void {
  ipcMain.handle('backgrounds:list', () => listEntries())

  ipcMain.handle('backgrounds:add', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Choose Background Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile'],
    })
    if (canceled || !filePaths[0]) return null

    const src = filePaths[0]
    const ext = extname(src).toLowerCase()
    if (!ALLOWED.includes(ext)) return null

    // Prefix with a timestamp so re-adding a file of the same name keeps both.
    const id = `${Date.now()}-${basename(src)}`
    copyFileSync(src, join(dir(), id))

    const dataUrl = fullDataUrl(join(dir(), id))
    if (!dataUrl) { try { unlinkSync(join(dir(), id)) } catch { /* ignore */ } return null }
    return { id, dataUrl, library: listEntries() }
  })

  ipcMain.handle('backgrounds:get', (_e, { id }: { id: string }) => {
    const file = join(dir(), id)
    if (!existsSync(file)) return null
    return { id, dataUrl: fullDataUrl(file) }
  })

  // Adopts a background that predates the library (set when the theme only held a
  // raw data URL) so the operator's existing image shows up alongside new ones
  // instead of silently being the one picture they cannot get back.
  ipcMain.handle('backgrounds:import', (_e, { dataUrl }: { dataUrl: string }) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    if (img.isEmpty()) return null
    const id = `${Date.now()}-imported.png`
    writeFileSync(join(dir(), id), img.toPNG())
    return { id, library: listEntries() }
  })

  ipcMain.handle('backgrounds:remove', (_e, { id }: { id: string }) => {
    const file = join(dir(), id)
    try { if (existsSync(file)) unlinkSync(file) } catch { /* ignore */ }
    return listEntries()
  })
}
