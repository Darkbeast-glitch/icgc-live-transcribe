import { useState, useEffect, useRef } from 'react'

export default function TimerPanel() {
  const [minutesInput, setMinutesInput] = useState('5')
  const [secondsLeft, setSecondsLeft] = useState(300)
  const [totalSeconds, setTotalSeconds] = useState(300)
  const [isRunning, setIsRunning] = useState(false)
  const [label, setLabel] = useState('Service begins in')
  const [onProjector, setOnProjector] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const secondsRef = useRef(secondsLeft)
  const labelRef = useRef(label)
  secondsRef.current = secondsLeft
  labelRef.current = label

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        const next = secondsRef.current - 1
        setSecondsLeft(next)
        if (onProjector) {
          window.api.showTimer({ secondsLeft: next, label: labelRef.current })
        }
        if (next <= 0) {
          setIsRunning(false)
          if (onProjector) window.api.clearTimer()
          setOnProjector(false)
          clearInterval(intervalRef.current!)
        }
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning, onProjector])

  const applyMinutes = () => {
    const secs = Math.max(1, parseInt(minutesInput) || 1) * 60
    setTotalSeconds(secs)
    setSecondsLeft(secs)
    setIsRunning(false)
    window.api.clearTimer()
    setOnProjector(false)
  }

  const start = () => {
    if (secondsLeft <= 0) return
    setOnProjector(true)
    window.api.showTimer({ secondsLeft, label })
    setIsRunning(true)
  }

  const pause = () => setIsRunning(false)

  const reset = () => {
    setIsRunning(false)
    setSecondsLeft(totalSeconds)
    window.api.clearTimer()
    setOnProjector(false)
  }

  const sendNow = () => {
    window.api.showTimer({ secondsLeft, label })
    setOnProjector(true)
  }

  const removeFromProjector = () => {
    window.api.clearTimer()
    setOnProjector(false)
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-900 border-b border-slate-800">
      {/* Big time display */}
      <div className="flex items-center gap-1 shrink-0">
        <span
          className={`font-mono font-semibold text-xl tabular-nums transition-colors ${
            secondsLeft <= 30 && secondsLeft > 0 ? 'text-red-400' : 'text-white'
          }`}
        >
          {fmt(secondsLeft)}
        </span>
        {onProjector && (
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse ml-1" />
        )}
      </div>

      {/* Progress bar */}
      <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            secondsLeft <= 30 ? 'bg-red-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Minutes setter */}
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          min="1"
          max="60"
          value={minutesInput}
          onChange={(e) => setMinutesInput(e.target.value)}
          onBlur={applyMinutes}
          onKeyDown={(e) => e.key === 'Enter' && applyMinutes()}
          className="w-12 bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-indigo-500 text-center"
        />
        <span className="text-slate-500 text-xs">min</span>
      </div>

      {/* Label */}
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 min-w-0 bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-indigo-500 placeholder-slate-500"
        placeholder="Message on projector..."
      />

      {/* Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!isRunning ? (
          <button
            onClick={start}
            disabled={secondsLeft <= 0}
            className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-xs rounded transition-colors"
          >
            ▶ Start
          </button>
        ) : (
          <button
            onClick={pause}
            className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 text-white text-xs rounded transition-colors"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={reset}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
        >
          Reset
        </button>
        {!onProjector ? (
          <button
            onClick={sendNow}
            className="px-3 py-1 bg-slate-700 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs rounded transition-colors"
          >
            Show
          </button>
        ) : (
          <button
            onClick={removeFromProjector}
            className="px-3 py-1 bg-slate-700 hover:bg-red-700 text-slate-300 hover:text-white text-xs rounded transition-colors"
          >
            Hide
          </button>
        )}
      </div>
    </div>
  )
}
