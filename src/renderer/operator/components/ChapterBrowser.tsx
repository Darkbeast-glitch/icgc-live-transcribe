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

  // Search state
  const [searchInput, setSearchInput] = useState('')
  const [searchError, setSearchError] = useState('')
  const [jumpVerse, setJumpVerse] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeVerse) {
      setBook(activeVerse.book)
      setChapter(activeVerse.chapter)
      setJumpVerse(null)
    }
  }, [activeVerse])

  useEffect(() => { loadChapter() }, [book, chapter, translation])

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [verses, activeVerse, jumpVerse])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        searchInputRef.current && !searchInputRef.current.contains(e.target as Node) &&
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadChapter = useCallback(async () => {
    setLoading(true)
    setVerses([])
    const result = await window.api.getChapter({ book, chapter, translation })
    if (result.success && result.verses) setVerses(result.verses)
    setLoading(false)
  }, [book, chapter, translation])

  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    setSearchError('')

    // Show book suggestions only while the user is still typing the book name
    // (i.e., no digits yet in the input)
    const hasDigit = /\d/.test(val)
    if (!hasDigit && val.trim().length > 0) {
      const q = val.trim().toLowerCase()
      const matches = BIBLE_BOOKS.filter((b) =>
        b.toLowerCase().startsWith(q) ||
        b.toLowerCase().replace(/\s/g, '').startsWith(q.replace(/\s/g, ''))
      ).slice(0, 8)
      setSuggestions(matches)
      setSuggestionIndex(0)
      setShowSuggestions(matches.length > 0)
    } else {
      setShowSuggestions(false)
      setSuggestions([])
    }
  }

  const selectSuggestion = (bookName: string, jumpImmediately = false) => {
    setShowSuggestions(false)
    setSuggestions([])
    if (jumpImmediately) {
      // Enter key on a suggestion → jump straight to chapter 1:1
      setSearchInput('')
      setJumpVerse(1)
      setBook(bookName)
      setChapter(1)
    } else {
      // Mouse click → fill name so user can type chapter:verse
      setSearchInput(bookName + ' ')
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggestionIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (suggestions[suggestionIndex]) selectSuggestion(suggestions[suggestionIndex], true)
        return
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false)
        return
      }
    }
    if (e.key === 'Enter') handleSearchJump()
  }

  const resolveBook = (rawBook: string): string | undefined =>
    BIBLE_BOOKS.find((b) => b.toLowerCase() === rawBook.toLowerCase()) ||
    BIBLE_BOOKS.find((b) => b.toLowerCase().startsWith(rawBook.toLowerCase())) ||
    BIBLE_BOOKS.find((b) =>
      b.toLowerCase().replace(/\s/g, '').startsWith(rawBook.toLowerCase().replace(/\s/g, ''))
    )

  const handleSearchJump = () => {
    const raw = searchInput.trim()
    if (!raw) return
    setSearchError('')
    setShowSuggestions(false)

    // "Book Chapter:Verse" — full reference
    const fullMatch = raw.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)/)
    if (fullMatch) {
      const resolved = resolveBook(fullMatch[1].trim())
      if (!resolved) { setSearchError(`Book not found: "${fullMatch[1].trim()}"`); return }
      setSearchInput(''); setJumpVerse(parseInt(fullMatch[3])); setBook(resolved); setChapter(parseInt(fullMatch[2]))
      return
    }

    // "Book Chapter" — no verse, default to verse 1
    const chapterMatch = raw.match(/^(.+?)\s+(\d+)$/)
    if (chapterMatch) {
      const resolved = resolveBook(chapterMatch[1].trim())
      if (!resolved) { setSearchError(`Book not found: "${chapterMatch[1].trim()}"`); return }
      setSearchInput(''); setJumpVerse(1); setBook(resolved); setChapter(parseInt(chapterMatch[2]))
      return
    }

    // Just a book name — default to chapter 1, verse 1
    const resolved = resolveBook(raw)
    if (resolved) {
      setSearchInput(''); setJumpVerse(1); setBook(resolved); setChapter(1)
      return
    }

    setSearchError(`Try "John", "John 3", or "John 3:16"`)
  }

  const buildItem = async (v: VerseRow): Promise<QueueItem | null> => {
    const res = await window.api.getVerse({ book, chapter, verse: v.verse, translation })
    if (!res.success) return null
    return {
      id: genId(), reference: res.reference!, book, chapter, verse: v.verse,
      text: res.text!, translation: res.translation!, source: 'manual',
    }
  }

  const handlePreview = async (v: VerseRow) => {
    setJumpVerse(null)
    const item = await buildItem(v)
    if (item) onPreview(item)
  }

  const handlePresent = async (v: VerseRow) => {
    setJumpVerse(null)
    const item = await buildItem(v)
    if (item) onPresent(item)
  }

  const handleQueue = async (v: VerseRow) => {
    const item = await buildItem(v)
    if (item) onAddToQueue(item)
  }

  const isActive = (v: VerseRow) => {
    if (jumpVerse !== null) return v.verse === jumpVerse
    return activeVerse?.book === book && activeVerse?.chapter === chapter && activeVerse?.verse === v.verse
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar with autocomplete */}
      <div className="px-4 pt-3 pb-2 border-b border-[#252528] shrink-0 bg-[#0e0e11]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => {
                if (suggestions.length > 0 && !/\d/.test(searchInput)) setShowSuggestions(true)
              }}
              placeholder='Search scripture e.g. "John 3:16" or "Romans 8:28"'
              className="w-full bg-[#1a1a1e] border border-[#333338] text-white text-xs px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-orange-500 placeholder-slate-600 transition-colors"
            />
            {searchInput && (
              <button
                onMouseDown={(e) => { e.preventDefault(); setSearchInput(''); setSearchError(''); setShowSuggestions(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 text-sm"
              >✕</button>
            )}

            {/* Autocomplete dropdown */}
            {showSuggestions && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1e] border border-[#333338] rounded-lg shadow-2xl z-50 overflow-hidden"
              >
                {suggestions.map((b, i) => (
                  <button
                    key={b}
                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(b) }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                      i === suggestionIndex
                        ? 'bg-orange-500/20 text-orange-300'
                        : 'text-slate-300 hover:bg-[#252528] hover:text-white'
                    }`}
                  >
                    <span className="text-slate-500 text-[10px] font-mono w-4">{i + 1}</span>
                    {b}
                  </button>
                ))}
                <div className="px-3 py-1.5 border-t border-[#252528] text-[10px] text-slate-600">
                  ↑↓ navigate · Enter to select · then type chapter:verse
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleSearchJump}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
          >
            Go
          </button>
        </div>
        {searchError && (
          <p className="text-red-400 text-[10px] mt-1.5 ml-1">{searchError}</p>
        )}
      </div>

      {/* Chapter nav bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#252528] shrink-0 bg-[#0e0e11]">
        <div className="flex items-center gap-2">
          <select
            value={book}
            onChange={(e) => { setBook(e.target.value); setChapter(1); setJumpVerse(null) }}
            className="bg-[#1a1a1e] text-white text-xs rounded px-2 py-1.5 border border-[#333338] focus:outline-none focus:border-orange-500 max-w-[140px]"
          >
            {BIBLE_BOOKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>

          <div className="flex items-center gap-1">
            <button
              onClick={() => { setChapter((c) => Math.max(1, c - 1)); setJumpVerse(null) }}
              className="w-6 h-6 flex items-center justify-center bg-[#1a1a1e] border border-[#333338] text-slate-400 hover:text-white rounded text-xs transition-colors"
            >‹</button>
            <input
              type="number" min="1" max={150} value={chapter}
              onChange={(e) => { setChapter(Math.max(1, parseInt(e.target.value) || 1)); setJumpVerse(null) }}
              className="w-10 bg-[#1a1a1e] border border-[#333338] text-white text-xs px-1.5 py-1 rounded text-center focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={() => { setChapter((c) => c + 1); setJumpVerse(null) }}
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
          const isJumped = jumpVerse !== null && v.verse === jumpVerse
          return (
            <div
              key={v.verse}
              ref={active ? activeRef : undefined}
              onClick={() => handlePreview(v)}
              onDoubleClick={(e) => { e.preventDefault(); handlePresent(v) }}
              className={`flex items-center gap-3 px-4 py-2 border-b border-[#1a1a1e] transition-colors cursor-pointer select-none ${
                active
                  ? isJumped
                    ? 'bg-orange-950/20 border-l-2 border-l-orange-400'
                    : 'bg-orange-950/30 border-l-2 border-l-orange-500'
                  : 'hover:bg-[#161619]'
              }`}
            >
              <span className={`text-xs font-mono w-5 text-right shrink-0 ${active ? 'text-orange-400' : 'text-slate-700'}`}>
                {v.verse}
              </span>

              <p className={`flex-1 text-sm leading-relaxed min-w-0 ${active ? 'text-white' : 'text-slate-400'} transition-colors`}>
                {v.text}
              </p>

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
