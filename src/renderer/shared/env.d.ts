/// <reference types="vite/client" />

import { VerseResult, Song, DisplayTimer } from './types'
import { ProjectorTheme } from './themes'

interface Window {
  api: {
    // Bible
    getVerse: (params: { book: string; chapter: number; verse: number; translation: string }) => Promise<VerseResult>
    getVerseRange: (params: { book: string; chapter: number; verseStart: number; verseEnd: number; translation: string }) => Promise<VerseResult>

    // Display
    showVerse: (data: { text: string; reference: string; translation: string }) => void
    showLyrics: (data: { title: string; artist: string; lines: string[] }) => void
    clearDisplay: () => void
    toggleProjectorFullscreen: () => void

    // Songs
    searchSongs: (query: string) => Promise<Song[]>
    getSong: (id: number) => Promise<Song>
    listSongs: () => Promise<Song[]>
    addSong: (song: { title: string; artist: string; lyrics: string }) => Promise<{ id: number }>
    updateSong: (song: { id: number; title: string; artist: string; lyrics: string }) => Promise<{ success: boolean }>
    deleteSong: (id: number) => Promise<{ success: boolean }>

    // History
    addHistory: (entry: { type: string; reference?: string; content: string; translation?: string }) => void
    getHistory: () => Promise<Array<{ id: number; type: string; reference: string; content: string; translation: string; shown_at: string }>>
    exportNotes: () => Promise<{ success: boolean; path?: string; error?: string }>

    // Theme
    setTheme: (theme: ProjectorTheme) => void

    // Timer
    showTimer: (data: DisplayTimer) => void
    clearTimer: () => void

    // Background image picker
    loadBackgroundImage: () => Promise<{ dataUrl: string } | null>

    // Media image display
    loadImageForDisplay: () => Promise<{ dataUrl: string; name: string } | null>
    showImage: (src: string) => void

    // Whisper offline ASR
    whisperStatus: () => Promise<{ ready: boolean; loading: boolean }>
    whisperLoadModel: () => Promise<{ success: boolean; error?: string }>
    whisperTranscribe: (audioBuffer: ArrayBuffer, sampleRate: number) => Promise<{ success: boolean; text?: string; error?: string }>
    onWhisperProgress: (cb: (data: { file: string; progress: number }) => void) => void
    onWhisperReady: (cb: () => void) => void

    // Chapter fetch
    getChapter: (params: { book: string; chapter: number; translation: string }) => Promise<{
      success: boolean; verses?: Array<{ verse: number; text: string }>; book?: string; chapter?: number; translation?: string; error?: string
    }>

    // Offline Bible download
    getBibleDownloadStatus: () => Promise<{ downloaded: number; total: number; inProgress: boolean }>
    startBibleDownload: () => Promise<void>
    onBibleDownloadProgress: (cb: (data: { done: number; total: number; complete?: boolean }) => void) => void

    // Semantic search
    getSemanticStatus: () => Promise<{ indexed: number; cached: number; isIndexing: boolean; modelReady: boolean; modelLoading: boolean }>
    loadSemanticModel: () => Promise<{ success: boolean; error?: string }>
    startSemanticIndexing: () => Promise<void>
    semanticSearch: (query: string) => Promise<{
      results: Array<{ book: string; chapter: number; verse: number; text: string; reference: string; score: number }>
      empty?: boolean
      error?: string
    }>
    onSemanticModelProgress: (cb: (data: { file: string; progress: number }) => void) => void
    onSemanticModelReady: (cb: () => void) => void
    onSemanticIndexingProgress: (cb: (data: { done: number; total: number; complete?: boolean }) => void) => void
  }

  projector: {
    onShowVerse: (callback: (data: { text: string; reference: string; translation: string }) => void) => void
    onShowLyrics: (callback: (data: { title: string; artist: string; lines: string[] }) => void) => void
    onClear: (callback: () => void) => void
    onSetTheme: (callback: (theme: ProjectorTheme) => void) => void
    onShowTimer: (callback: (data: DisplayTimer) => void) => void
    onClearTimer: (callback: () => void) => void
    onShowImage: (callback: (data: { src: string; caption?: string }) => void) => void
  }
}
