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

// Common abbreviations and alternate spellings → canonical BIBLE_BOOKS name
const BOOK_ABBR: Record<string, string> = {
  // Genesis
  'gen':'Genesis','ge':'Genesis',
  // Exodus
  'ex':'Exodus','exo':'Exodus','exod':'Exodus',
  // Leviticus
  'lev':'Leviticus','le':'Leviticus','lv':'Leviticus',
  // Numbers
  'num':'Numbers','nu':'Numbers','nm':'Numbers','numb':'Numbers',
  // Deuteronomy
  'deut':'Deuteronomy','deu':'Deuteronomy','dt':'Deuteronomy',
  // Joshua
  'josh':'Joshua','jos':'Joshua',
  // Judges
  'judg':'Judges','jdg':'Judges','jg':'Judges',
  // Ruth
  'ru':'Ruth',
  // Samuel
  '1sam':'1 Samuel','1sa':'1 Samuel','1s':'1 Samuel',
  '2sam':'2 Samuel','2sa':'2 Samuel','2s':'2 Samuel',
  // Kings
  '1kgs':'1 Kings','1ki':'1 Kings','1k':'1 Kings',
  '2kgs':'2 Kings','2ki':'2 Kings','2k':'2 Kings',
  // Chronicles
  '1chr':'1 Chronicles','1ch':'1 Chronicles','1chron':'1 Chronicles',
  '2chr':'2 Chronicles','2ch':'2 Chronicles','2chron':'2 Chronicles',
  // Ezra / Nehemiah / Esther
  'ezr':'Ezra','neh':'Nehemiah','ne':'Nehemiah','est':'Esther','esth':'Esther',
  // Poetry
  'ps':'Psalms','psa':'Psalms','psalm':'Psalms',
  'prov':'Proverbs','pro':'Proverbs','pr':'Proverbs','prv':'Proverbs',
  'ecc':'Ecclesiastes','eccl':'Ecclesiastes','qoh':'Ecclesiastes',
  'sos':'Song of Solomon','song':'Song of Solomon','ss':'Song of Solomon','sg':'Song of Solomon',
  // Major Prophets
  'isa':'Isaiah','is':'Isaiah',
  'jer':'Jeremiah','je':'Jeremiah',
  'lam':'Lamentations','la':'Lamentations',
  'ezek':'Ezekiel','eze':'Ezekiel','ezk':'Ezekiel',
  'dan':'Daniel','da':'Daniel','dn':'Daniel',
  // Minor Prophets
  'hos':'Hosea','ho':'Hosea',
  'jl':'Joel',
  'amos':'Amos','am':'Amos',
  'obad':'Obadiah','ob':'Obadiah',
  'jon':'Jonah',
  'mic':'Micah','mi':'Micah',
  'nah':'Nahum','na':'Nahum',
  'hab':'Habakkuk',
  'zeph':'Zephaniah','zep':'Zephaniah','zp':'Zephaniah',
  'hag':'Haggai','hg':'Haggai',
  'zech':'Zechariah','zec':'Zechariah','zc':'Zechariah',
  'mal':'Malachi','ml':'Malachi',
  // Gospels / Acts
  'matt':'Matthew','mat':'Matthew','mt':'Matthew',
  'mk':'Mark','mar':'Mark',
  'lk':'Luke',
  'jn':'John','joh':'John',
  'act':'Acts','ac':'Acts',
  // Paul's letters
  'rom':'Romans','ro':'Romans','rm':'Romans',
  '1cor':'1 Corinthians','1co':'1 Corinthians',
  '2cor':'2 Corinthians','2co':'2 Corinthians',
  'gal':'Galatians','ga':'Galatians',
  'eph':'Ephesians',
  'phil':'Philippians','php':'Philippians','pp':'Philippians',
  'col':'Colossians',
  '1thess':'1 Thessalonians','1th':'1 Thessalonians','1thes':'1 Thessalonians',
  '2thess':'2 Thessalonians','2th':'2 Thessalonians','2thes':'2 Thessalonians',
  '1tim':'1 Timothy','1ti':'1 Timothy','1tm':'1 Timothy',
  '2tim':'2 Timothy','2ti':'2 Timothy','2tm':'2 Timothy',
  'tit':'Titus','ti':'Titus',
  'phlm':'Philemon','phm':'Philemon','phile':'Philemon',
  'heb':'Hebrews','he':'Hebrews',
  // General letters
  'jas':'James','jm':'James',
  '1pet':'1 Peter','1pe':'1 Peter','1pt':'1 Peter',
  '2pet':'2 Peter','2pe':'2 Peter','2pt':'2 Peter',
  '1jn':'1 John','1jo':'1 John',
  '2jn':'2 John','2jo':'2 John',
  '3jn':'3 John','3jo':'3 John',
  'jude':'Jude','jud':'Jude',
  // Revelation
  'rev':'Revelation','re':'Revelation','apoc':'Revelation',
}

