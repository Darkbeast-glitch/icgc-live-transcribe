import { useState, useEffect, useCallback } from 'react'

interface HistoryEntry {
  id: number
  type: string
  reference: string
  content: string
  translation: string
  shown_at: string
}

export default function HistoryPanel() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [exportStatus, setExportStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const data = await window.api.getHistory()
    setHistory(data)
  }

  const handleExport = useCallback(async () => {
    const result = await window.api.exportNotes()
    setExportStatus(result.success ? 'ok' : 'err')
    setTimeout(() => setExportStatus('idle'), 3000)
  }, [])

  const reshowVerse = (entry: HistoryEntry) => {
    window.api.showVerse({
      text: entry.content,
      reference: entry.reference,
      translation: entry.translation
    })
  }

  const reshowLyrics = (entry: HistoryEntry) => {
    window.api.showLyrics({
      title: entry.reference,
      artist: '',
      lines: entry.content.split('\n')
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h2 className="text-slate-300 text-sm font-medium">Service History</h2>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-slate-400 hover:text-white text-xs">
            Refresh
          </button>
          <button
            onClick={handleExport}
            className={`text-xs px-3 py-1 rounded transition-colors ${
              exportStatus === 'ok'
                ? 'bg-green-700 text-green-100'
                : exportStatus === 'err'
                  ? 'bg-red-800 text-red-200'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
            }`}
          >
            {exportStatus === 'ok' ? 'Saved!' : exportStatus === 'err' ? 'Failed' : 'Export Notes'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <p className="text-slate-600 text-sm text-center mt-12">Nothing shown yet this session</p>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-slate-800 group"
            >
              <div className="w-7 h-7 rounded flex items-center justify-center text-sm shrink-0 mt-0.5">
                {entry.type === 'verse' ? '📖' : '🎵'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-white text-sm font-medium truncate">{entry.reference}</p>
                  {entry.translation && (
                    <span className="text-indigo-400 text-xs shrink-0">{entry.translation}</span>
                  )}
                </div>
                <p className="text-slate-400 text-xs line-clamp-2 mt-0.5">{entry.content}</p>
                <p className="text-slate-600 text-xs mt-1">
                  {new Date(entry.shown_at).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => entry.type === 'verse' ? reshowVerse(entry) : reshowLyrics(entry)}
                className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 bg-slate-700 hover:bg-indigo-600 text-slate-300 hover:text-white rounded transition-all shrink-0"
              >
                Show Again
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
