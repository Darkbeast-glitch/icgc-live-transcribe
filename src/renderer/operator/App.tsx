import { useState, useEffect, useCallback, useRef } from 'react'
import { ActiveDisplay, QueueItem, BIBLE_BOOKS } from '@shared/types'
import { ProjectorTheme, buildTheme, FontSizeKey } from '@shared/themes'
import TopBar from './components/TopBar'
import TranscriptPanel from './components/TranscriptPanel'
import PreviewPanel from './components/PreviewPanel'
import QueuePanel from './components/QueuePanel'
import ChapterBrowser from './components/ChapterBrowser'
import SongPanel from './components/SongPanel'
import ServicePlanner from './components/ServicePlanner'
import SettingsPanel from './components/SettingsPanel'
import ManualSearch from './components/ManualSearch'
import HistoryPanel from './components/HistoryPanel'
import TimerPanel from './components/TimerPanel'
import MediaPanel, { MediaItem } from './components/MediaPanel'
import NotesPanel from './components/NotesPanel'
import { noteHtmlToPlainText } from '@shared/sanitizeNoteHtml'

type BottomTab = 'bible' | 'smart' | 'songs' | 'service' | 'history' | 'media' | 'notes'

const THEME_KEY = 'projector_theme_v1'

function loadSavedTheme(): ProjectorTheme {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw) return JSON.parse(raw) as ProjectorTheme
  } catch { /* ignore */ }
  return buildTheme('classic', 'md')
}

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

const BLANK: ActiveDisplay = { type: 'blank' }

