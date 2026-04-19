import { useState, useEffect, useCallback, useRef } from 'react'
import { ActiveDisplay, QueueItem } from '@shared/types'
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
import MediaPanel from './components/MediaPanel'

type BottomTab = 'bible' | 'smart' | 'songs' | 'service' | 'history' | 'media'

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
  const [goLive, setGoLive] = useState(true)
  const [bottomTab, setBottomTab] = useState<BottomTab>('bible')
  const [showSettings, setShowSettings] = useState(false)
  const [showTimer, setShowTimer] = useState(false)

  // Display state
  const [nowShowing, setNowShowing] = useState<ActiveDisplay>(BLANK)
  const [programPreview, setProgramPreview] = useState<ActiveDisplay>(BLANK)
  const [nowShowingId, setNowShowingId] = useState<string | null>(null)

  // Queue + detections
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [recentDetections, setRecentDetections] = useState<QueueItem[]>([])

  // Pending preview item (for Take Live flow)
  const pendingPreviewRef = useRef<QueueItem | null>(null)

  // Active verse for chapter browser sync
  const [activeVerse, setActiveVerse] = useState<{ book: string; chapter: number; verse: number } | null>(null)

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
  useEffect(() => { window.api.setTheme(theme) }, [])

  const presentItem = useCallback((item: QueueItem) => {
    window.api.showVerse({ text: item.text, reference: item.reference, translation: item.translation })
    window.api.addHistory({ type: 'verse', reference: item.reference, content: item.text, translation: item.translation })

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
    setNowShowing(BLANK)
    setProgramPreview(BLANK)
    setNowShowingId(null)
    pendingPreviewRef.current = null
  }, [])

  const handleThemeChange = useCallback((t: ProjectorTheme) => setTheme(t), [])

  const handleDisplayFromSong = useCallback((info: { type: 'lyrics'; label: string }) => {
    setNowShowing({ type: 'lyrics', lyrics: { title: info.label, lines: [] } })
  }, [])

  const BOTTOM_TABS: { id: BottomTab; label: string }[] = [
    { id: 'bible', label: 'Scripture' },
    { id: 'smart', label: '✨ Smart Search' },
    { id: 'songs', label: 'Songs' },
    { id: 'service', label: 'Service Plan' },
    { id: 'media', label: '🖼 Media' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#0c0c0f] text-white">
      {/* Top bar */}
      <TopBar
        sessionSeconds={sessionSeconds}
        translation={translation}
        onTranslationChange={setTranslation}
        onSettingsClick={() => setShowSettings(true)}
        onClear={handleClear}
      />

      {/* Timer drawer */}
      {showTimer && <TimerPanel />}

      {/* Main dashboard */}
      <div className="flex flex-1 min-h-0">
        {/* Left + Center column */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Top row: transcript + preview panels */}
          <div className="flex border-b border-[#252528]" style={{ height: '260px' }}>
            <TranscriptPanel
              translation={translation}
              goLive={goLive}
              onPresent={presentItem}
              onPreview={previewItem}
              onAddToQueue={addToQueue}
              onDetected={handleDetected}
            />
            <PreviewPanel
              nowShowing={nowShowing}
              programPreview={programPreview}
              theme={theme}
              goLive={goLive}
              onGoLiveToggle={() => setGoLive((v) => !v)}
              onTakeLive={handleTakeLive}
            />
          </div>

          {/* Bottom: tabs + content */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Tab bar */}
            <div className="flex items-center gap-0 border-b border-[#252528] bg-[#0e0e11] shrink-0">
              {BOTTOM_TABS.map((tab) => (
                <button
                  key={tab.id}
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
                className={`px-3 py-2 text-xs mr-2 rounded transition-colors ${
                  showTimer ? 'text-green-400' : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                ⏱ Timer
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-hidden">
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
                    setNowShowing({ type: 'verse', verse: { text: '', reference: info.label, translation: info.translation ?? '' } })
                  }
                }} />
              )}
              {bottomTab === 'songs' && (
                <SongPanel onDisplay={(info) => {
                  setNowShowing({ type: 'lyrics', lyrics: { title: info.label, lines: [] } })
                }} />
              )}
              {bottomTab === 'service' && (
                <ServicePlanner translation={translation} onDisplay={(info) => {
                  if (info.type === 'verse') {
                    setNowShowing({ type: 'verse', verse: { text: '', reference: info.label, translation: info.translation ?? '' } })
                  } else {
                    setNowShowing({ type: 'lyrics', lyrics: { title: info.label, lines: [] } })
                  }
                }} />
              )}
              {bottomTab === 'media' && (
                <MediaPanel onDisplay={(display) => {
                  setNowShowing(display)
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
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowSettings(false)} />
          <div className="relative bg-[#111113] border border-[#333338] rounded-2xl w-[640px] max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#252528]">
              <h2 className="text-white font-semibold">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
            <SettingsPanel theme={theme} onThemeChange={handleThemeChange} />
          </div>
        </div>
      )}
    </div>
  )
}
