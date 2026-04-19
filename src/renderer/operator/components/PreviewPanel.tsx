import { ActiveDisplay } from '@shared/types'
import { ProjectorTheme } from '@shared/themes'

interface Props {
  nowShowing: ActiveDisplay
  programPreview: ActiveDisplay
  theme: ProjectorTheme
  goLive: boolean
  onGoLiveToggle: () => void
  onTakeLive: () => void
}

function MiniScreen({ display, theme }: { display: ActiveDisplay; theme: ProjectorTheme }) {
  return (
    <div
      className="flex-1 rounded-xl overflow-hidden relative flex items-center justify-center p-4"
      style={{ background: theme.backgroundImage ? `url(${theme.backgroundImage}) center/cover` : theme.gradient }}
    >
      {theme.backgroundImage && display.type !== 'blank' && (
        <div className="absolute inset-0 bg-black/50" />
      )}
      <div className="relative z-10 text-center w-full">
        {display.type === 'image' && display.image && (
          <img
            src={display.image.src}
            alt={display.image.caption ?? 'media'}
            className="max-h-24 max-w-full object-contain mx-auto rounded"
          />
        )}
        {display.type === 'verse' && display.verse && (
          <>
            <p
              className="font-light leading-relaxed line-clamp-4"
              style={{ color: theme.textColor, fontSize: '0.6rem', lineHeight: 1.5 }}
            >
              {display.verse.text}
            </p>
            <p
              className="mt-2 text-[0.5rem] tracking-widest uppercase font-semibold"
              style={{ color: theme.refColor }}
            >
              {display.verse.reference}
            </p>
          </>
        )}
        {display.type === 'lyrics' && display.lyrics && (
          <>
            {display.lyrics.lines.filter((l) => !l.startsWith('[')).slice(0, 4).map((line, i) => (
              <p key={i} className="font-light line-clamp-1" style={{ color: theme.textColor, fontSize: '0.55rem' }}>
                {line}
              </p>
            ))}
            <p className="mt-2 text-[0.5rem] tracking-widest uppercase" style={{ color: theme.refColor }}>
              {display.lyrics.title}
            </p>
          </>
        )}
        {display.type === 'blank' && (
          <p className="text-[0.5rem] tracking-widest uppercase" style={{ color: theme.textColor, opacity: 0.15 }}>
            blank
          </p>
        )}
      </div>
    </div>
  )
}

export default function PreviewPanel({ nowShowing, programPreview, theme, goLive, onGoLiveToggle, onTakeLive }: Props) {
  const hasProgramPreview = programPreview.type !== 'blank'

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
          <MiniScreen display={programPreview} theme={theme} />
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
          <MiniScreen display={nowShowing} theme={theme} />
        </div>
      </div>
    </div>
  )
}