export default function App() {
  const [translation, setTranslation] = useState('KJV')
  const [theme, setTheme] = useState<ProjectorTheme>(loadSavedTheme)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [bottomTab, setBottomTab] = useState<BottomTab>('bible')
  const [showSettings, setShowSettings] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const settingsModalRef = useRef<HTMLDivElement>(null)
  const settingsTriggerRef = useRef<HTMLElement | null>(null)

  // Display state
  const [nowShowing, setNowShowing] = useState<ActiveDisplay>(BLANK)
  const [programPreview, setProgramPreview] = useState<ActiveDisplay>(BLANK)
  const [nowShowingId, setNowShowingId] = useState<string | null>(null)

  // Queue + detections
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [recentDetections, setRecentDetections] = useState<QueueItem[]>([])

  // Media items — kept here so they survive tab switches
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])

  // Pending preview item (for Take Live flow)
  const pendingPreviewRef = useRef<QueueItem | null>(null)

  // Active verse for chapter browser sync
  const [activeVerse, setActiveVerse] = useState<{ book: string; chapter: number; verse: number } | null>(null)

  // Coords of whatever verse is currently live — used to auto-switch translation.
  // Mirrored into state so the next/previous controls can enable themselves; the ref
  // is what the translation effect reads, so it stays off that effect's dep list.
  const liveVerseRef = useRef<{ book: string; chapter: number; verse: number } | null>(null)
  const [liveVerse, setLiveVerse] = useState<{ book: string; chapter: number; verse: number } | null>(null)

  // Session timer
  useEffect(() => {
    const id = setInterval(() => setSessionSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Sync theme to projector
  useEffect(() => {
    window.api.setTheme(theme)
    localStorage.setItem(THEME_KEY, JSON.stringify(theme))
  }, [theme])

  // When translation changes, re-fetch and re-push the live verse in the new version
  useEffect(() => {
    const coords = liveVerseRef.current
    if (!coords) return

    // Check nowShowing via a callback ref so we don't need it as a dep
    setNowShowing((prev) => {
      if (prev.type !== 'verse') return prev
      // Fire the fetch asynchronously — state setter just reads current value
      ;(async () => {
        const res = await window.api.getVerse({ book: coords.book, chapter: coords.chapter, verse: coords.verse, translation })
        if (!res.success || !res.text) return
        const updated: ActiveDisplay = {
          type: 'verse',
          verse: {
            text: res.text,
            reference: res.reference!,
            translation: res.translation!,
            book: coords.book,
            chapter: coords.chapter,
            verseNum: coords.verse,
          },
        }
        window.api.showVerse({ text: res.text, reference: res.reference!, translation: res.translation! })
        setNowShowing(updated)
      })()
      return prev // keep existing display until fetch completes
    })
  }, [translation])

  // Parse a reference string like "John 3:16" → { book, chapter, verse }
  // Used when ManualSearch/SmartSearch presents a verse (they don't pass coords directly)
  const recordLiveFromReference = useCallback((reference: string) => {
    const match = reference.match(/^(.+?)\s+(\d+):(\d+)/)
    if (!match) return
    const rawBook = match[1].trim()
    const chapter = parseInt(match[2])
    const verse = parseInt(match[3])
    const book =
      BIBLE_BOOKS.find((b) => b.toLowerCase() === rawBook.toLowerCase()) ||
      BIBLE_BOOKS.find((b) => b.toLowerCase().startsWith(rawBook.toLowerCase()))
    if (book) liveVerseRef.current = { book, chapter, verse }
  }, [])

  const presentItem = useCallback((item: QueueItem) => {
    window.api.showVerse({ text: item.text, reference: item.reference, translation: item.translation })
    window.api.addHistory({ type: 'verse', reference: item.reference, content: item.text, translation: item.translation })

    liveVerseRef.current = { book: item.book, chapter: item.chapter, verse: item.verse }
    setLiveVerse({ book: item.book, chapter: item.chapter, verse: item.verse })

    const display: ActiveDisplay = {
      type: 'verse',
      verse: {
        text: item.text, reference: item.reference, translation: item.translation,
        book: item.book, chapter: item.chapter, verseNum: item.verse,
      },
    }
    setNowShowing(display)
    setNowShowingId(item.id)
    setActiveVerse({ book: item.book, chapter: item.chapter, verse: item.verse })
  }, [])

  // Advance the live verse by one, rolling over chapter boundaries so reading a
  // passage straight through never needs the operator to go find the next chapter.
  // Operates on whatever is live — not on the browser's selection — so it stays
  // predictable while the operator is looking somewhere else.
  const stepVerse = useCallback(async (delta: number) => {
    const cur = liveVerseRef.current
    if (!cur) return

    const target = cur.verse + delta
    if (target >= 1) {
      const res = await window.api.getVerse({ book: cur.book, chapter: cur.chapter, verse: target, translation })
      if (res.success && res.text) {
        presentItem({
          id: genId(), reference: res.reference!, book: cur.book, chapter: cur.chapter,
          verse: target, text: res.text, translation: res.translation!, source: 'manual',
        })
        return
      }
    }

    // Past the end (or before the start) of the chapter — roll into the neighbour.
    const nextChapter = cur.chapter + (delta > 0 ? 1 : -1)
    if (nextChapter < 1) return

    const chap = await window.api.getChapter({ book: cur.book, chapter: nextChapter, translation })
    if (!chap.success || !chap.verses?.length) return

    const landing = delta > 0 ? chap.verses[0] : chap.verses[chap.verses.length - 1]
    const res = await window.api.getVerse({ book: cur.book, chapter: nextChapter, verse: landing.verse, translation })
    if (!res.success || !res.text) return

    presentItem({
      id: genId(), reference: res.reference!, book: cur.book, chapter: nextChapter,
      verse: landing.verse, text: res.text, translation: res.translation!, source: 'manual',
    })
  }, [translation, presentItem])

  // Keyboard: ← → step the live verse, but only when the operator isn't typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showSettings) return
      const el = e.target as HTMLElement | null
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); void stepVerse(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); void stepVerse(-1) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [stepVerse, showSettings])

  const previewItem = useCallback((item: QueueItem) => {
    pendingPreviewRef.current = item
    setProgramPreview({
      type: 'verse',
      verse: { text: item.text, reference: item.reference, translation: item.translation, book: item.book, chapter: item.chapter, verseNum: item.verse },
    })
    setActiveVerse({ book: item.book, chapter: item.chapter, verse: item.verse })
  }, [])

  const handleTakeLive = useCallback(() => {
    const item = pendingPreviewRef.current
    if (!item) return
    presentItem(item)
    setProgramPreview(BLANK)
    pendingPreviewRef.current = null
  }, [presentItem])

  const addToQueue = useCallback((item: QueueItem) => {
    setQueue((prev) => {
      if (prev.find((q) => q.reference === item.reference && q.translation === item.translation)) return prev
      return [...prev, { ...item, id: genId() }]
    })
  }, [])

  const handleDetected = useCallback((item: QueueItem) => {
    setRecentDetections((prev) => {
      const filtered = prev.filter((d) => d.reference !== item.reference)
      return [item, ...filtered].slice(0, 15)
    })
  }, [])

  const handleQueueAction = useCallback((idOrAction: string) => {
    if (idOrAction.startsWith('add:')) {
      const realId = idOrAction.slice(4)
      const item = recentDetections.find((d) => d.id === realId)
      if (item) addToQueue(item)
    } else {
      setQueue((prev) => prev.filter((q) => q.id !== idOrAction))
    }
  }, [recentDetections, addToQueue])

  const handleClear = useCallback(() => {
    window.api.clearDisplay()
    liveVerseRef.current = null
    setLiveVerse(null)
    setNowShowing(BLANK)
    setProgramPreview(BLANK)
    setNowShowingId(null)
    pendingPreviewRef.current = null
  }, [])

  const handleThemeChange = useCallback((t: ProjectorTheme) => setTheme(t), [])

  const openSettings = useCallback(() => {
    settingsTriggerRef.current = document.activeElement as HTMLElement
    setShowSettings(true)
  }, [])

  const closeSettings = useCallback(() => {
    setShowSettings(false)
    settingsTriggerRef.current?.focus()
  }, [])

  // Settings modal: Escape to close + focus trap
  useEffect(() => {
    if (!showSettings) return
    const modal = settingsModalRef.current
    const firstFocusable = modal?.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeSettings(); return }
      if (e.key !== 'Tab' || !modal) return
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
      if (focusable.length === 0) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSettings, closeSettings])

  const handleDisplayFromSong = useCallback((info: { type: 'lyrics'; label: string }) => {
    setNowShowing({ type: 'lyrics', lyrics: { title: info.label, lines: [] } })
  }, [])

  const BOTTOM_TABS: { id: BottomTab; label: string }[] = [
    { id: 'bible', label: 'Scripture' },
    { id: 'smart', label: '✨ Smart Search' },
    { id: 'songs', label: 'Songs' },
    { id: 'service', label: 'Service Plan' },
    { id: 'media', label: '🖼 Media' },
    { id: 'notes', label: '📝 Notes' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div className="flex flex-col h-screen text-white">
      {/* Top bar */}
      <TopBar
        sessionSeconds={sessionSeconds}
        translation={translation}
        onTranslationChange={setTranslation}
        onSettingsClick={openSettings}
        onClear={handleClear}
      />

      {/* Timer drawer */}
      {showTimer && <TimerPanel />}

      {/* Main dashboard */}
      <div className="flex flex-1 min-h-0">
        {/* Left + Center column */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Top row: transcript + preview panels */}
          <div className="flex border-b border-[#252528]" style={{ height: 'min(260px, 32vh)', minHeight: '200px' }}>
            <TranscriptPanel
              translation={translation}
              onPresent={presentItem}
              onPreview={previewItem}
              onAddToQueue={addToQueue}
              onDetected={handleDetected}
            />
            <PreviewPanel
              nowShowing={nowShowing}
              programPreview={programPreview}
              theme={theme}
              canStepVerse={liveVerse !== null}
              onStepVerse={stepVerse}
              onTakeLive={handleTakeLive}
            />
          </div>

          {/* Bottom: tabs + content */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Tab bar */}
            <div role="tablist" aria-label="Content panels" className="flex items-center gap-0 border-b border-[#252528] bg-[#0e0e11] shrink-0">
              {BOTTOM_TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={bottomTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setBottomTab(tab.id)}
                  className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    bottomTab === tab.id
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={() => setShowTimer((v) => !v)}
                aria-label={showTimer ? 'Hide timer' : 'Show timer'}
                aria-pressed={showTimer}
                className={`px-3 py-2 text-xs mr-2 rounded transition-colors ${
                  showTimer ? 'text-green-400' : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                ⏱ Timer
              </button>
            </div>

            {/* Tab content */}
            <div
              role="tabpanel"
              id={`tabpanel-${bottomTab}`}
              aria-labelledby={`tab-${bottomTab}`}
              className="flex-1 min-h-0 overflow-hidden"
            >
              {bottomTab === 'bible' && (
                <ChapterBrowser
                  translation={translation}
                  activeVerse={activeVerse}
                  onPresent={presentItem}
                  onPreview={previewItem}
                  onAddToQueue={addToQueue}
                />
              )}
              {bottomTab === 'smart' && (
                <ManualSearch translation={translation} onDisplay={(info) => {
                  if (info.type === 'verse') {
                    recordLiveFromReference(info.label)
                    setNowShowing({ type: 'verse', verse: { text: '', reference: info.label, translation: info.translation ?? '' } })
                  }
                }} />
              )}
              {bottomTab === 'songs' && (
                <SongPanel onDisplay={(info) => {
                  liveVerseRef.current = null
                  setNowShowing({ type: 'lyrics', lyrics: { title: info.label, lines: info.lines ?? [] } })
                }} />
              )}
              {bottomTab === 'service' && (
                <ServicePlanner translation={translation} onDisplay={(info) => {
                  if (info.type === 'verse') {
                    recordLiveFromReference(info.label)
                    setNowShowing({ type: 'verse', verse: { text: '', reference: info.label, translation: info.translation ?? '' } })
                  } else {
                    liveVerseRef.current = null
                    setNowShowing({ type: 'lyrics', lyrics: { title: info.label, lines: [] } })
                  }
                }} />
              )}
              {bottomTab === 'media' && (
                <MediaPanel
                  items={mediaItems}
                  onItemsChange={setMediaItems}
                  onDisplay={(display) => setNowShowing(display)}
                />
              )}
              {bottomTab === 'notes' && (
                <NotesPanel onDisplay={(info) => {
                  setNowShowing({ type: 'note', note: info })
                  const plain = noteHtmlToPlainText(info.html)
                  window.api.addHistory({ type: 'note', content: info.heading ? `${info.heading}: ${plain}` : plain })
                }} />
              )}
              {bottomTab === 'history' && <HistoryPanel />}
            </div>
          </div>
        </div>

        {/* Right: queue panel */}
        <QueuePanel
          queue={queue}
          recentDetections={recentDetections}
          nowShowingId={nowShowingId}
          onPresent={presentItem}
          onPreview={previewItem}
          onRemove={handleQueueAction}
          onClearQueue={() => setQueue([])}
          onClearDetections={() => setRecentDetections([])}
        />
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={closeSettings} aria-hidden="true" />
          <div
            ref={settingsModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="relative bg-[#111113] border border-[#252528] rounded-xl w-[640px] max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#252528]">
              <h2 id="settings-title" className="text-white font-semibold">Settings</h2>
              <button
                onClick={closeSettings}
                aria-label="Close settings"
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded transition-colors"
              >
                ✕
              </button>
            </div>
            <SettingsPanel theme={theme} onThemeChange={handleThemeChange} />
          </div>
        </div>
      )}
    </div>
  )
}
