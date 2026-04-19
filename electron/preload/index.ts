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
  showImage: (src: string) => ipcRenderer.send('display:show-image', src),

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
  ) => ipcRenderer.on('bible:download-progress', (_e, data) => cb(data)),

  // Semantic search
  getSemanticStatus: () => ipcRenderer.invoke('semantic:status'),
  loadSemanticModel: () => ipcRenderer.invoke('semantic:load-model'),
  startSemanticIndexing: () => ipcRenderer.invoke('semantic:start-indexing'),
  semanticSearch: (query: string) => ipcRenderer.invoke('semantic:search', query),
  onSemanticModelProgress: (cb: (data: { file: string; progress: number }) => void) =>
    ipcRenderer.on('semantic:model-progress', (_e, data) => cb(data)),
  onSemanticModelReady: (cb: () => void) =>
    ipcRenderer.on('semantic:model-ready', () => cb()),
  onSemanticIndexingProgress: (
    cb: (data: { done: number; total: number; complete?: boolean }) => void
  ) => ipcRenderer.on('semantic:indexing-progress', (_e, data) => cb(data)),

  // Whisper offline ASR
  whisperStatus: () => ipcRenderer.invoke('whisper:status'),
  whisperLoadModel: () => ipcRenderer.invoke('whisper:load-model'),
  whisperTranscribe: (audioBuffer: ArrayBuffer, sampleRate: number) =>
    ipcRenderer.invoke('whisper:transcribe', audioBuffer, sampleRate),
  onWhisperProgress: (cb: (data: { file: string; progress: number }) => void) =>
    ipcRenderer.on('whisper:progress', (_e, data) => cb(data)),
  onWhisperReady: (cb: () => void) =>
    ipcRenderer.on('whisper:ready', () => cb())
})
