import { useState } from 'react'
import { ActiveDisplay } from '@shared/types'
import { noteHtmlToPlainText } from '@shared/sanitizeNoteHtml'
import { ProjectorTheme } from '@shared/themes'

interface Props {
  nowShowing: ActiveDisplay
  programPreview: ActiveDisplay
  theme: ProjectorTheme
  goLive: boolean
  onGoLiveToggle: () => void
  onTakeLive: () => void
}

function ScreenContent({ display, theme, fontSize = '0.6rem' }: {
  display: ActiveDisplay
  theme: ProjectorTheme
  fontSize?: string
}) {
  return (
    <div className="relative z-10 text-center w-full px-6">
      {display.type === 'image' && display.image && (
        <img
          src={display.image.src}
          alt={display.image.caption ?? 'media'}
          className="max-h-full max-w-full object-contain mx-auto rounded"
        />
      )}
      {display.type === 'verse' && display.verse && (
        <>
          <p
            className="font-light leading-relaxed"
            style={{ color: theme.textColor, fontSize, lineHeight: 1.6 }}
          >
            {display.verse.text}
          </p>
          <p
            className="mt-3 tracking-widest uppercase font-semibold"
            style={{ color: theme.refColor, fontSize: `calc(${fontSize} * 0.85)` }}
          >
            {display.verse.reference}
          </p>
        </>
      )}
      {display.type === 'lyrics' && display.lyrics && (
        <>
          {display.lyrics.lines.filter((l) => !l.startsWith('[')).slice(0, 6).map((line, i) => (
            <p key={i} className="font-light" style={{ color: theme.textColor, fontSize }}>
              {line}
            </p>
          ))}
          <p className="mt-3 tracking-widest uppercase" style={{ color: theme.refColor, fontSize: `calc(${fontSize} * 0.85)` }}>
            {display.lyrics.title}
          </p>
        </>
      )}
      {display.type === 'note' && display.note && (
        <>
          {display.note.heading && (
            <p
              className="tracking-widest uppercase font-semibold mb-2"
              style={{ color: theme.refColor, fontSize: `calc(${fontSize} * 0.85)` }}
            >
              {display.note.heading}
            </p>
          )}
          {noteHtmlToPlainText(display.note.html).split('\n').slice(0, 6).map((line, i) => (
            <p key={i} className="font-light" style={{ color: theme.textColor, fontSize }}>
              {line || ' '}
            </p>
          ))}
        </>
      )}
      {display.type === 'blank' && (
        <p style={{ color: theme.textColor, fontSize, opacity: 0.15 }} className="tracking-widest uppercase">
          blank
        </p>
      )}
    </div>
  )
}

function MiniScreen({ display, theme, onExpand }: {
  display: ActiveDisplay
  theme: ProjectorTheme
  onExpand: () => void
}) {
  return (
    <div
      className="flex-1 rounded-xl overflow-hidden relative flex items-center justify-center p-4 group"
      style={{ background: theme.backgroundImage ? `url(${theme.backgroundImage}) center/cover` : theme.gradient }}
    >
      {theme.backgroundImage && display.type !== 'blank' && (
        <div className="absolute inset-0 bg-black/50" />
      )}

      {/* Expand button — appears on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onExpand() }}
        title="Enlarge preview"
        className="absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-md bg-black/60 text-white/60 hover:bg-black/90 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M7 1h3v3M4 10H1V7M10 1l-4 4M1 10l4-4" />
        </svg>
      </button>

      <ScreenContent display={display} theme={theme} fontSize="0.6rem" />
    </div>
  )
}

function ExpandedModal({ display, theme, label, onClose }: {
  display: ActiveDisplay
  theme: ProjectorTheme
  label: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{ width: '70vw', height: '60vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5 bg-black/60 backdrop-blur-sm">
          <span className="text-white/70 text-xs font-medium tracking-wide uppercase">{label}</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Screen content */}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: theme.backgroundImage ? `url(${theme.backgroundImage}) center/cover` : theme.gradient }}
        >
          {theme.backgroundImage && display.type !== 'blank' && (
            <div className="absolute inset-0 bg-black/50" />
          )}
          <ScreenContent display={display} theme={theme} fontSize="1.4rem" />
        </div>
      </div>
    </div>
  )
}

export default function PreviewPanel({ nowShowing, programPreview, theme, goLive, onGoLiveToggle, onTakeLive }: Props) {
  const hasProgramPreview = programPreview.type !== 'blank'
  const [expanded, setExpanded] = useState<'program' | 'live' | null>(null)

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-[#252528]">
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        {/* Program preview */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-slate-500 text-xs">Program preview</p>
            {hasProgramPreview && !goLive && (
              <button
                onClick={onTakeLive}
                className="flex items-center gap-1 px-2 py-0.5 bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-semibold rounded transition-colors"
              >
                ▶ Take Live
              </button>
            )}
          </div>
          <MiniScreen display={programPreview} theme={theme} onExpand={() => setExpanded('program')} />
        </div>

        {/* Live display */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-slate-500 text-xs">Live display</p>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[10px] uppercase tracking-wide">Auto-present</span>
              <button
                onClick={onGoLiveToggle}
                className={`relative w-9 h-5 rounded-full transition-colors ${goLive ? 'bg-green-500' : 'bg-[#333338]'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${goLive ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>
          <MiniScreen display={nowShowing} theme={theme} onExpand={() => setExpanded('live')} />
        </div>
      </div>

      {/* Expanded modal */}
      {expanded === 'program' && (
        <ExpandedModal
          display={programPreview}
          theme={theme}
          label="Program preview"
          onClose={() => setExpanded(null)}
        />
      )}
      {expanded === 'live' && (
        <ExpandedModal
          display={nowShowing}
          theme={theme}
          label="Live display"
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  )
}
