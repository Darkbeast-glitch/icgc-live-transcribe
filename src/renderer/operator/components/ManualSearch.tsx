import { useState, useEffect } from 'react'
import { BIBLE_BOOKS, VerseResult, NowShowingInfo } from '@shared/types'

interface Props {
  translation: string
  onDisplay?: (info: NowShowingInfo) => void
}

interface SemanticResult {
  book: string
  chapter: number
  verse: number
  text: string
  reference: string
  score: number
}

type SearchMode = 'reference' | 'smart'

export default function ManualSearch({ translation, onDisplay }: Props) {
  const [mode, setMode] = useState<SearchMode>('reference')

  // Reference search state
  const [book, setBook] = useState('John')
  const [chapter, setChapter] = useState('3')
  const [verse, setVerse] = useState('16')
  const [verseEnd, setVerseEnd] = useState('')
  const [result, setResult] = useState<VerseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [rawInput, setRawInput] = useState('')

  // Smart search state
  const [smartQuery, setSmartQuery] = useState('')
  const [smartResults, setSmartResults] = useState<SemanticResult[]>([])
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartError, setSmartError] = useState('')
  const [smartStatus, setSmartStatus] = useState<{
    indexed: number; cached: number; modelReady: boolean; modelLoading: boolean
  } | null>(null)

  useEffect(() => {
    if (mode === 'smart') {
      window.api.getSemanticStatus().then(setSmartStatus)
      window.api.onSemanticModelReady(() => {
        window.api.getSemanticStatus().then(setSmartStatus)
      })
      window.api.onSemanticIndexingProgress((data) => {
        if (data.complete) window.api.getSemanticStatus().then(setSmartStatus)
        else setSmartStatus((prev) => prev ? { ...prev, indexed: data.done } : prev)
      })
    }
  }, [mode])

  // ── Reference search ──────────────────────────────────────────
  const doSearch = async (b: string, ch: string, v: string, ve: string) => {
    if (!b || !ch || !v) return
    setLoading(true)
    setResult(null)

    let res: VerseResult
    if (ve) {
      res = await window.api.getVerseRange({
        book: b, chapter: parseInt(ch), verseStart: parseInt(v), verseEnd: parseInt(ve), translation
      })
    } else {
      res = await window.api.getVerse({ book: b, chapter: parseInt(ch), verse: parseInt(v), translation })
    }

    setResult(res)
    setLoading(false)

    if (res.success) {
      window.api.showVerse({ text: res.text!, reference: res.reference!, translation: res.translation! })
      window.api.addHistory({ type: 'verse', reference: res.reference, content: res.text!, translation: res.translation })
      onDisplay?.({ type: 'verse', label: res.reference!, translation: res.translation })
    }
  }

  const handleRawSubmit = () => {
    const match = rawInput.trim().match(/^(.+?)\s+(\d+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?$/)
    if (!match) { doSearch(book, chapter, verse, verseEnd); return }

    const rawBook = match[1].trim()
    const ch = match[2], v = match[3], ve = match[4] || ''
    const resolved =
      BIBLE_BOOKS.find((b) => b.toLowerCase() === rawBook.toLowerCase()) ||
      BIBLE_BOOKS.find((b) => b.toLowerCase().startsWith(rawBook.toLowerCase())) ||
      BIBLE_BOOKS.find((b) =>
        b.toLowerCase().replace(/\s/g, '').startsWith(rawBook.toLowerCase().replace(/\s/g, ''))
      )

    if (!resolved) { setResult({ success: false, error: `Could not find book: "${rawBook}"` }); return }

    setBook(resolved); setChapter(ch); setVerse(v); setVerseEnd(ve)
    doSearch(resolved, ch, v, ve)
  }

  // ── Smart search ──────────────────────────────────────────────
  const doSmartSearch = async () => {
    if (!smartQuery.trim()) return
    setSmartLoading(true)
    setSmartError('')
    setSmartResults([])

    const { results, empty, error } = await window.api.semanticSearch(smartQuery)
    setSmartLoading(false)

    if (error) { setSmartError(error); return }
    if (empty) { setSmartError('No verses are indexed yet. Go to Settings → Build Index first.'); return }
    setSmartResults(results)
    // Refresh status (model may have loaded for the first time)
    window.api.getSemanticStatus().then(setSmartStatus)
  }

  const showSmartResult = (r: SemanticResult) => {
    window.api.showVerse({ text: r.text, reference: r.reference, translation: 'KJV' })
    window.api.addHistory({ type: 'verse', reference: r.reference, content: r.text, translation: 'KJV' })
    onDisplay?.({ type: 'verse', label: r.reference, translation: 'KJV' })
  }

  const notIndexed = smartStatus && smartStatus.indexed === 0

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle */}
      <div className="flex gap-1 p-3 border-b border-slate-700 shrink-0">
        <button
          onClick={() => setMode('reference')}
          className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
            mode === 'reference'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          By Reference
        </button>
        <button
          onClick={() => setMode('smart')}
          className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${
            mode === 'smart'
              ? 'bg-purple-700 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          ✨ Smart Search
        </button>
      </div>

      {/* ── Reference mode ── */}
      {mode === 'reference' && (
        <div className="flex flex-col p-4 max-w-2xl mx-auto w-full overflow-y-auto">
          <div className="flex gap-2 mb-4">
            <input
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRawSubmit()}
              placeholder='Type reference e.g. "Romans 8:28" or "1 Cor 13:4-7" then Enter'
              className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />
            <button
              onClick={handleRawSubmit}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded transition-colors"
            >
              Go
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4 text-slate-500 text-xs">
            <div className="flex-1 h-px bg-slate-700" />
            <span>or select manually</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Book</label>
              <select
                value={book} onChange={(e) => setBook(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-2 rounded focus:outline-none focus:border-indigo-500"
              >
                {BIBLE_BOOKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Chapter</label>
              <input type="number" min="1" value={chapter} onChange={(e) => setChapter(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-2 rounded focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Verse</label>
              <input type="number" min="1" value={verse} onChange={(e) => setVerse(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-2 py-2 rounded focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="text-slate-400 text-xs">To verse (optional range):</label>
            <input type="number" min="1" value={verseEnd} onChange={(e) => setVerseEnd(e.target.value)}
              placeholder="e.g. 20"
              className="w-24 bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500" />
          </div>

          <button
            onClick={() => doSearch(book, chapter, verse, verseEnd)}
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded transition-colors"
          >
            {loading ? 'Fetching...' : `Show on Projector (${translation})`}
          </button>

          {result && (
            <div className="mt-4">
              {result.success ? (
                <div className="p-4 bg-slate-800 border border-slate-600 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-white font-semibold">{result.reference}</h3>
                    <span className="text-indigo-400 text-xs">{result.translation}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{result.text}</p>
                  <p className="text-green-400 text-xs mt-3">✓ Sent to projector</p>
                </div>
              ) : (
                <div className="p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
                  {result.error || 'Verse not found.'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Smart Search mode ── */}
      {mode === 'smart' && (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-700 shrink-0">
            {notIndexed && (
              <div className="mb-3 p-3 bg-amber-900/40 border border-amber-700/60 rounded-lg text-amber-300 text-xs">
                No verses indexed yet. Go to <strong>Settings → Semantic Verse Index → Build Index</strong> to enable Smart Search.
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={smartQuery}
                onChange={(e) => setSmartQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSmartSearch()}
                placeholder='e.g. "God so loved the world" or "I can do all things" or "faith without works"'
                className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-purple-500 placeholder-slate-500"
              />
              <button
                onClick={doSmartSearch}
                disabled={smartLoading || !smartQuery.trim()}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm rounded transition-colors"
              >
                {smartLoading ? '...' : 'Search'}
              </button>
            </div>
            {smartStatus && (
              <p className="text-slate-600 text-xs mt-2">
                {smartStatus.indexed.toLocaleString()} verses indexed (KJV)
                {!smartStatus.modelReady && smartLoading && ' · Loading AI model for first time…'}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {smartLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">
                    {smartStatus && !smartStatus.modelReady
                      ? 'Loading AI model (first time only)…'
                      : 'Searching…'}
                  </p>
                </div>
              </div>
            )}

            {smartError && (
              <div className="p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
                {smartError}
              </div>
            )}

            {!smartLoading && smartResults.length === 0 && !smartError && smartQuery && (
              <p className="text-slate-600 text-sm text-center py-8">No results</p>
            )}

            {!smartLoading && smartResults.length === 0 && !smartQuery && (
              <p className="text-slate-600 text-sm text-center py-8">
                Type a phrase or paraphrase above and press Search
              </p>
            )}

            {smartResults.map((r, i) => {
              const pct = Math.round(r.score * 100)
              return (
                <button
                  key={i}
                  onClick={() => showSmartResult(r)}
                  className="w-full text-left p-3 bg-slate-800/60 hover:bg-purple-900/20 border border-slate-700 hover:border-purple-500/50 rounded-xl transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white text-sm font-semibold">{r.reference}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Similarity bar */}
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-slate-500 text-xs w-8 text-right">{pct}%</span>
                      <span className="text-slate-600 group-hover:text-purple-400 text-xs transition-colors">→</span>
                    </div>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">{r.text}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
