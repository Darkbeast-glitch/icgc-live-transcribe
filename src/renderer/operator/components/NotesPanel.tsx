import { useEffect, useRef, useState } from 'react'
import ReactQuill from 'react-quill'
import 'quill/dist/quill.snow.css'
import '../notes-editor.css'
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

// Quill editor configuration
const modules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ size: ['small', false, 'large', 'huge'] }],
    [{ header: [1, 2, 3, false] }],
    [{ color: [] }, { background: [] }],
    ['link'],
    ['clean'],
  ],
}

const formats = [
  'bold', 'italic', 'underline', 'strike',
  'align', 'list', 'bullet', 'indent',
  'size', 'header', 'color', 'background', 'link',
]

export default function NotesPanel({ onDisplay }: Props) {
  const [heading, setHeading] = useState('')
  const [recent, setRecent] = useState(loadRecent)
  const [sentFlash, setSentFlash] = useState(false)
  const [editorContent, setEditorContent] = useState('')
  const quillRef = useRef<ReactQuill>(null)

  const send = () => {
    const rawHtml = editorContent
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
    setEditorContent(entry.html)
  }

  const removeRecent = (idx: number) => {
    setRecent((prev) => {
      const updated = prev.filter((_, i) => i !== idx)
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const isEmpty = !editorContent.replace(/<[^>]*>/g, '').trim()

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

        {/* Rich Text Editor */}
        <div className="flex-1 notes-editor-container">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={editorContent}
            onChange={setEditorContent}
            modules={modules}
            formats={formats}
            placeholder="Type your announcement, sermon notes, or instructions. Use the toolbar to format text, add alignment, lists, and more..."
            className="notes-editor"
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
          Rich text formatting with alignment support. The projector will display exactly as you format it.
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
