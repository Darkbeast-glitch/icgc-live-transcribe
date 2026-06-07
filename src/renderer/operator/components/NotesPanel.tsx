import { useEffect, useRef, useState } from 'react'
import { sanitizeNoteHtml, noteHtmlToPlainText } from '@shared/sanitizeNoteHtml'

interface Props {
  onDisplay?: (info: { heading?: string; html: string }) => void
}

const RECENT_KEY = 'manual_notes_recent_v2'

function loadRecent(): { heading: string; html: string }[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

const TOOLBAR_BUTTONS: { command: string; label: string; title: string }[] = [
  { command: 'bold', label: 'B', title: 'Bold' },
  { command: 'italic', label: 'I', title: 'Italic' },
  { command: 'underline', label: 'U', title: 'Underline' },
]

export default function NotesPanel({ onDisplay }: Props) {
  const [heading, setHeading] = useState('')
  const [recent, setRecent] = useState(loadRecent)
  const [sentFlash, setSentFlash] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.execCommand('styleWithCSS', false, 'false')
  }, [])

  const handleInput = () => {
    const plain = (editorRef.current?.textContent ?? '').trim()
    setIsEmpty(plain.length === 0)
  }

  const exec = (command: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false)
    handleInput()
  }

  const send = () => {
    const rawHtml = editorRef.current?.innerHTML ?? ''
    const plain = noteHtmlToPlainText(rawHtml).trim()
    if (!plain) return

    const html = sanitizeNoteHtml(rawHtml)
    const noteData = { heading: heading.trim() || undefined, html }
    window.api.showNote(noteData)
    onDisplay?.(noteData)

    const entry = { heading: heading.trim(), html }
    setRecent((prev) => {
      const filtered = prev.filter((r) => r.html !== entry.html)
      const updated = [entry, ...filtered].slice(0, 10)
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
      return updated
    })

    setSentFlash(true)
    setTimeout(() => setSentFlash(false), 1500)
  }

  const clear = () => {
    window.api.clearDisplay()
  }

  const loadRecentEntry = (entry: { heading: string; html: string }) => {
    setHeading(entry.heading)
    if (editorRef.current) {
      editorRef.current.innerHTML = entry.html
      handleInput()
    }
  }

  const removeRecent = (idx: number) => {
    setRecent((prev) => {
      const updated = prev.filter((_, i) => i !== idx)
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
      return updated
    })
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Editor */}
      <div className="flex flex-col flex-1 min-w-0 p-4 overflow-y-auto">
        <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Manual Note</h3>

        <label className="text-slate-400 text-xs mb-1 block">Heading (optional)</label>
        <input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          placeholder="e.g. Announcement, Welcome, Prayer Request…"
          className="bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded mb-3 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
        />

        <label className="text-slate-400 text-xs mb-1 block">Text</label>

        {/* Formatting toolbar */}
        <div className="flex items-center gap-1 mb-1.5">
          {TOOLBAR_BUTTONS.map((btn) => (
            <button
              key={btn.command}
              title={btn.title}
              onMouseDown={(e) => { e.preventDefault(); exec(btn.command) }}
              className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded transition-colors"
              style={{
                fontWeight: btn.command === 'bold' ? 700 : 400,
                fontStyle: btn.command === 'italic' ? 'italic' : 'normal',
                textDecoration: btn.command === 'underline' ? 'underline' : 'none',
              }}
            >
              {btn.label}
            </button>
          ))}
          <span className="text-slate-600 text-[10px] ml-2">Select text, then click a style to toggle it</span>
        </div>

        <div className="relative flex-1">
          {isEmpty && (
            <p className="absolute top-2 left-3 text-slate-500 text-sm pointer-events-none leading-relaxed">
              Type anything you want to show on the projector — announcements, instructions, prayer points, etc. Select text and use the toolbar to make it bold, italic, or underlined.
            </p>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            className="h-full min-h-[12rem] bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded resize-none focus:outline-none focus:border-indigo-500 leading-relaxed overflow-y-auto"
          />
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={send}
            disabled={isEmpty}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded transition-colors"
          >
            {sentFlash ? '✓ Sent to Projector' : 'Show on Projector'}
          </button>
          <button
            onClick={clear}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
          >
            Clear Display
          </button>
        </div>
        <p className="text-slate-600 text-xs mt-2">
          Multi-line text is supported — each line shows on its own row on the projector screen.
        </p>
      </div>

      {/* Recent notes */}
      <div className="w-64 shrink-0 border-l border-slate-700 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-700 shrink-0">
          <span className="text-slate-500 text-xs font-medium">Recent Notes</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {recent.length === 0 ? (
            <p className="text-slate-700 text-xs text-center mt-8 px-4">
              Notes you send will appear here for quick reuse.
            </p>
          ) : (
            recent.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 border-b border-slate-800 group">
                <button
                  onClick={() => loadRecentEntry(entry)}
                  className="flex-1 min-w-0 text-left"
                  title="Load into editor"
                >
                  {entry.heading && (
                    <p className="text-white text-xs font-medium truncate">{entry.heading}</p>
                  )}
                  <p className="text-slate-500 text-xs truncate">{noteHtmlToPlainText(entry.html)}</p>
                </button>
                <button
                  onClick={() => removeRecent(i)}
                  className="text-slate-700 group-hover:text-red-400 text-xs transition-colors shrink-0"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
