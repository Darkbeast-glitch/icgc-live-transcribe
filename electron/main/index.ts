import { app, BrowserWindow, ipcMain, shell, systemPreferences, dialog } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { setupDatabase } from './database'
import { setupBibleHandlers } from './handlers/bible'
import { setupSongHandlers } from './handlers/songs'
import { setupExportHandlers } from './handlers/export'
import { setupSemanticHandlers } from './handlers/semantic'
import { setupWhisperHandlers } from './handlers/whisper'

let operatorWindow: BrowserWindow | null = null
let projectorWindow: BrowserWindow | null = null

function createOperatorWindow(): void {
  operatorWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ICGC-FMT  — Operator Console',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  operatorWindow.on('ready-to-show', () => {
    operatorWindow!.show()
  })

  // Grant microphone permission
  operatorWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === 'media')
    }
  )
  operatorWindow.webContents.session.setPermissionCheckHandler(
    (_webContents, permission) => permission === 'media'
  )

  operatorWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    operatorWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/index.html')
  } else {
    operatorWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createProjectorWindow(): void {
  projectorWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 450,
    title: 'ICGC FMT Church Scrip — Projector',
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/projector.js'),
      sandbox: false
    }
  })

  projectorWindow.on('ready-to-show', () => {
    projectorWindow!.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    projectorWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/projector.html')
  } else {
    projectorWindow.loadFile(join(__dirname, '../renderer/projector.html'))
  }
}

// IPC: Send display content from operator → projector
ipcMain.on('display:show-verse', (_event, data) => {
  projectorWindow?.webContents.send('display:show-verse', data)
})

ipcMain.on('display:show-lyrics', (_event, data) => {
  projectorWindow?.webContents.send('display:show-lyrics', data)
})

ipcMain.on('display:clear', () => {
  projectorWindow?.webContents.send('display:clear')
})

ipcMain.on('projector:toggle-fullscreen', () => {
  if (projectorWindow) {
    projectorWindow.setFullScreen(!projectorWindow.isFullScreen())
  }
})

ipcMain.on('display:set-theme', (_event, theme) => {
  projectorWindow?.webContents.send('display:set-theme', theme)
})

ipcMain.on('display:show-timer', (_event, data) => {
  projectorWindow?.webContents.send('display:show-timer', data)
})

ipcMain.on('display:clear-timer', () => {
  projectorWindow?.webContents.send('display:clear-timer')
})

ipcMain.on('display:show-image', (_event, src: string) => {
  projectorWindow?.webContents.send('display:show-image', { src })
})

ipcMain.handle('media:load-image', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: 'Choose Image to Display',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null
  const buffer = readFileSync(filePaths[0])
  const fileName = filePaths[0].split(/[\\/]/).pop() ?? 'image'
  const ext = filePaths[0].split('.').pop()?.toLowerCase() ?? 'jpg'
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
  return { dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, name: fileName }
})

ipcMain.handle('theme:load-image', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: 'Choose Background Image',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null
  const buffer = readFileSync(filePaths[0])
  const ext = filePaths[0].split('.').pop()?.toLowerCase() ?? 'jpg'
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  return { dataUrl: `data:${mime};base64,${buffer.toString('base64')}` }
})

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    await systemPreferences.askForMediaAccess('microphone')
  }

  setupDatabase()
  setupBibleHandlers()
  setupSongHandlers()
  setupExportHandlers()
  setupSemanticHandlers(join(app.getPath('userData'), 'model-cache'))
  setupWhisperHandlers(join(app.getPath('userData'), 'model-cache'))

  createOperatorWindow()
  createProjectorWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOperatorWindow()
      createProjectorWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