// Normalise raw input before parsing: strip correction phrases, expand ordinals,
// remove "chapter"/"verse" filler words so "John chapter 3 verse 16" → "John 3 16"
function normalizeSearchInput(raw: string): string {
  let s = raw.trim()

  // If the operator corrects themselves ("sorry", "I mean", etc.), take everything after
  const correctionRe = /\b(sorry|i mean|correction|actually|wait|oops|no,?)\b[,\s]+/i
  const corrIdx = s.search(correctionRe)
  if (corrIdx !== -1) {
    const after = s.slice(corrIdx).replace(correctionRe, '').trim()
    if (after.length > 1) s = after
  }

  // Written-out and suffix ordinals → digits
  s = s.replace(/\bfirst\b/gi, '1').replace(/\bsecond\b/gi, '2').replace(/\bthird\b/gi, '3')
  s = s.replace(/\b1st\b/gi, '1').replace(/\b2nd\b/gi, '2').replace(/\b3rd\b/gi, '3')

  // Remove filler navigation words (keep colons/digits for the regex)
  s = s.replace(/\bchapters?\b/gi, ' ')
  s = s.replace(/\bch\b/gi, ' ')
  s = s.replace(/\bverses?\b/gi, ' ')
  s = s.replace(/\bver\b/gi, ' ')
  // "v" or "vs" only when surrounded by space/digit, not inside a word
  s = s.replace(/(?<=\s)v(?=\s)/gi, ' ').replace(/(?<=\d)\s*v\s*(?=\d)/gi, ':')
  s = s.replace(/\bvs\b/gi, ' ')

  // Clean up spacing around colons and collapse multiple spaces
  s = s.replace(/\s*:\s*/g, ':').replace(/\s+/g, ' ').trim()

  return s
}

// How many leading characters of `book` the typed query accounts for, so the
// dropdown can highlight the part already typed. Spaces in the book name are free,
// which keeps "1cor" highlighting the whole of "1 Cor" in "1 Corinthians".
// Returns 0 when the query isn't a prefix of the book at all.
function matchedPrefixLength(book: string, query: string): number {
  const q = query.trim().toLowerCase().replace(/\s+/g, '')
  if (!q) return 0
  const b = book.toLowerCase()
  let qi = 0
  let i = 0
  for (; i < b.length && qi < q.length; i++) {
    if (b[i] === ' ') continue
    if (b[i] !== q[qi]) return 0
    qi++
  }
  return qi === q.length ? i : 0
}

// Indices of the first `count` non-space characters of `book`.
function prefixHits(book: string, count: number): number[] {
  const hits: number[] = []
  for (let i = 0; i < book.length && hits.length < count; i++) {
    if (book[i] !== ' ') hits.push(i)
  }
  return hits
}

