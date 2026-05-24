import { useState, useEffect, useRef } from 'react'
import { Song, NowShowingInfo } from '@shared/types'

type View = 'list' | 'display' | 'add' | 'edit' | 'lyrics-bank'

interface Props {
  onDisplay?: (info: NowShowingInfo) => void
}

export default function SongPanel({ onDisplay }: Props) {
  const [view, setView] = useState<View>('list')
  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Song | null>(null)
  const [activeLyricIndex, setActiveLyricIndex] = useState(0)
  const [lyricSections, setLyricSections] = useState<string[][]>([])
  const [autoScroll, setAutoScroll] = useState(false)
  const [scrollSpeed, setScrollSpeed] = useState(10) // seconds per section
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeLyricIndexRef = useRef(0)
  activeLyricIndexRef.current = activeLyricIndex

  // Form state for add/edit
  const [formTitle, setFormTitle] = useState('')
  const [formArtist, setFormArtist] = useState('')
  const [formLyrics, setFormLyrics] = useState('')

  // Lyrics bank state
  interface BankResult { title: string; artist: string }
  const [bankQuery, setBankQuery] = useState('')
  const [bankResults, setBankResults] = useState<BankResult[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [bankError, setBankError] = useState('')
  const [bankPreview, setBankPreview] = useState<{ title: string; artist: string; lyrics: string } | null>(null)
  const [bankFetching, setBankFetching] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)

  useEffect(() => {
    loadSongs()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchSongs()
    }, 200)
    return () => clearTimeout(timeout)
  }, [search])

  const loadSongs = async () => {
    const list = await window.api.listSongs()
    setSongs(list)
  }

  const searchSongs = async () => {
    const list = await window.api.searchSongs(search)
    setSongs(list)
  }

  // Lyrics bank search
  const searchLyricsBank = async () => {
    if (!bankQuery.trim()) return
    setBankLoading(true); setBankError(''); setBankResults([]); setBankPreview(null); setBankSaved(false)
    try {
      const res = await fetch(`https://api.lyrics.ovh/suggest/${encodeURIComponent(bankQuery)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      const results: BankResult[] = (data.data ?? []).slice(0, 20).map((item: { title: string; artist: { name: string } }) => ({
        title: item.title,
        artist: item.artist?.name ?? '',
      }))
      setBankResults(results)
      if (results.length === 0) setBankError('No results found. Try a different search.')
    } catch {
      setBankError('Could not reach lyrics service. Check your internet connection.')
    }
    setBankLoading(false)
  }

  const fetchLyrics = async (title: string, artist: string) => {
    setBankFetching(true); setBankPreview(null); setBankSaved(false)
    try {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setBankPreview({ title, artist, lyrics: data.lyrics ?? '' })
    } catch {
      setBankError(`Lyrics not available for "${title}".`)
    }
    setBankFetching(false)
  }

  const saveBankSong = async () => {
    if (!bankPreview) return
    await window.api.addSong({ title: bankPreview.title, artist: bankPreview.artist, lyrics: bankPreview.lyrics })
    await loadSongs()
    setBankSaved(true)
  }

  // Auto-scroll effect
  useEffect(() => {
    if (autoScrollRef.current) { clearInterval(autoScrollRef.current); autoScrollRef.current = null }
    if (!autoScroll || lyricSections.length === 0) return
    autoScrollRef.current = setInterval(() => {
      const next = activeLyricIndexRef.current + 1
      if (next >= lyricSections.length) {
        setAutoScroll(false)
        return
      }
      showSection(next)
    }, scrollSpeed * 1000)
    return () => { if (autoScrollRef.current) clearInterval(autoScrollRef.current) }
  }, [autoScroll, scrollSpeed, lyricSections])

  const openSong = async (song: Song) => {
    const full = await window.api.getSong(song.id)
    setSelected(full)
    setAutoScroll(false)
    const sections = parseLyricSections(full.lyrics)
    setLyricSections(sections)
    setActiveLyricIndex(0)
    setView('display')
    // Send first section to projector immediately on open
    if (sections.length > 0) {
      const lines = sections[0]
      window.api.showLyrics({ title: full.title, artist: full.artist, lines })
      window.api.addHistory({ type: 'song', reference: full.title, content: lines.join('\n') })
      onDisplay?.({ type: 'lyrics', label: full.title, lines })
    }
  }

  const parseLyricSections = (lyrics: string): string[][] => {
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

  const showSection = (index: number) => {
    if (!selected || !lyricSections[index]) return
    setActiveLyricIndex(index)
    const lines = lyricSections[index]
    window.api.showLyrics({
      title: selected.title,
      artist: selected.artist,
      lines
    })
    window.api.addHistory({
      type: 'song',
      reference: selected.title,
      content: lines.join('\n')
    })
    onDisplay?.({ type: 'lyrics', label: selected.title, lines })
  }

  const openAdd = () => {
    setFormTitle('')
    setFormArtist('')
    setFormLyrics('')
    setView('add')
  }

  const openEdit = () => {
    if (!selected) return
    setFormTitle(selected.title)
    setFormArtist(selected.artist || '')
    setFormLyrics(selected.lyrics || '')
    setView('edit')
  }

  const saveSong = async () => {
    if (!formTitle.trim() || !formLyrics.trim()) return
    if (view === 'add') {
      await window.api.addSong({ title: formTitle, artist: formArtist, lyrics: formLyrics })
    } else if (view === 'edit' && selected) {
      await window.api.updateSong({ id: selected.id, title: formTitle, artist: formArtist, lyrics: formLyrics })
    }
    await loadSongs()
    setView('list')
  }

  const deleteSong = async () => {
    if (!selected) return
    await window.api.deleteSong(selected.id)
    await loadSongs()
    setSelected(null)
    setView('list')
  }

  if (view === 'lyrics-bank') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 shrink-0">
          <button onClick={() => { setView('list'); setBankPreview(null); setBankResults([]) }}
            className="text-slate-400 hover:text-white text-xs">← Back</button>
          <h2 className="text-slate-300 text-sm font-medium flex-1">🌐 Lyrics Bank</h2>
          <span className="text-slate-600 text-xs">Powered by lyrics.ovh</span>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Search column */}
          <div className="flex flex-col w-80 shrink-0 border-r border-slate-700">
            <div className="flex gap-2 p-3 border-b border-slate-700">
              <input
                value={bankQuery}
                onChange={(e) => setBankQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchLyricsBank()}
                placeholder="Song title or artist…"
                className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm px-3 py-1.5 rounded focus:outline-none focus:border-indigo-500 placeholder-slate-500"
              />
              <button
                onClick={searchLyricsBank}
                disabled={bankLoading || !bankQuery.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded transition-colors"
              >
                {bankLoading ? '…' : 'Search'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {bankError && !bankPreview && (
                <p className="text-red-400 text-xs p-3">{bankError}</p>
              )}
              {bankResults.length === 0 && !bankLoading && !bankError && (
                <p className="text-slate-600 text-xs text-center mt-8 px-4">
                  Search for any song — worship, hymns, gospel, and more
                </p>
              )}
              {bankResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setBankError(''); fetchLyrics(r.title, r.artist) }}
                  className="w-full text-left px-3 py-2.5 border-b border-slate-800 hover:bg-slate-800 transition-colors"
                >
                  <p className="text-white text-xs font-medium truncate">{r.title}</p>
                  <p className="text-slate-500 text-[10px] truncate">{r.artist}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview column */}
          <div className="flex-1 flex flex-col min-h-0 p-4">
            {!bankPreview && !bankFetching && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-slate-600 text-sm">Search and click a song to preview its lyrics</p>
              </div>
            )}
            {bankFetching && (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {bankPreview && !bankFetching && (
              <>
                <div className="flex items-start justify-between mb-3 shrink-0">
                  <div>
                    <h3 className="text-white font-semibold">{bankPreview.title}</h3>
                    <p className="text-slate-400 text-sm">{bankPreview.artist}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {bankSaved ? (
                      <span className="text-green-400 text-xs flex items-center gap-1">✓ Saved to library</span>
                    ) : (
                      <button
                        onClick={saveBankSong}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors"
                      >
                        + Save to Library
                      </button>
                    )}
                  </div>
                </div>
                {bankError && <p className="text-red-400 text-xs mb-2">{bankError}</p>}
                <div className="flex-1 overflow-y-auto bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <pre className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {bankPreview.lyrics}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (view === 'display' && selected) {
    return (
      <div className="flex h-full">
        {/* Sections list */}
        <div className="w-56 flex flex-col border-r border-slate-700 bg-slate-800/40">
          <div className="p-3 border-b border-slate-700">
            <button
              onClick={() => { setAutoScroll(false); setView('list') }}
              className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
            >
              ← Back
            </button>
            <h3 className="text-white text-sm font-medium mt-2 truncate">{selected.title}</h3>
            <p className="text-slate-500 text-xs truncate">{selected.artist}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {lyricSections.map((section, i) => (
              <button
                key={i}
                onClick={() => showSection(i)}
                className={`w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                  activeLyricIndex === i
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {section[0]?.startsWith('[') ? (
                  <span className="font-medium">{section[0]}</span>
                ) : (
                  <span className="line-clamp-2">{section.join(' ')}</span>
                )}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-slate-700 space-y-1">
            <button
              onClick={openEdit}
              className="w-full text-xs px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
            >
              Edit Song
            </button>
            <button
              onClick={() => window.api.clearDisplay()}
              className="w-full text-xs px-2 py-1.5 bg-slate-700 hover:bg-red-700/60 text-slate-300 rounded"
            >
              Clear Display
            </button>
          </div>
        </div>

        {/* Lyrics preview */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-white text-lg font-semibold">{selected.title}</h2>
              <p className="text-slate-400 text-sm">{selected.artist}</p>
            </div>
            {/* Auto-scroll controls */}
            <div className="flex items-center gap-2">
              <select
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(Number(e.target.value))}
                className="bg-[#1a1a1e] border border-[#333338] text-slate-300 text-xs rounded px-2 py-1 focus:outline-none"
              >
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={20}>20s</option>
                <option value={30}>30s</option>
              </select>
              <button
                onClick={() => setAutoScroll((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  autoScroll
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-[#1a1a1e] border border-[#333338] text-slate-400 hover:text-white'
                }`}
              >
                {autoScroll ? '⏸ Stop Auto' : '▶ Auto-scroll'}
              </button>
            </div>
          </div>

          {lyricSections[activeLyricIndex] && (
            <div className="bg-slate-800/60 border border-slate-600 rounded-xl p-6">
              {lyricSections[activeLyricIndex].map((line, i) => (
                <p
                  key={i}
                  className={`text-base leading-relaxed ${
                    line.startsWith('[') ? 'text-indigo-400 font-medium mb-1' : 'text-white'
                  }`}
                >
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => showSection(Math.max(0, activeLyricIndex - 1))}
              disabled={activeLyricIndex === 0}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-sm rounded"
            >
              ← Prev
            </button>
            <button
              onClick={() => showSection(Math.min(lyricSections.length - 1, activeLyricIndex + 1))}
              disabled={activeLyricIndex === lyricSections.length - 1}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-sm rounded"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'add' || view === 'edit') {
    const previewSections = parseLyricSections(formLyrics)
    return (
      <div className="flex h-full min-h-0">
        {/* Form */}
        <div className="flex flex-col w-[45%] shrink-0 border-r border-slate-700 p-4 overflow-y-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setView('list')} className="text-slate-400 hover:text-white text-sm">
              ← Cancel
            </button>
            <h2 className="text-slate-300 font-medium">{view === 'add' ? 'Add Song' : 'Edit Song'}</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Title *</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Artist / Author</label>
              <input
                value={formArtist}
                onChange={(e) => setFormArtist(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">
                Lyrics * <span className="text-slate-500">(blank lines = new section)</span>
              </label>
              <textarea
                value={formLyrics}
                onChange={(e) => setFormLyrics(e.target.value)}
                rows={14}
                className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-indigo-500 font-mono resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={saveSong}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded"
              >
                Save Song
              </button>
              {view === 'edit' && (
                <button
                  onClick={deleteSong}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900/40">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 shrink-0">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Preview</span>
            <span className="text-slate-600 text-xs">{previewSections.length} section{previewSections.length !== 1 ? 's' : ''}</span>
          </div>

          {previewSections.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-700 text-sm">Start typing lyrics to see a preview</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {previewSections.map((section, i) => (
                <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  {section.map((line, j) => (
                    <p
                      key={j}
                      className={`text-sm leading-relaxed ${
                        line.startsWith('[') ? 'text-indigo-400 font-medium mb-1' : 'text-white'
                      }`}
                    >
                      {line || ' '}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {formTitle && (
            <div className="px-4 py-2 border-t border-slate-700 shrink-0">
              <p className="text-slate-500 text-xs truncate">
                {formTitle}{formArtist ? ` — ${formArtist}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-slate-700">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search songs..."
          className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-indigo-500 placeholder-slate-500"
        />
        <button
          onClick={() => { setBankQuery(''); setBankResults([]); setBankPreview(null); setBankError(''); setBankSaved(false); setView('lyrics-bank') }}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-sm rounded transition-colors whitespace-nowrap"
        >
          🌐 Lyrics Bank
        </button>
        <button
          onClick={openAdd}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded"
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {songs.length === 0 ? (
          <p className="text-slate-600 text-sm text-center mt-12">No songs found</p>
        ) : (
          songs.map((song) => (
            <button
              key={song.id}
              onClick={() => openSong(song)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-800 hover:bg-slate-800/60 text-left transition-colors"
            >
              <div className="w-8 h-8 bg-indigo-900/60 rounded-lg flex items-center justify-center text-sm">
                🎵
              </div>
              <div>
                <p className="text-white text-sm font-medium">{song.title}</p>
                <p className="text-slate-500 text-xs">{song.artist || 'Unknown artist'}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
