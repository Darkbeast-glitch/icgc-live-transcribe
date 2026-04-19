import { useState, useEffect, useRef, useCallback } from 'react'
import { detectScriptures } from '@shared/scriptureDetector'
import { DetectedScripture, QueueItem, VerseResult } from '@shared/types'

interface DetectedVerse {
  scripture: DetectedScripture
  result: VerseResult
  id: string
}

interface Props {
  translation: string
  goLive: boolean
  onPresent: (item: QueueItem) => void
  onPreview: (item: QueueItem) => void
  onAddToQueue: (item: QueueItem) => void
  onDetected: (item: QueueItem) => void
}

type Mode = 'online' | 'offline'

const STORAGE_KEY = 'deepgram_api_key'
const MODE_KEY = 'transcript_mode'

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export default function TranscriptPanel({ translation, goLive, onPresent, onPreview, onAddToQueue, onDetected }: Props) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(MODE_KEY) as Mode) ?? 'online')

  // Online (Deepgram) state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [keyInput, setKeyInput] = useState('')
  const [showKeySetup, setShowKeySetup] = useState(() => !localStorage.getItem(STORAGE_KEY))

  // Offline (Whisper) state
  const [whisperReady, setWhisperReady] = useState(false)
  const [whisperLoading, setWhisperLoading] = useState(false)
  const [whisperProgress, setWhisperProgress] = useState<{ file: string; pct: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Shared state
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [fullTranscript, setFullTranscript] = useState('')
  const [detected, setDetected] = useState<DetectedVerse[]>([])
  const [status, setStatus] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const seenRef = useRef<Set<string>>(new Set())
  const transcriptBoxRef = useRef<HTMLDivElement>(null)
  const fetchRef = useRef<(s: DetectedScripture) => void>(() => {})

  // Check Whisper model status on mount
  useEffect(() => {
    window.api.whisperStatus().then((s) => {
      setWhisperReady(s.ready)
      setWhisperLoading(s.loading)
    })
    window.api.onWhisperProgress(({ file, progress }) => {
      setWhisperProgress({ file: file.split('/').pop() ?? file, pct: progress })
    })
    window.api.onWhisperReady(() => {
      setWhisperReady(true)
      setWhisperLoading(false)
      setWhisperProgress(null)
    })
  }, [])

  const fetchVerse = useCallback(async (scripture: DetectedScripture) => {
    const key = `${scripture.book}${scripture.chapter}:${scripture.verse}-${translation}`
    if (seenRef.current.has(key)) return
    seenRef.current.add(key)

    let result: VerseResult
    if (scripture.verseEnd) {
      result = await window.api.getVerseRange({
        book: scripture.book, chapter: scripture.chapter,
        verseStart: scripture.verse, verseEnd: scripture.verseEnd, translation,
      })
    } else {
      result = await window.api.getVerse({
        book: scripture.book, chapter: scripture.chapter, verse: scripture.verse, translation,
      })
    }
    if (!result.success) return

    const item: QueueItem = {
      id: genId(), reference: result.reference!, book: scripture.book,
      chapter: scripture.chapter, verse: scripture.verse,
      text: result.text!, translation: result.translation!, source: 'detected',
    }

    const entry: DetectedVerse = { scripture, result, id: key }
    setDetected((prev) => [entry, ...prev])
    onDetected(item)
    if (goLive) onPresent(item)
    else onPreview(item)
  }, [translation, goLive, onPresent, onPreview, onDetected])

  useEffect(() => { fetchRef.current = fetchVerse }, [fetchVerse])

  const appendTranscript = useCallback((text: string) => {
    setFullTranscript((prev) => {
      const updated = prev + text + ' '
      setTimeout(() => {
        if (transcriptBoxRef.current) transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight
      }, 50)
      return updated
    })
    detectScriptures(text).forEach((s) => fetchRef.current(s))
  }, [])

  // ── Online (Deepgram) ────────────────────────────────────────────────────

  const saveApiKey = () => {
    const t = keyInput.trim()
    if (!t) return
    localStorage.setItem(STORAGE_KEY, t)
    setApiKey(t); setShowKeySetup(false); setKeyInput('')
  }

  const startOnline = useCallback(async () => {
    if (!apiKey) { setShowKeySetup(true); return }
    setErrorMsg(''); setStatus('connecting…')
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }) }
    catch { setErrorMsg('Microphone access denied.'); setStatus(''); return }
    streamRef.current = stream

    const ws = new WebSocket(
      'wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&punctuate=true&utterance_end_ms=1000',
      ['token', apiKey]
    )
    wsRef.current = ws

    ws.onopen = () => {
      setStatus(''); setIsListening(true)
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) || ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
      }
      recorder.start(250)
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        if (data.type !== 'Results') return
        const text: string = data.channel?.alternatives?.[0]?.transcript ?? ''
        if (!text) return
        if (data.is_final) {
          setInterimText('')
          appendTranscript(text)
        } else {
          setInterimText(text)
        }
      } catch { /* ignore */ }
    }
    ws.onerror = () => { setErrorMsg('Connection failed. Check internet.'); stopListening() }
    ws.onclose = (e) => {
      setIsListening(false); setInterimText(''); setStatus('')
      if (e.code === 1008) setErrorMsg('Invalid API key.')
    }
  }, [apiKey, appendTranscript])

  // ── Offline (Whisper) ────────────────────────────────────────────────────

  const loadWhisperModel = useCallback(async () => {
    setWhisperLoading(true)
    setWhisperProgress({ file: 'Downloading model…', pct: 0 })
    const result = await window.api.whisperLoadModel()
    if (!result.success) {
      setWhisperLoading(false)
      setWhisperProgress(null)
      setErrorMsg(result.error ?? 'Failed to load model')
    }
    // onWhisperReady event will update state when done
  }, [])

  const startOffline = useCallback(async () => {
    if (!whisperReady) return
    setErrorMsg('')
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }) }
    catch { setErrorMsg('Microphone access denied.'); return }
    streamRef.current = stream

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) || ''
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder
    audioChunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }
    recorder.start(500)
    setIsListening(true)
    setStatus('listening…')

    // Process accumulated audio every 6 seconds
    chunkIntervalRef.current = setInterval(async () => {
      const chunks = audioChunksRef.current.splice(0)
      if (chunks.length === 0) return

      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      setIsProcessing(true)
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const audioCtx = new AudioContext()
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
        audioCtx.close()

        const float32 = audioBuffer.getChannelData(0)
        const result = await window.api.whisperTranscribe(float32.buffer as ArrayBuffer, audioBuffer.sampleRate)

        if (result.success && result.text && result.text.length > 1) {
          appendTranscript(result.text)
        }
      } catch { /* decode errors ignored */ }
      setIsProcessing(false)
    }, 6000)
  }, [whisperReady, appendTranscript])

  // ── Shared stop ──────────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    if (chunkIntervalRef.current) { clearInterval(chunkIntervalRef.current); chunkIntervalRef.current = null }
    recorderRef.current?.stop(); recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null }
    setIsListening(false); setInterimText(''); setStatus(''); setIsProcessing(false)
    audioChunksRef.current = []
  }, [])

  const handleStart = useCallback(() => {
    if (mode === 'online') startOnline()
    else startOffline()
  }, [mode, startOnline, startOffline])

  const switchMode = (m: Mode) => {
    if (isListening) stopListening()
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
    setErrorMsg('')
  }

  useEffect(() => () => {
    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
  }, [])

  return (
    <div className="flex flex-col w-64 shrink-0 border-r border-[#252528]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#252528]">
        <div className="flex items-center gap-2">
          {isListening && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
          <span className="text-slate-300 text-xs font-medium">Live Transcript</span>
          {status && <span className="text-slate-500 text-xs italic">{status}</span>}
          {isProcessing && <span className="text-purple-400 text-xs italic">processing…</span>}
        </div>
        {mode === 'online' && (
          <button
            onClick={() => { setShowKeySetup((v) => !v); setKeyInput('') }}
            className="text-slate-600 hover:text-slate-400 p-1"
            title="Deepgram API key"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 px-3 py-2 border-b border-[#252528]">
        <button
          onClick={() => switchMode('online')}
          className={`flex-1 py-1 text-[10px] font-medium rounded transition-colors ${
            mode === 'online'
              ? 'bg-blue-600 text-white'
              : 'bg-[#1a1a1e] text-slate-500 hover:text-slate-300'
          }`}
        >
          ☁ Online
        </button>
        <button
          onClick={() => switchMode('offline')}
          className={`flex-1 py-1 text-[10px] font-medium rounded transition-colors ${
            mode === 'offline'
              ? 'bg-purple-600 text-white'
              : 'bg-[#1a1a1e] text-slate-500 hover:text-slate-300'
          }`}
        >
          ◉ Offline
        </button>
      </div>

      {/* Online: API key setup */}
      {mode === 'online' && showKeySetup && (
        <div className="mx-3 mt-2 p-2.5 bg-[#1a1a1e] border border-[#333338] rounded-lg">
          <p className="text-slate-400 text-xs mb-1.5">Deepgram API Key</p>
          <div className="flex gap-1.5">
            <input
              type="password" value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
              placeholder={apiKey ? '••••••••' : 'Paste key…'}
              className="flex-1 bg-[#111113] border border-[#333338] rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
            />
            <button onClick={saveApiKey} disabled={!keyInput.trim()}
              className="px-2 py-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-xs rounded">
              Save
            </button>
          </div>
        </div>
      )}

      {/* Offline: model status */}
      {mode === 'offline' && (
        <div className="mx-3 mt-2">
          {whisperReady ? (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-green-900/20 border border-green-800/40 rounded-lg">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-green-400 text-xs">Whisper model ready</span>
            </div>
          ) : whisperLoading ? (
            <div className="p-2 bg-[#1a1a1e] border border-[#333338] rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-purple-400 text-xs">Loading model…</span>
                <span className="text-slate-500 text-[10px]">{whisperProgress?.pct ?? 0}%</span>
              </div>
              <div className="h-1 bg-[#252528] rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${whisperProgress?.pct ?? 0}%` }}
                />
              </div>
              {whisperProgress?.file && (
                <p className="text-slate-600 text-[10px] mt-1 truncate">{whisperProgress.file}</p>
              )}
            </div>
          ) : (
            <div className="p-2 bg-[#1a1a1e] border border-[#333338] rounded-lg">
              <p className="text-slate-500 text-xs mb-2">Whisper model not loaded (~150 MB)</p>
              <button
                onClick={loadWhisperModel}
                className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded transition-colors"
              >
                Download & Load Model
              </button>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="mx-3 mt-2 px-2 py-1.5 bg-red-900/30 border border-red-800/60 rounded text-red-400 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Transcript */}
      <div ref={transcriptBoxRef} className="flex-1 overflow-y-auto p-3 text-xs leading-relaxed min-h-0">
        <span className="text-slate-400">{fullTranscript}</span>
        {interimText && <span className="text-slate-600 italic">{interimText}</span>}
        {!fullTranscript && !interimText && (
          <p className="text-slate-700 text-center mt-8">
            {mode === 'online'
              ? (apiKey ? 'Press Start to begin' : 'Add Deepgram API key above')
              : (whisperReady ? 'Press Start to begin' : 'Load model above first')}
          </p>
        )}
      </div>

      {/* Detected verses inline */}
      {detected.length > 0 && (
        <div className="border-t border-[#252528] max-h-36 overflow-y-auto">
          {detected.slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e1e22] group">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
              <span className="text-white text-xs font-medium flex-1 truncate">{d.result.reference}</span>
              <button
                onClick={() => {
                  const item: QueueItem = {
                    id: genId(), reference: d.result.reference!, book: d.scripture.book,
                    chapter: d.scripture.chapter, verse: d.scripture.verse,
                    text: d.result.text!, translation: d.result.translation!, source: 'detected',
                  }
                  onPresent(item)
                }}
                className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 bg-orange-500 text-white rounded transition-opacity"
              >
                ▶
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Control */}
      <div className="p-3 border-t border-[#252528] shrink-0">
        {!isListening ? (
          <button
            onClick={handleStart}
            disabled={mode === 'offline' && !whisperReady}
            className="w-full flex items-center justify-center gap-2 py-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
          >
            <span className="w-2 h-2 bg-white rounded-full" /> Start Transcribing
          </button>
        ) : (
          <button onClick={stopListening}
            className="w-full flex items-center justify-center gap-2 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded transition-colors">
            <span className="w-2 h-2 bg-white rounded-full" /> Stop Transcribing
          </button>
        )}
      </div>
    </div>
  )
}
