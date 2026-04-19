import { contextBridge, ipcRenderer } from 'electron'

// Projector window only needs to receive display events
contextBridge.exposeInMainWorld('projector', {
  onShowVerse: (callback: (data: { text: string; reference: string; translation: string }) => void) =>
    ipcRenderer.on('display:show-verse', (_event, data) => callback(data)),

  onShowLyrics: (callback: (data: { title: string; artist: string; lines: string[] }) => void) =>
    ipcRenderer.on('display:show-lyrics', (_event, data) => callback(data)),

  onClear: (callback: () => void) =>
    ipcRenderer.on('display:clear', () => callback()),

  onSetTheme: (callback: (theme: unknown) => void) =>
    ipcRenderer.on('display:set-theme', (_event, theme) => callback(theme)),

  onShowTimer: (callback: (data: unknown) => void) =>
    ipcRenderer.on('display:show-timer', (_event, data) => callback(data)),

  onClearTimer: (callback: () => void) =>
    ipcRenderer.on('display:clear-timer', () => callback()),

  onShowImage: (callback: (data: { src: string; caption?: string }) => void) =>
    ipcRenderer.on('display:show-image', (_event, data) => callback(data))
})
