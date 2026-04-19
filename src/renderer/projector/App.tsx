import { useState, useEffect, useRef } from 'react'
import { DisplayVerse, DisplayLyrics, DisplayMode, DisplayTimer } from '@shared/types'
import { ProjectorTheme, FONT_SIZES, FontSizeKey, buildTheme } from '@shared/themes'

interface SlotContent {
  mode: Exclude<DisplayMode, 'timer' | 'blank'> | 'image'
  verse?: DisplayVerse
  lyrics?: DisplayLyrics
  image?: { src: string; caption?: string }
}

const BLANK_SLOT: SlotContent = { mode: 'verse' } // placeholder, never rendered when mode=blank

export default function ProjectorApp() {
  const [theme, setTheme] = useState<ProjectorTheme>(buildTheme('classic', 'md'))
  const [slotA, setSlotA] = useState<SlotContent>(BLANK_SLOT)
  const [slotB, setSlotB] = useState<SlotContent>(BLANK_SLOT)
  const [active, setActive] = useState<'A' | 'B'>('A')
  const [contentMode, setContentMode] = useState<'verse' | 'lyrics' | 'image' | 'blank'>('blank')
  const [timer, setTimer] = useState<DisplayTimer | null>(null)

  const activeRef = useRef<'A' | 'B'>('A')
  activeRef.current = active

  const showContent = (content: SlotContent, mode: 'verse' | 'lyrics' | 'image') => {
    setContentMode(mode)
    if (activeRef.current === 'A') {
      setSlotB(content)
      requestAnimationFrame(() => setActive('B'))
    } else {
      setSlotA(content)
      requestAnimationFrame(() => setActive('A'))
    }
  }

  useEffect(() => {
    window.projector.onShowVerse((data) => {
      setTimer(null)
      showContent({ mode: 'verse', verse: data }, 'verse')
    })

    window.projector.onShowLyrics((data) => {
      setTimer(null)
      showContent({ mode: 'lyrics', lyrics: data }, 'lyrics')
    })

    window.projector.onClear(() => {
      setTimer(null)
      setContentMode('blank')
    })

    window.projector.onSetTheme((incoming) => {
      setTheme(incoming as ProjectorTheme)
    })

    window.projector.onShowTimer((data) => {
      setTimer(data as DisplayTimer)
    })

    window.projector.onClearTimer(() => {
      setTimer(null)
    })

    window.projector.onShowImage((data) => {
      setTimer(null)
      showContent({ mode: 'image', image: data }, 'image')
    })
  }, [])

  const sizes = FONT_SIZES[theme.fontSize as FontSizeKey] ?? FONT_SIZES.md
  const showContent_ = timer !== null || contentMode !== 'blank'

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ backgroundColor: theme.bgColor }}
    >
      {/* Background: image or gradient */}
      {theme.backgroundImage ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${theme.backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          {showContent_ && <div className="absolute inset-0 bg-black/55" />}
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: theme.gradient }} />
      )}

      {/* Timer overlay — sits above crossfade slots */}
      {timer !== null && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <TimerDisplay timer={timer} theme={theme} />
        </div>
      )}

      {/* Crossfade content slots (hidden when timer is active) */}
      <div
        className="absolute inset-0"
        style={{ opacity: timer !== null ? 0 : 1, transition: 'opacity 400ms ease' }}
      >
        {(['A', 'B'] as const).map((slot) => {
          const content = slot === 'A' ? slotA : slotB
          return (
            <div
              key={slot}
              className="absolute inset-0 flex items-center justify-center"
              style={{
                opacity: active === slot && contentMode !== 'blank' ? 1 : 0,
                transition: 'opacity 600ms ease-in-out',
                pointerEvents: 'none',
              }}
            >
              <div className="relative z-10 w-full max-w-5xl px-16">
                {content.mode === 'verse' && content.verse && (
                  <VerseDisplay verse={content.verse} theme={theme} verseFontSize={sizes.verse} />
                )}
                {content.mode === 'lyrics' && content.lyrics && (
                  <LyricsDisplay lyrics={content.lyrics} theme={theme} lyricsFontSize={sizes.lyrics} />
                )}
                {content.mode === 'image' && content.image && (
                  <ImageDisplay image={content.image} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Blank watermark */}
      {contentMode === 'blank' && timer === null && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.07 }}>
          <p className="text-sm tracking-widest uppercase" style={{ color: theme.textColor }}>
            Church Display
          </p>
        </div>
      )}
    </div>
  )
}

