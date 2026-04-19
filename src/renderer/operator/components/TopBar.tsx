import { TRANSLATIONS, TRANSLATION_LABELS } from '@shared/types'

interface Props {
  sessionSeconds: number
  translation: string
  onTranslationChange: (t: string) => void
  onSettingsClick: () => void
  onClear: () => void
}

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function TopBar({ sessionSeconds, translation, onTranslationChange, onSettingsClick, onClear }: Props) {
  return (
    <header className="flex items-center justify-between px-4 h-12 bg-[#111113] border-b border-[#252528] shrink-0">
      {/* Left: logo */}
      <div className="flex items-center gap-2.5 w-52">
        <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center text-xs font-black text-white">
          C
        </div>
        <span className="text-white text-sm font-semibold tracking-wide">ICGC FMT</span>
        <span className="text-[10px] text-orange-400 border border-orange-500/40 rounded px-1.5 py-0.5 font-medium">
          LIVE
        </span>
      </div>

      {/* Center: session time */}
      <div className="flex items-center gap-2 text-slate-400 text-xs tracking-widest uppercase font-medium">
        <span>Session Time:</span>
        <span className="text-white font-mono">{fmt(sessionSeconds)}</span>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2 w-52 justify-end">
        <select
          value={translation}
          onChange={(e) => onTranslationChange(e.target.value)}
          className="bg-[#1e1e22] text-white text-xs rounded px-2 py-1 border border-[#333338] focus:outline-none focus:border-orange-500"
        >
          {TRANSLATIONS.map((t) => (
            <option key={t} value={t}>{TRANSLATION_LABELS[t] ?? t}</option>
          ))}
        </select>
        <button
          onClick={onClear}
          className="text-xs px-2.5 py-1 bg-[#1e1e22] hover:bg-red-900/40 border border-[#333338] hover:border-red-700 text-slate-400 hover:text-red-400 rounded transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => window.api.toggleProjectorFullscreen()}
          className="text-xs px-2.5 py-1 bg-[#1e1e22] hover:bg-[#2a2a2f] border border-[#333338] text-slate-400 hover:text-white rounded transition-colors"
        >
          ⛶
        </button>
        <button
          onClick={onSettingsClick}
          className="text-xs px-2.5 py-1 bg-[#1e1e22] hover:bg-[#2a2a2f] border border-[#333338] text-slate-400 hover:text-white rounded transition-colors"
        >
          ⚙
        </button>
      </div>
    </header>
  )
}