// Characters of `book` matched by typing `q`'s letters in order, skipping gaps.
// Lets "jn" find John and "rmns" find Romans. Null when the letters don't all appear.
function subsequenceHits(book: string, q: string): number[] | null {
  const b = book.toLowerCase()
  const hits: number[] = []
  let qi = 0
  for (let i = 0; i < b.length && qi < q.length; i++) {
    if (b[i] === q[qi]) { hits.push(i); qi++ }
  }
  return qi === q.length ? hits : null
}

// Levenshtein distance, abandoned early once it provably exceeds `max`.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

interface BookMatch { book: string; tier: number; hits: number[] }

// Books that actually get preached from, most-used first. Used only to order
// candidates that already matched — canonical Bible order buries John under eight
// minor prophets for a query like "jk", which is never what the operator meant.
const COMMON_BOOKS = [
  'John', 'Psalms', 'Matthew', 'Romans', 'Genesis', 'Proverbs', 'Luke', 'Acts',
  'Isaiah', 'Ephesians', 'Philippians', '1 Corinthians', 'Hebrews', 'James',
  'Mark', '2 Corinthians', 'Galatians', 'Colossians', '1 Peter', 'Revelation',
  'Jeremiah', 'Exodus', 'Deuteronomy', 'Joshua', '1 John', 'Daniel', 'Job',
]
const COMMON_RANK = new Map(COMMON_BOOKS.map((b, i) => [b, i]))

// Ranks books against what has been typed, most literal match first:
//   tier 0 — the typed text is a real prefix ("jos" → Joshua)
//   tier 1 — the letters appear in order ("jn" → John, "1cr" → 1 Corinthians)
//   tier 2 — one or two typos away ("jk" → John)
// Tiers keep exact typing authoritative: a correct prefix is never displaced by a
// fuzzy guess. Within a tier, canonical Bible order wins.
function rankBooks(query: string, limit = 8): BookMatch[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, '')
  if (!q) return []

  const scored: { m: BookMatch; order: number }[] = []

  BIBLE_BOOKS.forEach((book, order) => {
    const n = matchedPrefixLength(book, q)
    if (n > 0) { scored.push({ m: { book, tier: 0, hits: prefixHits(book, q.length) }, order }); return }

    const sub = subsequenceHits(book, q)
    if (sub) { scored.push({ m: { book, tier: 1, hits: sub }, order }); return }

    // Typo tolerance, compared against an equal-length slice of the book name so
    // "jk" is measured against "jo", not against all of "john".
    const bare = book.toLowerCase().replace(/\s+/g, '')
    const max = q.length <= 3 ? 1 : 2
    if (q.length >= 2 && editDistance(q, bare.slice(0, q.length), max) <= max) {
      scored.push({ m: { book, tier: 2, hits: prefixHits(book, q.length) }, order })
    }
  })

  const common = (book: string) => COMMON_RANK.get(book) ?? COMMON_BOOKS.length
  return scored
    .sort((a, b) =>
      a.m.tier - b.m.tier ||
      common(a.m.book) - common(b.m.book) ||
      a.order - b.order
    )
    .slice(0, limit)
    .map((s) => s.m)
}

