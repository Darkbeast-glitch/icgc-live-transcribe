import { useState, useEffect, useCallback, useRef } from 'react'
import { BIBLE_BOOKS, TRANSLATIONS, NowShowingInfo } from '@shared/types'

interface ServiceVerseItem {
  id: string
  type: 'verse'
  book: string
  chapter: number
  verseStart: number
  verseEnd?: number
  translation: string
  label: string
}

interface ServiceSongItem {
  id: string
  type: 'song'
  songId: number
  label: string
  artist?: string
}

type ServiceItem = ServiceVerseItem | ServiceSongItem

interface Props {
  translation: string
  onDisplay?: (info: NowShowingInfo) => void
}

const STORAGE_KEY = 'service_plan_v1'

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function loadPlan(): ServiceItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ServiceItem[]) : []
  } catch {
    return []
  }
}

function parseSections(lyrics: string): string[][] {
  const lines = lyrics.split('\n')
  const sections: string[][] = []
  let current: string[] = []
  for (const line of lines) {
    if (line.trim() === '' && current.length > 0) {
      sections.push(current)
      current = []
    } else if (line.trim()) {
      current.push(line)
    }
  }
  if (current.length > 0) sections.push(current)
  return sections
}

export default function ServicePlanner({ translation, onDisplay }: Props) {
  const [items, setItems] = useState<ServiceItem[]>(loadPlan)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [mode, setMode] = useState<'edit' | 'run'>('edit')
  const [addType, setAddType] = useState<'verse' | 'song'>('verse')

  // Verse form state
  const [vBook, setVBook] = useState('John')
  const [vChapter, setVChapter] = useState('3')
  const [vVerse, setVVerse] = useState('16')
  const [vVerseEnd, setVVerseEnd] = useState('')
  const [vTrans, setVTrans] = useState(translation)

  // Song picker state
  const [songSearch, setSongSearch] = useState('')
  const [songResults, setSongResults] = useState<Array<{ id: number; title: string; artist: string }>>([])

  // Run mode: song sections
  const [songSections, setSongSections] = useState<{ id: number; sections: string[][] } | null>(null)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)

  const activeIndexRef = useRef(activeIndex)
  activeIndexRef.current = activeIndex
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    window.api.searchSongs(songSearch).then(setSongResults)
  }, [songSearch])

  // Keyboard navigation in run mode
  useEffect(() => {
    if (mode !== 'run') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        const cur = activeIndexRef.current
        const next = cur === null ? 0 : cur + 1
        if (next < itemsRef.current.length) showItem(next)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        const cur = activeIndexRef.current
        if (cur !== null && cur > 0) showItem(cur - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode])

  const showItem = useCallback(async (index: number) => {
    const item = itemsRef.current[index]
    if (!item) return
    setActiveIndex(index)
    setSongSections(null)
    setActiveSectionIndex(0)

    if (item.type === 'verse') {
      let res
      if (item.verseEnd) {
        res = await window.api.getVerseRange({
          book: item.book,
          chapter: item.chapter,
          verseStart: item.verseStart,
          verseEnd: item.verseEnd,
          translation: item.translation,
        })
      } else {
        res = await window.api.getVerse({
          book: item.book,
          chapter: item.chapter,
          verse: item.verseStart,
          translation: item.translation,
        })
      }
      if (res.success) {
        window.api.showVerse({ text: res.text!, reference: res.reference!, translation: res.translation! })
        window.api.addHistory({ type: 'verse', reference: res.reference, content: res.text!, translation: res.translation })
        onDisplay?.({ type: 'verse', label: res.reference!, translation: res.translation })
      }
    } else {
      const full = await window.api.getSong(item.songId)
      const sections = parseSections(full.lyrics || '')
      setSongSections({ id: item.songId, sections })
      if (sections[0]) {
        window.api.showLyrics({ title: item.label, artist: item.artist || '', lines: sections[0] })
        window.api.addHistory({ type: 'song', reference: item.label, content: sections[0].join('\n') })
        onDisplay?.({ type: 'lyrics', label: item.label })
      }
    }
  }, [onDisplay])

  const showSection = useCallback((sectionIdx: number) => {
    if (!songSections) return
    const activeItem = activeIndexRef.current !== null ? itemsRef.current[activeIndexRef.current] : null
    if (!activeItem || activeItem.type !== 'song') return
    const lines = songSections.sections[sectionIdx]
    if (!lines) return
    setActiveSectionIndex(sectionIdx)
    window.api.showLyrics({ title: activeItem.label, artist: activeItem.artist || '', lines })
    onDisplay?.({ type: 'lyrics', label: activeItem.label })
  }, [songSections, onDisplay])

  const addVerse = () => {
    if (!vBook || !vChapter || !vVerse) return
    const range = vVerseEnd ? `-${vVerseEnd}` : ''
    const item: ServiceVerseItem = {
      id: genId(),
      type: 'verse',
      book: vBook,
      chapter: parseInt(vChapter),
      verseStart: parseInt(vVerse),
      verseEnd: vVerseEnd ? parseInt(vVerseEnd) : undefined,
      translation: vTrans,
      label: `${vBook} ${vChapter}:${vVerse}${range} (${vTrans})`,
    }
    setItems((prev) => [...prev, item])
  }

  const addSong = (song: { id: number; title: string; artist: string }) => {
    setItems((prev) => [
      ...prev,
      { id: genId(), type: 'song', songId: song.id, label: song.title, artist: song.artist },
    ])
  }

  const moveItem = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= items.length) return
    setItems((prev) => {
      const arr = [...prev]
      ;[arr[index], arr[next]] = [arr[next], arr[index]]
      return arr
    })
  }

  return (
    <div className="flex h-full">
      {/* ── Left: Service list ── */}
      <div className="flex flex-col w-64 border-r border-slate-700 shrink-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700 shrink-0">
          <span className="text-slate-300 text-sm font-medium">Order of Service</span>
          <div className="flex gap-1">
            <button
              onClick={() => setMode('edit')}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                mode === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => { setMode('run'); setActiveIndex(null); setSongSections(null) }}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                mode === 'run' ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Run ▶
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.length === 0 && (
            <p className="text-slate-600 text-xs text-center mt-10 px-2">
              {mode === 'edit' ? 'Add verses and songs using the panel on the right' : 'No items planned'}
            </p>
          )}
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`rounded-lg border transition-all ${
                activeIndex === i && mode === 'run'
                  ? 'border-green-500/60 bg-green-900/20'
                  : 'border-slate-700 bg-slate-800/40'
              }`}
            >
              <button
                onClick={() => mode === 'run' && showItem(i)}
                className={`w-full text-left px-2.5 py-2 rounded-lg ${
                  mode === 'run' ? 'hover:bg-slate-700/40 cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 text-xs w-4 text-right shrink-0">{i + 1}</span>
                  <span className="text-xs">{item.type === 'verse' ? '📖' : '🎵'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs truncate leading-snug">{item.label}</p>
                    {item.type === 'song' && item.artist && (
                      <p className="text-slate-500 text-xs truncate">{item.artist}</p>
                    )}
                  </div>
                  {activeIndex === i && mode === 'run' && (
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shrink-0" />
                  )}
                </div>
              </button>
              {mode === 'edit' && (
                <div className="flex items-center gap-0.5 px-2 pb-1.5">
                  <button
                    onClick={() => moveItem(i, -1)}
                    disabled={i === 0}
                    className="text-slate-600 hover:text-white disabled:opacity-20 text-xs px-1.5 py-0.5 rounded hover:bg-slate-700"
                  >↑</button>
                  <button
                    onClick={() => moveItem(i, 1)}
                    disabled={i === items.length - 1}
                    className="text-slate-600 hover:text-white disabled:opacity-20 text-xs px-1.5 py-0.5 rounded hover:bg-slate-700"
                  >↓</button>
                  <button
                    onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                    className="text-slate-600 hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-slate-700 ml-auto"
                  >✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {items.length > 0 && mode === 'edit' && (
          <div className="p-2 border-t border-slate-700 shrink-0">
            <button
              onClick={() => setItems([])}
              className="w-full text-xs py-1.5 text-slate-600 hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          </div>
        )}

        {mode === 'run' && (
          <div className="p-2 border-t border-slate-700 shrink-0">
            <p className="text-slate-600 text-xs text-center">← → arrow keys to navigate</p>
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      {mode === 'edit' ? (
        <div className="flex-1 flex flex-col p-5 overflow-y-auto">
          <div className="flex gap-2 mb-5 max-w-md">
            <button
              onClick={() => setAddType('verse')}
              className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                addType === 'verse'
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              + Add Verse
            </button>
            <button
              onClick={() => setAddType('song')}
              className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                addType === 'song'
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              + Add Song
            </button>
          </div>

          {addType === 'verse' && (
            <div className="space-y-3 max-w-md">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-slate-400 text-xs mb-1 block">Book</label>
                  <select
                    value={vBook}
                    onChange={(e) => setVBook(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500"
                  >
                    {BIBLE_BOOKS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Chapter</label>
                  <input
                    type="number" min="1" value={vChapter}
                    onChange={(e) => setVChapter(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Verse</label>
                  <input
                    type="number" min="1" value={vVerse}
                    onChange={(e) => setVVerse(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 items-end">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">To verse (range)</label>
                  <input
                    type="number" min="1" value={vVerseEnd}
                    onChange={(e) => setVVerseEnd(e.target.value)}
                    placeholder="e.g. 18"
                    className="w-24 bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Translation</label>
                  <select
                    value={vTrans}
                    onChange={(e) => setVTrans(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500"
                  >
                    {TRANSLATIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={addVerse}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
              >
                Add to Service Plan
              </button>
            </div>
          )}

          {addType === 'song' && (
            <div className="max-w-md space-y-3">
              <input
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                placeholder="Search songs..."
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
              <div className="space-y-1.5">
                {songResults.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => addSong(song)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-800/60 hover:bg-indigo-900/30 border border-slate-700 hover:border-indigo-500/50 rounded-lg text-left transition-colors group"
                  >
                    <span>🎵</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{song.title}</p>
                      <p className="text-slate-500 text-xs">{song.artist || 'Unknown artist'}</p>
                    </div>
                    <span className="text-slate-600 group-hover:text-indigo-400 text-xs transition-colors shrink-0">+ Add</span>
                  </button>
                ))}
                {songResults.length === 0 && (
                  <p className="text-slate-600 text-sm text-center py-6">No songs found</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Run mode right panel */
        <div className="flex-1 flex flex-col p-5 overflow-y-auto">
          {activeIndex === null ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-slate-500 text-sm text-center">
                Click an item on the left to show it on the projector
              </p>
              {items.length > 0 && (
                <button
                  onClick={() => showItem(0)}
                  className="px-5 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                >
                  ▶ Start Service
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
                <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">Now Showing</p>
                <p className="text-white font-semibold">{items[activeIndex]?.label}</p>
              </div>

              {/* Song sections */}
              {songSections && (
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Song Sections</p>
                  <div className="space-y-1.5">
                    {songSections.sections.map((section, i) => (
                      <button
                        key={i}
                        onClick={() => showSection(i)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                          activeSectionIndex === i
                            ? 'border-green-500/60 bg-green-900/20 text-white'
                            : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        <p className="text-xs font-medium">
                          {section[0]?.startsWith('[') ? section[0] : `Section ${i + 1}`}
                        </p>
                        {!section[0]?.startsWith('[') && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {section.join(' ').slice(0, 70)}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prev / Next navigation */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => activeIndex > 0 && showItem(activeIndex - 1)}
                  disabled={activeIndex === 0}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-sm rounded-lg transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => activeIndex < items.length - 1 && showItem(activeIndex + 1)}
                  disabled={activeIndex === items.length - 1}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-sm rounded-lg transition-colors"
                >
                  Next →
                </button>
              </div>

              {/* Up next */}
              {activeIndex < items.length - 1 && (
                <div className="mt-1 pt-3 border-t border-slate-800">
                  <p className="text-slate-600 text-xs mb-1.5">Up next</p>
                  <button
                    onClick={() => showItem(activeIndex + 1)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 rounded-lg text-left transition-colors"
                  >
                    <span className="text-sm">{items[activeIndex + 1]?.type === 'verse' ? '📖' : '🎵'}</span>
                    <span className="text-slate-300 text-sm truncate">{items[activeIndex + 1]?.label}</span>
                    <span className="ml-auto text-slate-500 text-xs shrink-0">→</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
