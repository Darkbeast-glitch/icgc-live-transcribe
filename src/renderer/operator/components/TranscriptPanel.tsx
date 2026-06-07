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
const DEVICE_KEY = 'transcript_audio_device'

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
  const [expanded, setExpanded] = useState(false)

  // Audio input device selection (e.g. virtual cable fed from vMix)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => localStorage.getItem(DEVICE_KEY) || '')
  const [showDevicePicker, setShowDevicePicker] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const pcmChunksRef = useRef<Float32Array[]>([])
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const transcriptBoxRef = useRef<HTMLDivElement>(null)
  const fetchRef = useRef<(s: DetectedScripture) => void>(() => {})

  // Load available audio input devices (labels populate after mic permission is granted)
  const loadAudioDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadAudioDevices()
    navigator.mediaDevices.addEventListener?.('devicechange', loadAudioDevices)
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', loadAudioDevices)
  }, [loadAudioDevices])

  const selectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    localStorage.setItem(DEVICE_KEY, deviceId)
  }

  const audioConstraints = useCallback((): MediaStreamConstraints => ({
    audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
    video: false,
  }), [selectedDeviceId])

  // Check Whisper model status on mount
  useEffect(() => {
    window.api.whisperStatus().then((s) => {
      setWhisperReady(s.ready)
      setWhisperLoading(s.loading)
    })
    const offProgress = window.api.onWhisperProgress(({ file, progress }) => {
      setWhisperProgress({ file: file.split('/').pop() ?? file, pct: progress })
    })
    const offReady = window.api.onWhisperReady(() => {
      setWhisperReady(true)
      setWhisperLoading(false)
      setWhisperProgress(null)
    })
    return () => {
      offProgress()
      offReady()
    }
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
    try { stream = await navigator.mediaDevices.getUserMedia(audioConstraints()) }
    catch { setErrorMsg('Could not access the selected audio input.'); setStatus(''); return }
    streamRef.current = stream
    loadAudioDevices()

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
  }, [apiKey, appendTranscript, audioConstraints, loadAudioDevices])

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
    try { stream = await navigator.mediaDevices.getUserMedia(audioConstraints()) }
    catch { setErrorMsg('Could not access the selected audio input. Check system permissions.'); return }
    streamRef.current = stream
    loadAudioDevices()
    setIsListening(true)
    setStatus('listening…')

    const WHISPER_SAMPLE_RATE = 16000
    // Use ScriptProcessorNode to capture raw PCM — avoids MediaRecorder webm
    // encode/decode cycle that fails on some Electron builds
    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx

    const source = audioCtx.createMediaStreamSource(stream)
    sourceRef.current = source
    // Buffer size 4096 gives ~93ms per callback at 44.1kHz
    const processor = audioCtx.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor
    pcmChunksRef.current = []

    processor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0)
      pcmChunksRef.current.push(new Float32Array(channelData))
    }

    source.connect(processor)
    processor.connect(audioCtx.destination)

    chunkIntervalRef.current = setInterval(async () => {
      const chunks = pcmChunksRef.current.splice(0)
      if (chunks.length === 0) return

      // Concatenate all captured PCM chunks
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
      if (totalLength < 100) return
      const combined = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length }

      // Resample from native sample rate to 16kHz for Whisper
      const numFrames = Math.ceil(combined.length * WHISPER_SAMPLE_RATE / audioCtx.sampleRate)
      const offlineCtx = new OfflineAudioContext(1, numFrames, WHISPER_SAMPLE_RATE)
      const buffer = offlineCtx.createBuffer(1, combined.length, audioCtx.sampleRate)
      buffer.copyToChannel(combined, 0)
      const src = offlineCtx.createBufferSource()
      src.buffer = buffer
      src.connect(offlineCtx.destination)
      src.start(0)
      const resampled = await offlineCtx.startRendering()
      const float32 = new Float32Array(resampled.getChannelData(0))

      setIsProcessing(true)
      try {
        const result = await window.api.whisperTranscribe(float32.buffer, WHISPER_SAMPLE_RATE)
        if (!result.success) {
          setErrorMsg(`Whisper error: ${result.error ?? 'unknown'}`)
        } else if (result.text && result.text.trim().length > 1) {
          setErrorMsg('')
          appendTranscript(result.text)
        }
      } catch (e) {
        setErrorMsg(`Processing error: ${String(e)}`)
      }
      setIsProcessing(false)
    }, 4000)
  }, [whisperReady, appendTranscript, audioConstraints, loadAudioDevices])

  // ── Shared stop ──────────────────────────────────────────────────────────

  const stopListening = useCallback(() => {
    if (chunkIntervalRef.current) { clearInterval(chunkIntervalRef.current); chunkIntervalRef.current = null }
    processorRef.current?.disconnect(); processorRef.current = null
    sourceRef.current?.disconnect(); sourceRef.current = null
    recorderRef.current?.stop(); recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null
    audioCtxRef.current?.close(); audioCtxRef.current = null
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null }
    setIsListening(false); setInterimText(''); setStatus(''); setIsProcessing(false)
    audioChunksRef.current = []
    pcmChunksRef.current = []
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
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
  }, [])

  const transcriptContent = (isModal: boolean) => (
    <>
      {/* Mode toggle */}
      <div className={`flex gap-1 px-3 py-2 border-b border-[#252528] ${isModal ? 'shrink-0' : ''}`}>
        <button
          onClick={() => switchMode('online')}
          className={`flex-1 py-1 text-[10px] font-medium rounded transition-colors ${
            mode === 'online' ? 'bg-blue-600 text-white' : 'bg-[#1a1a1e] text-slate-500 hover:text-slate-300'
          }`}
        >
          ☁ Online
        </button>
        <button
          onClick={() => switchMode('offline')}
          className={`flex-1 py-1 text-[10px] font-medium rounded transition-colors ${
            mode === 'offline' ? 'bg-purple-600 text-white' : 'bg-[#1a1a1e] text-slate-500 hover:text-slate-300'
          }`}
        >
          ◉ Offline
        </button>
      </div>

      {/* Audio input device picker */}
      <div className="px-3 pt-2 shrink-0">
        <button
          onClick={() => setShowDevicePicker((v) => !v)}
          className="w-full flex items-center justify-between text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          <span className="truncate">
            🎙 {selectedDeviceId
              ? (audioDevices.find((d) => d.deviceId === selectedDeviceId)?.label || 'Selected input')
              : 'System default microphone'}
          </span>
          <span>{showDevicePicker ? '▲' : '▼'}</span>
        </button>
        {showDevicePicker && (
          <div className="mt-1.5 p-2 bg-[#1a1a1e] border border-[#333338] rounded-lg space-y-1">
            <p className="text-slate-600 text-[10px] mb-1">
              Pick a virtual audio cable fed from vMix to transcribe its program audio instead of the room mic.
            </p>
            <button
              onClick={() => selectDevice('')}
              className={`w-full text-left px-2 py-1 text-[11px] rounded transition-colors ${
                !selectedDeviceId ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-[#252528]'
              }`}
            >
              System default microphone
            </button>
            {audioDevices.map((d) => (
              <button
                key={d.deviceId}
                onClick={() => selectDevice(d.deviceId)}
                className={`w-full text-left px-2 py-1 text-[11px] rounded transition-colors truncate ${
                  selectedDeviceId === d.deviceId ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-[#252528]'
                }`}
                title={d.label || d.deviceId}
              >
                {d.label || `Input ${d.deviceId.slice(0, 8)}`}
              </button>
            ))}
            {audioDevices.length === 0 && (
              <p className="text-slate-600 text-[10px] px-2 py-1">
                No labeled inputs yet — start transcribing once to grant mic permission, then reopen this list.
              </p>
            )}
            <button
              onClick={loadAudioDevices}
              className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400 pt-1 transition-colors"
            >
              ↻ Refresh devices
            </button>
          </div>
        )}
      </div>

      {/* Online: API key setup */}
      {mode === 'online' && showKeySetup && (
        <div className="mx-3 mt-2 p-2.5 bg-[#1a1a1e] border border-[#333338] rounded-lg shrink-0">
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
        <div className="mx-3 mt-2 shrink-0">
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
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${whisperProgress?.pct ?? 0}%` }} />
              </div>
              {whisperProgress?.file && (
                <p className="text-slate-600 text-[10px] mt-1 truncate">{whisperProgress.file}</p>
              )}
            </div>
          ) : (
            <div className="p-2 bg-[#1a1a1e] border border-[#333338] rounded-lg">
              <p className="text-slate-500 text-xs mb-2">Whisper Base model not loaded (~145 MB)</p>
              <button onClick={loadWhisperModel}
                className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded transition-colors">
                Download & Load Model
              </button>
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="mx-3 mt-2 px-2 py-1.5 bg-red-900/30 border border-red-800/60 rounded text-red-400 text-xs shrink-0">
          {errorMsg}
        </div>
      )}

      {/* Transcript */}
      <div
        ref={isModal ? undefined : transcriptBoxRef}
        className={`flex-1 overflow-y-auto p-3 leading-relaxed min-h-0 ${isModal ? 'text-base' : 'text-xs'}`}
      >
        <span className="text-slate-300">{fullTranscript}</span>
        {interimText && <span className="text-slate-500 italic">{interimText}</span>}
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
        <div className="border-t border-[#252528] max-h-48 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between px-3 py-1 border-b border-[#1e1e22]">
            <span className="text-slate-500 text-[10px]">Detected ({detected.length})</span>
            <button
              onClick={() => { setDetected([]); seenRef.current.clear() }}
              className="text-slate-600 hover:text-red-400 text-[10px] transition-colors"
            >
              Clear all
            </button>
          </div>
          {detected.map((d) => (
            <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e1e22]">
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
                className="text-[10px] px-1.5 py-0.5 bg-orange-500 text-white rounded transition-colors hover:bg-orange-400"
              >
                ▶
              </button>
              <button
                onClick={() => setDetected((prev) => prev.filter((x) => x.id !== d.id))}
                className="text-slate-600 hover:text-red-400 text-xs transition-colors"
                title="Dismiss"
              >
                ✕
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
    </>
  )

  return (
    <>
    {/* Expanded modal overlay */}
    {expanded && (
      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 p-6">
        <div className="flex flex-col w-full max-w-2xl bg-[#0e0e11] border border-[#333338] rounded-2xl shadow-2xl overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#252528] shrink-0">
            <div className="flex items-center gap-2">
              {isListening && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              <span className="text-white font-semibold text-sm">Live Transcript</span>
              {status && <span className="text-slate-500 text-xs italic">{status}</span>}
              {isProcessing && <span className="text-purple-400 text-xs italic">processing…</span>}
            </div>
            <div className="flex items-center gap-2">
              {mode === 'online' && (
                <button
                  onClick={() => { setShowKeySetup((v) => !v); setKeyInput('') }}
                  className="text-slate-600 hover:text-slate-400 p-1"
                  title="Deepgram API key"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="text-slate-500 hover:text-white text-xl leading-none transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          {transcriptContent(true)}
        </div>
      </div>
    )}

    <div className="flex flex-col w-64 shrink-0 border-r border-[#252528]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#252528]">
        <div className="flex items-center gap-2">
          {isListening && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
          <span className="text-slate-300 text-xs font-medium">Live Transcript</span>
          {status && <span className="text-slate-500 text-xs italic">{status}</span>}
          {isProcessing && <span className="text-purple-400 text-xs italic">processing…</span>}
        </div>
        <div className="flex items-center gap-1">
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
          <button
            onClick={() => setExpanded(true)}
            className="text-slate-600 hover:text-slate-300 p-1 transition-colors"
            title="Expand transcript"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {transcriptContent(false)}
    </div>
    </>
  )
}