export default function ChapterBrowser({ translation, activeVerse, onPresent, onPreview, onAddToQueue }: Props) {
  const [book, setBook] = useState('John')
  const [chapter, setChapter] = useState(3)
  const [verses, setVerses] = useState<VerseRow[]>([])
  const [loading, setLoading] = useState(false)

  // Search state
  const [searchInput, setSearchInput] = useState('')
  const [searchError, setSearchError] = useState('')
  const [jumpVerse, setJumpVerse] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<BookMatch[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Range selection state
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null)
  const [rangeEnd, setRangeEnd] = useState<number | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // NOTE: We intentionally do NOT sync activeVerse → book/chapter navigation.
  // Doing so locks the browser whenever a verse is presented. The operator
  // should be free to browse freely while content is live on screen.

  useEffect(() => { loadChapter() }, [book, chapter, translation])

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [verses, jumpVerse])

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
    setRangeAnchor(null)
    setRangeEnd(null)
    const result = await window.api.getChapter({ book, chapter, translation })
    if (result.success && result.verses) setVerses(result.verses)
    setLoading(false)
  }, [book, chapter, translation])

  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    setSearchError('')
    const hasDigit = /\d/.test(val)
    if (!hasDigit && val.trim().length > 0) {
      const matches = rankBooks(val)
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
      setSearchInput(''); setJumpVerse(1); setBook(bookName); setChapter(1)
    } else {
      setSearchInput(bookName + ' ')
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter') { e.preventDefault(); if (suggestions[suggestionIndex]) selectSuggestion(suggestions[suggestionIndex].book, true); return }
      // Tab completes the book name in place so you can keep typing chapter:verse
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); if (suggestions[suggestionIndex]) selectSuggestion(suggestions[suggestionIndex].book); return }
      // Right arrow does the same, but only at the end of the text so it stays a cursor key mid-word
      if (e.key === 'ArrowRight') {
        const atEnd = e.currentTarget.selectionStart === searchInput.length && e.currentTarget.selectionEnd === searchInput.length
        if (atEnd && suggestions[suggestionIndex]) { e.preventDefault(); selectSuggestion(suggestions[suggestionIndex].book) }
        return
      }
      if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); setSuggestionIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Escape') { setShowSuggestions(false); return }
    }
    if (e.key === 'Enter') handleSearchJump()
  }

  const resolveBook = (rawBook: string): string | undefined => {
    const lower = rawBook.toLowerCase().trim()
    const noSpaces = lower.replace(/\s+/g, '')
    // Exact BIBLE_BOOKS match
    const exact = BIBLE_BOOKS.find((b) => b.toLowerCase() === lower)
    if (exact) return exact
    // Abbreviation map (try with and without spaces)
    if (BOOK_ABBR[noSpaces]) return BOOK_ABBR[noSpaces]
    if (BOOK_ABBR[lower]) return BOOK_ABBR[lower]
    // Starts-with match (handles partial names like "Cor" → "1 Corinthians" fallback)
    const startsWith =
      BIBLE_BOOKS.find((b) => b.toLowerCase().startsWith(lower)) ||
      BIBLE_BOOKS.find((b) => b.toLowerCase().replace(/\s/g, '').startsWith(noSpaces))
    if (startsWith) return startsWith

    // Last resort: subsequence / typo-tolerant match, so "jk 3:16" still resolves.
    // Only reached where every literal strategy above already failed.
    return rankBooks(rawBook, 1)[0]?.book
  }

  // EasyWorship-style live search: the moment the text parses as a reference we
  // navigate there, no Enter needed. The input keeps its text (unlike Enter, which
  // clears it) so the operator can keep typing "John 3" → "John 3:16" and watch the
  // view follow. Book-only input is left to the suggestion dropdown — jumping on a
  // bare book name fires while you are still typing toward a longer one.
  useEffect(() => {
    const raw = normalizeSearchInput(searchInput)
    if (!raw || !/\d/.test(raw)) return

    const timer = setTimeout(() => {
      const full = raw.match(/^(.+?)\s+(\d+)\s*[:\s]\s*(\d+)$/)
      const match = full || raw.match(/^(.+?)\s+(\d+)$/)
      if (!match) return
      const resolved = resolveBook(match[1].trim())
      if (!resolved) return

      setSearchError('')
      setShowSuggestions(false)
      setBook(resolved)
      setChapter(parseInt(match[2]))
      setJumpVerse(full ? parseInt(full[3]) : 1)
    }, 250)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleSearchJump = () => {
    const raw = normalizeSearchInput(searchInput)
    if (!raw) return
    setSearchError(''); setShowSuggestions(false)

    // "Book Chapter:Verse" or "Book Chapter Verse" (colon optional)
    const fullMatch = raw.match(/^(.+?)\s+(\d+)\s*[:\s]\s*(\d+)$/)
    if (fullMatch) {
      const resolved = resolveBook(fullMatch[1].trim())
      if (!resolved) { setSearchError(`Book not found: "${fullMatch[1].trim()}"`); return }
      setSearchInput(''); setJumpVerse(parseInt(fullMatch[3])); setBook(resolved); setChapter(parseInt(fullMatch[2]))
      return
    }

    const chapterMatch = raw.match(/^(.+?)\s+(\d+)$/)
    if (chapterMatch) {
      const resolved = resolveBook(chapterMatch[1].trim())
      if (!resolved) { setSearchError(`Book not found: "${chapterMatch[1].trim()}"`); return }
      setSearchInput(''); setJumpVerse(1); setBook(resolved); setChapter(parseInt(chapterMatch[2]))
      return
    }

    const resolved = resolveBook(raw)
    if (resolved) { setSearchInput(''); setJumpVerse(1); setBook(resolved); setChapter(1); return }

    setSearchError(`Try "John", "John 3", "John 3:16" or "John 3 16"`)
  }

  const buildItem = async (v: VerseRow): Promise<QueueItem | null> => {
    const res = await window.api.getVerse({ book, chapter, verse: v.verse, translation })
    if (!res.success) return null
    return {
      id: genId(), reference: res.reference!, book, chapter, verse: v.verse,
      text: res.text!, translation: res.translation!, source: 'manual',
    }
  }

  const buildRangeItem = async (verseStart: number, verseEnd: number): Promise<QueueItem | null> => {
    const res = await window.api.getVerseRange({ book, chapter, verseStart, verseEnd, translation })
    if (!res.success) return null
    return {
      id: genId(), reference: res.reference!, book, chapter, verse: verseStart,
      text: res.text!, translation: res.translation!, source: 'manual',
    }
  }

  // After a search jump, load the target verse (verse 1 for a book/chapter-only
  // search) into Preview so it's ready to push without a second click.
  const autoPreviewedRef = useRef<string | null>(null)
  useEffect(() => {
    if (jumpVerse === null || verses.length === 0) return
    const key = `${book} ${chapter}:${jumpVerse} ${translation}`
    if (autoPreviewedRef.current === key) return
    const row = verses.find((v) => v.verse === jumpVerse)
    if (!row) return
    autoPreviewedRef.current = key
    buildItem(row).then((item) => { if (item) onPreview(item) })
  }, [verses, jumpVerse, book, chapter, translation])

  const handleVerseClick = async (v: VerseRow, e: React.MouseEvent) => {
    setJumpVerse(null)
    if (e.shiftKey && rangeAnchor !== null) {
      // Shift-click: present the range from anchor to this verse
      const start = Math.min(rangeAnchor, v.verse)
      const end = Math.max(rangeAnchor, v.verse)
      setRangeEnd(v.verse)
      const item = await buildRangeItem(start, end)
      if (item) onPresent(item)
    } else {
      // Normal click: preview single verse, set as range anchor
      setRangeAnchor(v.verse)
      setRangeEnd(null)
      const item = await buildItem(v)
      if (item) onPreview(item)
    }
  }

  const handlePresent = async (v: VerseRow) => {
    setJumpVerse(null)
    setRangeAnchor(v.verse)
    setRangeEnd(null)
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

  const isInRange = (v: VerseRow) => {
    if (rangeAnchor === null || rangeEnd === null) return false
    const start = Math.min(rangeAnchor, rangeEnd)
    const end = Math.max(rangeAnchor, rangeEnd)
    return v.verse >= start && v.verse <= end
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 pt-3 pb-2 border-b border-[#252528] shrink-0 bg-[#0e0e11]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => { if (suggestions.length > 0 && !/\d/.test(searchInput)) setShowSuggestions(true) }}
              placeholder='Type a reference — "John 3:16", "John 3 16", "Romans 8"'
              className="w-full bg-[#1a1a1e] border border-[#333338] text-white text-xs px-3 py-2 pr-8 rounded-lg focus:outline-none focus:border-orange-500 placeholder-slate-600 transition-colors"
            />
            {searchInput && (
              <button
                onMouseDown={(e) => { e.preventDefault(); setSearchInput(''); setSearchError(''); setShowSuggestions(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 text-sm"
              >✕</button>
            )}
            {showSuggestions && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1e] border border-[#333338] rounded-lg shadow-2xl z-50 overflow-hidden"
              >
                {suggestions.map((m, i) => {
                  const hit = new Set(m.hits)
                  return (
                    <button
                      key={m.book}
                      onMouseDown={(e) => { e.preventDefault(); selectSuggestion(m.book) }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                        i === suggestionIndex ? 'bg-orange-500/20 text-orange-300' : 'text-slate-300 hover:bg-[#252528] hover:text-white'
                      }`}
                    >
                      <span className="text-slate-500 text-[10px] font-mono w-4">{i + 1}</span>
                      <span>
                        {m.book.split('').map((ch, idx) => (
                          <span key={idx} className={hit.has(idx) ? 'text-white font-semibold' : 'text-slate-500'}>{ch}</span>
                        ))}
                      </span>
                      {m.tier === 2 && <span className="text-slate-600 text-[10px] italic ml-auto">did you mean</span>}
                    </button>
                  )
                })}
                <div className="px-3 py-1.5 border-t border-[#252528] text-[10px] text-slate-600">
                  ↑↓ navigate · Tab or → to complete · Enter to open · then type chapter:verse
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleSearchJump}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
          >Go</button>
        </div>
        {searchError && <p className="text-red-400 text-[10px] mt-1.5 ml-1">{searchError}</p>}
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
        <p className="text-slate-700 text-[10px] italic">click = preview · dbl-click = present · shift+click = range</p>
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
          const inRange = isInRange(v)
          const isJumped = jumpVerse !== null && v.verse === jumpVerse
          return (
            <div
              key={v.verse}
              ref={active ? activeRef : undefined}
              onClick={(e) => handleVerseClick(v, e)}
              onDoubleClick={(e) => { e.preventDefault(); handlePresent(v) }}
              className={`flex items-center gap-3 px-4 py-2 border-b border-[#1a1a1e] transition-colors cursor-pointer select-none ${
                inRange
                  ? 'bg-blue-950/30 border-l-2 border-l-blue-400'
                  : active
                    ? isJumped
                      ? 'bg-orange-950/20 border-l-2 border-l-orange-400'
                      : 'bg-orange-950/30 border-l-2 border-l-orange-500'
                    : 'hover:bg-[#161619]'
              }`}
            >
              <span className={`text-xs font-mono w-5 text-right shrink-0 ${
                inRange ? 'text-blue-400' : active ? 'text-orange-400' : 'text-slate-700'
              }`}>
                {v.verse}
              </span>

              <p className={`flex-1 text-sm leading-relaxed min-w-0 ${
                inRange ? 'text-blue-100' : active ? 'text-white' : 'text-slate-400'
              } transition-colors`}>
                {v.text}
              </p>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setRangeAnchor(v.verse); setRangeEnd(null); buildItem(v).then((item) => { if (item) onPreview(item) }) }}
                  title="Send to Program Preview"
                  className="px-2 py-1 text-[10px] font-medium rounded border border-[#333338] text-slate-400 hover:text-white hover:border-slate-500 bg-[#1a1a1e] hover:bg-[#252528] transition-colors"
                >Preview</button>
                <button
                  onClick={() => handlePresent(v)}
                  title="Present live now"
                  className="px-2 py-1 text-[10px] font-medium rounded bg-orange-500 hover:bg-orange-400 text-white transition-colors"
                >▶</button>
                <button
                  onClick={() => handleQueue(v)}
                  title="Add to queue"
                  className="px-2 py-1 text-[10px] font-medium rounded border border-[#333338] text-slate-500 hover:text-white hover:border-slate-500 bg-[#1a1a1e] hover:bg-[#252528] transition-colors"
                >+Q</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
