import { useState, useEffect } from 'react'
import { Song, NowShowingInfo } from '@shared/types'

type View = 'list' | 'display' | 'add' | 'edit'

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

  // Form state for add/edit
  const [formTitle, setFormTitle] = useState('')
  const [formArtist, setFormArtist] = useState('')
  const [formLyrics, setFormLyrics] = useState('')

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

  const openSong = async (song: Song) => {
    const full = await window.api.getSong(song.id)
    setSelected(full)

    // Split lyrics into sections by blank lines or [markers]
    const sections = parseLyricSections(full.lyrics)
    setLyricSections(sections)
    setActiveLyricIndex(0)
    setView('display')
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
    onDisplay?.({ type: 'lyrics', label: selected.title })
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

  if (view === 'display' && selected) {
    return (
      <div className="flex h-full">
        {/* Sections list */}
        <div className="w-56 flex flex-col border-r border-slate-700 bg-slate-800/40">
          <div className="p-3 border-b border-slate-700">
            <button
              onClick={() => setView('list')}
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
            <div className="flex gap-2 text-slate-500 text-xs">
              <span>← → navigate sections</span>
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
    return (
      <div className="flex flex-col h-full p-4 max-w-2xl mx-auto">
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
              Lyrics * <span className="text-slate-500">(use blank lines to separate sections, [Verse 1] [Chorus] etc.)</span>
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
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 border-b border-slate-700">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search songs..."
          className="flex-1 bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded focus:outline-none focus:border-indigo-500 placeholder-slate-500"
        />
        <button
          onClick={openAdd}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded"
        >
          + Add Song
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
