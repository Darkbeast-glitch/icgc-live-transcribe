import { useState, useEffect, useRef, useCallback } from 'react'
import { detectScriptures } from '@shared/scriptureDetector'
import { DetectedScripture, VerseResult, NowShowingInfo } from '@shared/types'

interface Props {
  translation: string
  onDisplay?: (info: NowShowingInfo) => void
}

interface QueuedVerse {
  scripture: DetectedScripture
  result: VerseResult
  id: string
}

const STORAGE_KEY = 'deepgram_api_key'

export default function LiveListener({ translation, onDisplay }: Props) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [keyInput, setKeyInput] = useState('')
  const [showKeySetup, setShowKeySetup] = useState(() => !localStorage.getItem(STORAGE_KEY))
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [fullTranscript, setFullTranscript] = useState('')
  const [queue, setQueue] = useState<QueuedVerse[]>([])
  const [currentDisplay, setCurrentDisplay] = useState<QueuedVerse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectedRefsRef = useRef<Set<string>>(new Set())
  const transcriptBoxRef = useRef<HTMLDivElement>(null)
  const fetchAndQueueRef = useRef<(s: DetectedScripture) => void>(() => {})

  const sendToProjector = useCallback((verse: QueuedVerse) => {
    window.api.showVerse({
      text: verse.result.text!,
      reference: verse.result.reference!,
      translation: verse.result.translation!
    })
    window.api.addHistory({
      type: 'verse',
      reference: verse.result.reference,
      content: verse.result.text!,
      translation: verse.result.translation
    })
    setCurrentDisplay(verse)
    onDisplay?.({ type: 'verse', label: verse.result.reference!, translation: verse.result.translation })
  }, [onDisplay])

  const fetchAndQueue = useCallback(
    async (scripture: DetectedScripture) => {
      const key = `${scripture.book}${scripture.chapter}:${scripture.verse}-${translation}`
      if (detectedRefsRef.current.has(key)) return
      detectedRefsRef.current.add(key)

      let result: VerseResult
      if (scripture.verseEnd) {
        result = await window.api.getVerseRange({
          book: scripture.book,
          chapter: scripture.chapter,
          verseStart: scripture.verse,
          verseEnd: scripture.verseEnd,
          translation
        })
      } else {
        result = await window.api.getVerse({
          book: scripture.book,
          chapter: scripture.chapter,
          verse: scripture.verse,
          translation
        })
      }

      if (!result.success) return

      const entry: QueuedVerse = { scripture, result, id: key }
      setQueue((prev) => [entry, ...prev])
    },
    [translation, sendToProjector]
  )

  useEffect(() => { fetchAndQueueRef.current = fetchAndQueue }, [fetchAndQueue])

  const saveApiKey = () => {
    const trimmed = keyInput.trim()
    if (!trimmed) return
    localStorage.setItem(STORAGE_KEY, trimmed)
    setApiKey(trimmed)
    setShowKeySetup(false)
    setKeyInput('')
  }

  const startListening = useCallback(async () => {
    if (!apiKey) {
      setShowKeySetup(true)
      return
    }
    setErrorMsg('')
    setStatus('connecting…')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      setErrorMsg('Microphone access denied. Please allow microphone permission.')
      setStatus('')
      return
    }

    streamRef.current = stream

    // Deepgram streaming WebSocket — auth via subprotocol
    const ws = new WebSocket(
      'wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&punctuate=true&utterance_end_ms=1000',
      ['token', apiKey]
    )
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('')
      setIsListening(true)

      const mimeType =
        ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) =>
          MediaRecorder.isTypeSupported(t)
        ) || ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data)
        }
      }

      // Send chunks every 250ms for low latency
      recorder.start(250)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        if (data.type !== 'Results') return

        const alt = data.channel?.alternatives?.[0]
        const text: string = alt?.transcript ?? ''
        if (!text) return

        if (data.is_final) {
          setInterimText('')
          setFullTranscript((prev) => {
            const updated = prev + text + ' '
            setTimeout(() => {
              if (transcriptBoxRef.current) {
                transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight
              }
            }, 50)
            return updated
          })
          detectScriptures(text).forEach((s) => fetchAndQueueRef.current(s))
        } else {
          setInterimText(text)
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = () => {
      setErrorMsg('Connection to Deepgram failed. Check your internet connection.')
      stopListening()
    }

    ws.onclose = (event) => {
      setIsListening(false)
      setInterimText('')
      setStatus('')
      // Code 1008 = policy violation (bad API key)
      if (event.code === 1008 || event.reason?.toLowerCase().includes('auth')) {
        setErrorMsg('Invalid API key. Click the key icon to update it.')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  const stopListening = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
    setIsListening(false)
    setInterimText('')
    setStatus('')
  }, [])

  const clearSession = () => {
    setFullTranscript('')
    setInterimText('')
    setQueue([])
    setCurrentDisplay(null)
    detectedRefsRef.current.clear()
  }

  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [])

  return (
    <div className="flex h-full gap-0">
      {/* Left: Transcript */}
      <div className="flex flex-col flex-1 border-r border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {isListening && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs font-medium">LIVE</span>
              </span>
            )}
            {status && <span className="text-slate-400 text-xs italic">{status}</span>}
            <h2 className="text-slate-300 text-sm font-medium">Live Transcript</h2>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => { setShowKeySetup((v) => !v); setKeyInput('') }}
              title="Deepgram API key settings"
              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
            <button
              onClick={clearSession}
              className="text-xs px-2 py-1 text-slate-400 hover:text-white transition-colors"
            >
              Clear
            </button>
            {!isListening ? (
              <button
                onClick={startListening}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-full transition-colors"
              >
                <span className="w-2 h-2 bg-white rounded-full" />
                Start Listening
              </button>
            ) : (
              <button
                onClick={stopListening}
                className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-full transition-colors"
              >
                <span className="w-2 h-2 bg-white rounded-full" />
                Stop
              </button>
            )}
          </div>
        </div>

        {/* API key setup panel */}
        {showKeySetup && (
          <div className="mx-4 mt-3 p-3 bg-slate-800 border border-slate-600 rounded-lg">
            <p className="text-slate-300 text-xs font-medium mb-1">Deepgram API Key</p>
            <p className="text-slate-500 text-xs mb-2">
              Free at{' '}
              <span className="text-indigo-400">console.deepgram.com</span>
              {' '}— 200 hrs/month free, no credit card needed.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
                placeholder={apiKey ? '••••••••••••••••' : 'Paste your API key…'}
                className="flex-1 bg-slate-700 border border-slate-500 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={saveApiKey}
                disabled={!keyInput.trim()}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded transition-colors"
              >
                Save
              </button>
              {apiKey && (
                <button
                  onClick={() => setShowKeySetup(false)}
                  className="px-2 py-1 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        <div
          ref={transcriptBoxRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
        >
          <span className="text-slate-300">{fullTranscript}</span>
          {interimText && (
            <span className="text-slate-500 italic">{interimText}</span>
          )}
          {!fullTranscript && !interimText && (
            <p className="text-slate-600 text-center mt-20">
              {apiKey
                ? 'Press "Start Listening" to begin capturing the sermon'
                : 'Add your Deepgram API key above to enable live listening'}
            </p>
          )}
        </div>
      </div>

      {/* Right: Detected Verses */}
      <div className="w-80 flex flex-col bg-slate-800/40 min-h-0">
        <div className="px-3 py-3 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-slate-300 text-sm font-medium">Detected Scriptures</h2>
            {queue.length > 0 && (
              <span className="text-slate-500 text-xs">{queue.length}</span>
            )}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
          {queue.length === 0 && (
            <p className="text-slate-600 text-xs text-center mt-8">
              Detected verses will appear here
            </p>
          )}
          {queue
            .filter((item) =>
              !search.trim() ||
              item.result.reference?.toLowerCase().includes(search.toLowerCase()) ||
              item.result.text?.toLowerCase().includes(search.toLowerCase())
            )
            .map((item) => (
              <button
                key={item.id}
                onClick={() => sendToProjector(item)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors group ${
                  currentDisplay?.id === item.id
                    ? 'border-indigo-500/60 bg-indigo-900/25'
                    : 'border-slate-700 bg-slate-800/60 hover:border-indigo-500/60 hover:bg-indigo-900/10'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-white font-semibold text-xs">{item.result.reference}</p>
                  {currentDisplay?.id === item.id ? (
                    <span className="text-indigo-400 text-xs flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                      Showing
                    </span>
                  ) : (
                    <span className="text-slate-600 group-hover:text-indigo-400 text-xs transition-colors">Display →</span>
                  )}
                </div>
                <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{item.result.text}</p>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
