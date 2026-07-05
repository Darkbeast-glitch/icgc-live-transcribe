import { contextBridge, ipcRenderer } from 'electron'

// Operator window API
contextBridge.exposeInMainWorld('api', {
  // Bible
  getVerse: (params: { book: string; chapter: number; verse: number; translation: string }) =>
    ipcRenderer.invoke('bible:get-verse', params),
  getVerseRange: (params: {
    book: string
    chapter: number
    verseStart: number
    verseEnd: number
    translation: string
  }) => ipcRenderer.invoke('bible:get-verse-range', params),

  // Display — send to projector
  showVerse: (data: { text: string; reference: string; translation: string }) =>
    ipcRenderer.send('display:show-verse', data),
  showLyrics: (data: { title: string; artist: string; lines: string[] }) =>
    ipcRenderer.send('display:show-lyrics', data),
  clearDisplay: () => ipcRenderer.send('display:clear'),
  toggleProjectorFullscreen: () => ipcRenderer.send('projector:toggle-fullscreen'),

  // Songs
  searchSongs: (query: string) => ipcRenderer.invoke('songs:search', query),
  getSong: (id: number) => ipcRenderer.invoke('songs:get', id),
  listSongs: () => ipcRenderer.invoke('songs:list'),
  addSong: (song: { title: string; artist: string; lyrics: string }) =>
    ipcRenderer.invoke('songs:add', song),
  updateSong: (song: { id: number; title: string; artist: string; lyrics: string }) =>
    ipcRenderer.invoke('songs:update', song),
  deleteSong: (id: number) => ipcRenderer.invoke('songs:delete', id),

  // History
  addHistory: (entry: { type: string; reference?: string; content: string; translation?: string }) =>
    ipcRenderer.send('history:add', entry),
  getHistory: () => ipcRenderer.invoke('history:get'),
  exportNotes: () => ipcRenderer.invoke('history:export-notes'),

  // Timer
  showTimer: (data: unknown) => ipcRenderer.send('display:show-timer', data),
  clearTimer: () => ipcRenderer.send('display:clear-timer'),

  // Background image
  loadBackgroundImage: () => ipcRenderer.invoke('theme:load-image'),

  // Media image display
  loadImageForDisplay: () => ipcRenderer.invoke('media:load-image'),
  showImage: (data: { src: string; caption?: string; fit?: 'contain' | 'cover' }) => ipcRenderer.send('display:show-image', data),

  // Manual notes display
  showNote: (data: { heading?: string; html: string }) => ipcRenderer.send('display:show-note', data),

  // Theme
  setTheme: (theme: unknown) => ipcRenderer.send('display:set-theme', theme),

  // Chapter fetch
  getChapter: (params: { book: string; chapter: number; translation: string }) =>
    ipcRenderer.invoke('bible:get-chapter', params),

  // Offline Bible download
  getBibleDownloadStatus: () => ipcRenderer.invoke('bible:download-status'),
  startBibleDownload: () => ipcRenderer.invoke('bible:start-download'),
  onBibleDownloadProgress: (
    cb: (data: { done: number; total: number; complete?: boolean }) => void
  ) => {
    const handler = (_e: unknown, data: { done: number; total: number; complete?: boolean }) => cb(data)
    ipcRenderer.on('bible:download-progress', handler)
    return () => ipcRenderer.removeListener('bible:download-progress', handler)
  },

  // Semantic search
  getSemanticStatus: () => ipcRenderer.invoke('semantic:status'),
  loadSemanticModel: () => ipcRenderer.invoke('semantic:load-model'),
  startSemanticIndexing: () => ipcRenderer.invoke('semantic:start-indexing'),
  semanticSearch: (query: string) => ipcRenderer.invoke('semantic:search', query),
  onSemanticModelProgress: (cb: (data: { file: string; progress: number }) => void) => {
    const handler = (_e: unknown, data: { file: string; progress: number }) => cb(data)
    ipcRenderer.on('semantic:model-progress', handler)
    return () => ipcRenderer.removeListener('semantic:model-progress', handler)
  },
  onSemanticModelReady: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('semantic:model-ready', handler)
    return () => ipcRenderer.removeListener('semantic:model-ready', handler)
  },
  onSemanticIndexingProgress: (
    cb: (data: { done: number; total: number; complete?: boolean }) => void
  ) => {
    const handler = (_e: unknown, data: { done: number; total: number; complete?: boolean }) => cb(data)
    ipcRenderer.on('semantic:indexing-progress', handler)
    return () => ipcRenderer.removeListener('semantic:indexing-progress', handler)
  },

  // Whisper offline ASR
  whisperStatus: () => ipcRenderer.invoke('whisper:status'),
  whisperLoadModel: () => ipcRenderer.invoke('whisper:load-model'),
  whisperTranscribe: (audioBuffer: ArrayBuffer, sampleRate: number) =>
    ipcRenderer.invoke('whisper:transcribe', audioBuffer, sampleRate),
  onWhisperProgress: (cb: (data: { file: string; progress: number }) => void) => {
    const handler = (_e: unknown, data: { file: string; progress: number }) => cb(data)
    ipcRenderer.on('whisper:progress', handler)
    return () => ipcRenderer.removeListener('whisper:progress', handler)
  },
  onWhisperReady: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('whisper:ready', handler)
    return () => ipcRenderer.removeListener('whisper:ready', handler)
  },

  // vMix Web Output
  vmixStart: () => ipcRenderer.invoke('vmix:start'),
  vmixStop: () => ipcRenderer.invoke('vmix:stop'),
  vmixStatus: () => ipcRenderer.invoke('vmix:status'),
})