function TimerDisplay({ timer, theme }: { timer: DisplayTimer; theme: ProjectorTheme }) {
  const m = Math.floor(timer.secondsLeft / 60)
  const s = timer.secondsLeft % 60
  const isLow = timer.secondsLeft <= 30 && timer.secondsLeft > 0

  return (
    <div className="text-center select-none">
      <p
        style={{
          fontSize: 'clamp(6rem, 18vw, 14rem)',
          fontWeight: 200,
          color: isLow ? '#f87171' : theme.textColor,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          transition: 'color 500ms ease',
        }}
      >
        {m}:{s.toString().padStart(2, '0')}
      </p>
      {timer.label && (
        <p
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.8rem)',
            color: theme.refColor,
            marginTop: '1.5rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {timer.label}
        </p>
      )}
    </div>
  )
}

function VerseDisplay({
  verse,
  theme,
  verseFontSize,
}: {
  verse: DisplayVerse
  theme: ProjectorTheme
  verseFontSize: string
}) {
  return (
    <div className="text-center">
      <p
        className="font-light leading-relaxed"
        style={{ fontSize: verseFontSize, lineHeight: 1.55, color: theme.textColor }}
      >
        {verse.text}
      </p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <div className="h-px w-16" style={{ backgroundColor: theme.refColor }} />
        <p
          className="font-semibold tracking-widest uppercase"
          style={{ fontSize: 'clamp(0.9rem, 2vw, 1.3rem)', color: theme.refColor }}
        >
          {verse.reference}
        </p>
        <div className="h-px w-16" style={{ backgroundColor: theme.refColor }} />
      </div>
      <p
        className="text-sm mt-2 tracking-widest uppercase"
        style={{ color: theme.refColor, opacity: 0.7 }}
      >
        {verse.translation}
      </p>
    </div>
  )
}

function ImageDisplay({ image }: { image: { src: string; caption?: string } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <img
        src={image.src}
        alt={image.caption ?? ''}
        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
        style={{ filter: 'drop-shadow(0 0 40px rgba(0,0,0,0.8))' }}
      />
      {image.caption && (
        <p
          className="text-center tracking-widest uppercase"
          style={{ fontSize: 'clamp(0.9rem, 2vw, 1.4rem)', color: 'rgba(255,255,255,0.7)' }}
        >
          {image.caption}
        </p>
      )}
    </div>
  )
}

function LyricsDisplay({
  lyrics,
  theme,
  lyricsFontSize,
}: {
  lyrics: DisplayLyrics
  theme: ProjectorTheme
  lyricsFontSize: string
}) {
  const displayLines = lyrics.lines.filter((l) => !l.startsWith('['))
  return (
    <div className="text-center">
      {displayLines.map((line, i) => (
        <p
          key={i}
          className="font-light leading-loose"
          style={{ fontSize: lyricsFontSize, color: theme.textColor }}
        >
          {line || '\u00A0'}
        </p>
      ))}
      <div className="mt-8 flex items-center justify-center gap-4">
        <div className="h-px w-16" style={{ backgroundColor: theme.refColor, opacity: 0.5 }} />
        <p
          className="text-base tracking-widest uppercase"
          style={{ color: theme.refColor, opacity: 0.65 }}
        >
          {lyrics.title}
        </p>
        <div className="h-px w-16" style={{ backgroundColor: theme.refColor, opacity: 0.5 }} />
      </div>
    </div>
  )
}
