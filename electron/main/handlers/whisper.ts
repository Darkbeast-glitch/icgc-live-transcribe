import { ipcMain, WebContents } from 'electron'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ASRPipeline = (audio: Float32Array, opts: object) => Promise<{ text: string } | any>

let asrPipeline: ASRPipeline | null = null
let isLoading = false
let whisperCacheDir = ''

async function loadWhisper(sender?: WebContents): Promise<ASRPipeline> {
  if (asrPipeline) return asrPipeline
  if (isLoading) {
    while (isLoading) await new Promise((r) => setTimeout(r, 200))
    return asrPipeline!
  }

  isLoading = true
  try {
    const { pipeline, env } = await import('@xenova/transformers')
    env.cacheDir = whisperCacheDir
    env.allowRemoteModels = true

    asrPipeline = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      {
        progress_callback: (p: { status: string; progress?: number; file?: string }) => {
          if (sender && !sender.isDestroyed() && p.status === 'downloading') {
            sender.send('whisper:progress', {
              file: p.file ?? '',
              progress: Math.round(p.progress ?? 0),
            })
          }
        },
      }
    ) as ASRPipeline

    return asrPipeline!
  } finally {
    isLoading = false
  }
}

export function setupWhisperHandlers(cacheDir: string) {
  whisperCacheDir = cacheDir

  ipcMain.handle('whisper:status', () => ({
    ready: asrPipeline !== null,
    loading: isLoading,
  }))

  ipcMain.handle('whisper:load-model', async (event) => {
    try {
      await loadWhisper(event.sender)
      if (!event.sender.isDestroyed()) event.sender.send('whisper:ready')
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('whisper:transcribe', async (_event, audioBuffer: ArrayBuffer, sampleRate: number) => {
    if (!asrPipeline) return { success: false, error: 'Model not loaded' }
    try {
      const float32 = new Float32Array(audioBuffer)
      const result = await asrPipeline(float32, {
        sampling_rate: sampleRate,
        language: 'english',
        task: 'transcribe',
      })
      const text: string = (result?.text ?? '').trim()
      return { success: true, text }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
