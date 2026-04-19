import { useState, useEffect, useCallback, useRef } from 'react'
import { BIBLE_BOOKS, QueueItem } from '@shared/types'

interface VerseRow { verse: number; text: string }

interface Props {
  translation: string
  activeVerse: { book: string; chapter: number; verse: number } | null
  onPresent: (item: QueueItem) => void
  onPreview: (item: QueueItem) => void
  onAddToQueue: (item: QueueItem) => void
}

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

export default function ChapterBrowser({ translation, activeVerse, onPresent, onPreview, onAddToQueue }: Props) {
  const [book, setBook] = useState('John')
  const [chapter, setChapter] = useState(3)
  const [verses, setVerses] = useState<VerseRow[]>([])
  const [loading, setLoading] = useState(false)
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeVerse) {
      setBook(activeVerse.book)
      setChapter(activeVerse.chapter)
    }
  }, [activeVerse])

  useEffect(() => { loadChapter() }, [book, chapter, translation])

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [verses, activeVerse])

  const loadChapter = useCallback(async () => {
    setLoading(true)
    setVerses([])
    const result = await window.api.getChapter({ book, chapter, translation })
    if (result.success && result.verses) setVerses(result.verses)
    setLoading(false)
  }, [book, chapter, translation])

  const buildItem = async (v: VerseRow): Promise<QueueItem | null> => {
    const res = await window.api.getVerse({ book, chapter, verse: v.verse, translation })
    if (!res.success) return null
    return {
      id: genId(), reference: res.reference!, book, chapter, verse: v.verse,
      text: res.text!, translation: res.translation!, source: 'manual',
    }
  }

  const handlePreview = async (v: VerseRow) => {
    const item = await buildItem(v)
    if (item) onPreview(item)
  }

  const handlePresent = async (v: VerseRow) => {
    const item = await buildItem(v)
    if (item) onPresent(item)
  }

  const handleQueue = async (v: VerseRow) => {
    const item = await buildItem(v)
    if (item) onAddToQueue(item)
  }

  const isActive = (v: VerseRow) =>
    activeVerse?.book === book && activeVerse?.chapter === chapter && activeVerse?.verse === v.verse

  return (
    <div className="flex flex-col h-full">
      {/* Chapter nav bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#252528] shrink-0 bg-[#0e0e11]">
        <div className="flex items-center gap-2">
          <select
            value={book}
            onChange={(e) => { setBook(e.target.value); setChapter(1) }}
            className="bg-[#1a1a1e] text-white text-xs rounded px-2 py-1.5 border border-[#333338] focus:outline-none focus:border-orange-500 max-w-[140px]"
          >
            {BIBLE_BOOKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setChapter((c) => Math.max(1, c - 1))}
              className="w-6 h-6 flex items-center justify-center bg-[#1a1a1e] border border-[#333338] text-slate-400 hover:text-white rounded text-xs transition-colors"
            >‹</button>
            <input
              type="number" min="1" max={150} value={chapter}
              onChange={(e) => setChapter(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-10 bg-[#1a1a1e] border border-[#333338] text-white text-xs px-1.5 py-1 rounded text-center focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={() => setChapter((c) => c + 1)}
              className="w-6 h-6 flex items-center justify-center bg-[#1a1a1e] border border-[#333338] text-slate-400 hover:text-white rounded text-xs transition-colors"
            >›</button>
          </div>

          <span className="text-slate-600 text-xs">{book} {chapter}</span>
        </div>

        <div className="flex-1" />

        <p className="text-slate-700 text-[10px] italic">click = preview · dbl-click = present</p>

        <span className="text-slate-600 text-xs">
          {verses.length > 0 ? `${verses.length} verses` : loading ? 'loading…' : ''}
        </span>
      </div>

      {/* Verse list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && verses.length === 0 && (
          <p className="text-slate-700 text-sm text-center py-12">
            No verses found. Try downloading the Bible in Settings.
          </p>
        )}
        {verses.map((v) => {
          const active = isActive(v)
          return (
            <div
              key={v.verse}
              ref={active ? activeRef : undefined}
              onClick={() => handlePreview(v)}
              onDoubleClick={(e) => { e.preventDefault(); handlePresent(v) }}
              className={`flex items-center gap-3 px-4 py-2 border-b border-[#1a1a1e] transition-colors cursor-pointer select-none ${
                active
                  ? 'bg-orange-950/30 border-l-2 border-l-orange-500'
                  : 'hover:bg-[#161619]'
              }`}
            >
              <span
                className={`text-xs font-mono w-5 text-right shrink-0 ${
                  active ? 'text-orange-400' : 'text-slate-700'
                }`}
              >
                {v.verse}
              </span>

              <p className={`flex-1 text-sm leading-relaxed min-w-0 ${active ? 'text-white' : 'text-slate-400'} transition-colors`}>
                {v.text}
              </p>

              {/* Always-visible action buttons */}
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handlePreview(v)}
                  title="Send to Program Preview"
                  className="px-2 py-1 text-[10px] font-medium rounded border border-[#333338] text-slate-400 hover:text-white hover:border-slate-500 bg-[#1a1a1e] hover:bg-[#252528] transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => handlePresent(v)}
                  title="Present live now"
                  className="px-2 py-1 text-[10px] font-medium rounded bg-orange-500 hover:bg-orange-400 text-white transition-colors"
                >
                  ▶
                </button>
                <button
                  onClick={() => handleQueue(v)}
                  title="Add to queue"
                  className="px-2 py-1 text-[10px] font-medium rounded border border-[#333338] text-slate-500 hover:text-white hover:border-slate-500 bg-[#1a1a1e] hover:bg-[#252528] transition-colors"
                >
                  +Q
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
