import { useState, useEffect } from 'react'
import { PRESET_THEMES, FONT_SIZES, FontSizeKey, ProjectorTheme } from '@shared/themes'

interface Props {
  theme: ProjectorTheme
  onThemeChange: (theme: ProjectorTheme) => void
}

interface DownloadStatus {
  downloaded: number
  total: number
  inProgress: boolean
}

interface SemanticStatus {
  indexed: number
  cached: number
  isIndexing: boolean
  modelReady: boolean
  modelLoading: boolean
}

export default function SettingsPanel({ theme, onThemeChange }: Props) {
  const [dlStatus, setDlStatus] = useState<DownloadStatus | null>(null)
  const [semStatus, setSemStatus] = useState<SemanticStatus | null>(null)
  const [modelProgress, setModelProgress] = useState<{ file: string; progress: number } | null>(null)

  useEffect(() => {
    window.api.getBibleDownloadStatus().then(setDlStatus)
    window.api.onBibleDownloadProgress((data) => {
      setDlStatus({ downloaded: data.done, total: data.total, inProgress: !data.complete })
    })
    window.api.getSemanticStatus().then(setSemStatus)
    window.api.onSemanticModelProgress((data) => setModelProgress(data))
    window.api.onSemanticModelReady(() => {
      setModelProgress(null)
      window.api.getSemanticStatus().then(setSemStatus)
    })
    window.api.onSemanticIndexingProgress((data) => {
      if (data.complete) {
        window.api.getSemanticStatus().then(setSemStatus)
      } else {
        setSemStatus((prev) =>
          prev ? { ...prev, indexed: data.done, isIndexing: true } : prev
        )
      }
    })
  }, [])

  const startDownload = async () => {
    setDlStatus((prev) => (prev ? { ...prev, inProgress: true } : null))
    window.api.startBibleDownload()
  }

  const pct = dlStatus ? Math.round((dlStatus.downloaded / dlStatus.total) * 100) : 0
  const isComplete = dlStatus ? dlStatus.downloaded >= dlStatus.total : false

  const pickImage = async () => {
    const result = await window.api.loadBackgroundImage()
    if (result) {
      onThemeChange({ ...theme, backgroundImage: result.dataUrl })
    }
  }

  const removeImage = () => {
    onThemeChange({ ...theme, backgroundImage: undefined })
  }
  const setPreset = (presetId: string) => {
    const preset = PRESET_THEMES.find((t) => t.id === presetId) ?? PRESET_THEMES[0]
    onThemeChange({ ...preset, fontSize: theme.fontSize })
  }

  const setFontSize = (size: FontSizeKey) => {
    onThemeChange({ ...theme, fontSize: size })
  }

  return (
    <div className="flex flex-col h-full p-6 max-w-xl">
      <h2 className="text-slate-300 font-medium mb-6">Projector Settings</h2>

      {/* Theme */}
      <section className="mb-8">
        <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Background Theme</h3>
        <div className="grid grid-cols-3 gap-3">
          {PRESET_THEMES.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setPreset(preset.id)}
              className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                theme.id === preset.id
                  ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-900/40'
                  : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              {/* Colour swatch */}
              <div
                className="h-16 w-full"
                style={{ background: preset.gradient }}
              />
              {/* Sample text */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: preset.textColor, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  John 3:16
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: preset.refColor, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  {preset.name}
                </span>
              </div>
              {theme.id === preset.id && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Font size */}
      <section className="mb-8">
        <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Text Size</h3>
        <div className="flex gap-2">
          {(Object.keys(FONT_SIZES) as FontSizeKey[]).map((size) => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                theme.fontSize === size
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              {FONT_SIZES[size].label}
            </button>
          ))}
        </div>
        <p className="text-slate-600 text-xs mt-2">
          Changes apply live to the projector window.
        </p>
      </section>

      {/* Preview hint */}
      <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl mb-8">
        <p className="text-slate-400 text-sm">
          Theme and font size are sent to the projector instantly. Move the projector window to your second screen and use Fullscreen button above.
        </p>
      </div>

      {/* Background Image */}
      <section className="mb-8">
        <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Background Image</h3>
        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
          {theme.backgroundImage ? (
            <div className="flex items-center gap-3">
              <div
                className="w-24 h-16 rounded-lg shrink-0 bg-cover bg-center border border-slate-600"
                style={{ backgroundImage: `url(${theme.backgroundImage})` }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">Custom background active</p>
                <p className="text-slate-400 text-xs mt-0.5">Shown behind text on the projector</p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={pickImage}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                >
                  Change
                </button>
                <button
                  onClick={removeImage}
                  className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-red-700/60 text-slate-400 hover:text-white rounded transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm">No background image</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Upload a photo or your church logo to display behind the text.
                </p>
              </div>
              <button
                onClick={pickImage}
                className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
              >
                Choose Image
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Offline Bible Download */}
      <section>
        <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Offline Bible</h3>
        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium">Download Full KJV Bible</p>
              <p className="text-slate-400 text-xs mt-1">
                Downloads all 1,189 chapters locally so the app works 100% offline. One-time setup, takes about 3–4 minutes.
              </p>
            </div>
            {!isComplete && (
              <button
                onClick={startDownload}
                disabled={dlStatus?.inProgress}
                className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                {dlStatus?.inProgress ? 'Downloading…' : 'Download'}
              </button>
            )}
          </div>

          {dlStatus && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>
                  {isComplete
                    ? 'Complete — Bible is fully available offline'
                    : dlStatus.inProgress
                      ? `Downloading… ${dlStatus.downloaded} / ${dlStatus.total} chapters`
                      : `${dlStatus.downloaded} / ${dlStatus.total} chapters cached`}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-indigo-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Smart Search AI Index */}
      <section className="mt-8">
        <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">Smart Search (AI)</h3>
        <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium">Semantic Verse Index</p>
              <p className="text-slate-400 text-xs mt-1">
                Lets you find verses by meaning — type a paraphrase and the AI finds the closest match.
                Requires the Bible download above to be complete first.
              </p>
            </div>
            {semStatus && !semStatus.isIndexing && semStatus.indexed < semStatus.cached && (
              <button
                onClick={() => {
                  setSemStatus((prev) => (prev ? { ...prev, isIndexing: true } : prev))
                  window.api.startSemanticIndexing()
                }}
                disabled={!semStatus || semStatus.cached === 0}
                className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
              >
                Build Index
              </button>
            )}
          </div>

          {/* Model download progress */}
          {modelProgress && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Downloading AI model… {modelProgress.file}</span>
                <span>{modelProgress.progress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${modelProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Index progress */}
          {semStatus && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>
                  {semStatus.indexed >= semStatus.cached && semStatus.cached > 0
                    ? 'Index complete — Smart Search is ready'
                    : semStatus.isIndexing
                      ? `Indexing… ${semStatus.indexed.toLocaleString()} / ${semStatus.cached.toLocaleString()} verses`
                      : semStatus.cached === 0
                        ? 'Download the Bible first, then build the index'
                        : `${semStatus.indexed.toLocaleString()} / ${semStatus.cached.toLocaleString()} verses indexed`}
                </span>
                {semStatus.cached > 0 && (
                  <span>{Math.round((semStatus.indexed / semStatus.cached) * 100)}%</span>
                )}
              </div>
              {semStatus.cached > 0 && (
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      semStatus.indexed >= semStatus.cached ? 'bg-green-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${Math.round((semStatus.indexed / semStatus.cached) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
