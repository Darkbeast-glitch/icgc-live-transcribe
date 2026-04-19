import { ipcMain, WebContents } from 'electron'
import { getDb } from '../database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Extractor = (input: string | string[], opts: object) => Promise<any>

let extractor: Extractor | null = null
let modelLoading = false
let isIndexing = false

async function loadModel(cacheDir: string, sender?: WebContents): Promise<Extractor> {
  if (extractor) return extractor
  if (modelLoading) {
    while (modelLoading) await new Promise((r) => setTimeout(r, 150))
    return extractor!
  }

  modelLoading = true
  try {
    const { pipeline, env } = await import('@xenova/transformers')
    env.cacheDir = cacheDir

    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        progress_callback: (p: { status: string; progress?: number; file?: string }) => {
          if (sender && !sender.isDestroyed() && p.status === 'downloading') {
            sender.send('semantic:model-progress', {
              file: p.file ?? '',
              progress: Math.round(p.progress ?? 0),
            })
          }
        },
      }
    ) as Extractor

    return extractor!
  } finally {
    modelLoading = false
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

async function embedSingle(ext: Extractor, text: string): Promise<Float32Array> {
  const out = await ext(text, { pooling: 'mean', normalize: true })
  return out.data as Float32Array
}

async function embedBatch(ext: Extractor, texts: string[]): Promise<Float32Array[]> {
  const out = await ext(texts, { pooling: 'mean', normalize: true })
  const flat = out.data as Float32Array
  const dims = out.dims[1] as number
  return texts.map((_, i) => flat.slice(i * dims, (i + 1) * dims))
}

function toBuffer(f: Float32Array): Buffer {
  return Buffer.from(f.buffer)
}

function toFloat32(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
}

export function setupSemanticHandlers(cacheDir: string): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS verse_embeddings (
      translation TEXT NOT NULL,
      book        TEXT NOT NULL,
      chapter     INTEGER NOT NULL,
      verse       INTEGER NOT NULL,
      embedding   BLOB NOT NULL,
      PRIMARY KEY (translation, book, chapter, verse)
    )
  `)

  ipcMain.handle('semantic:status', () => {
    const db = getDb()
    const indexed = (db.prepare(
      `SELECT COUNT(*) as c FROM verse_embeddings WHERE translation = 'KJV'`
    ).get() as { c: number }).c

    const cached = (db.prepare(
      `SELECT COUNT(*) as c FROM bible_verses WHERE translation = 'KJV'`
    ).get() as { c: number }).c

    return { indexed, cached, isIndexing, modelReady: !!extractor, modelLoading }
  })

  ipcMain.handle('semantic:load-model', async (event) => {
    if (extractor) return { success: true }
    try {
      await loadModel(cacheDir, event.sender)
      if (!event.sender.isDestroyed()) {
        event.sender.send('semantic:model-ready')
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('semantic:start-indexing', async (event) => {
    if (isIndexing) return
    isIndexing = true
    const sender: WebContents = event.sender

    try {
      const ext = await loadModel(cacheDir, sender)
      const db = getDb()

      const unindexed = db.prepare(`
        SELECT bv.book, bv.chapter, bv.verse, bv.text
        FROM bible_verses bv
        LEFT JOIN verse_embeddings ve
          ON ve.translation = bv.translation
          AND ve.book = bv.book
          AND ve.chapter = bv.chapter
          AND ve.verse = bv.verse
        WHERE bv.translation = 'KJV' AND ve.embedding IS NULL
      `).all() as Array<{ book: string; chapter: number; verse: number; text: string }>

      const totalCached = (db.prepare(
        `SELECT COUNT(*) as c FROM bible_verses WHERE translation = 'KJV'`
      ).get() as { c: number }).c

      let done = totalCached - unindexed.length

      const insert = db.prepare(`
        INSERT OR REPLACE INTO verse_embeddings (translation, book, chapter, verse, embedding)
        VALUES ('KJV', ?, ?, ?, ?)
      `)

      const BATCH = 32
      for (let i = 0; i < unindexed.length; i += BATCH) {
        if (sender.isDestroyed()) break

        const batch = unindexed.slice(i, i + BATCH)
        const embeddings = await embedBatch(ext, batch.map((v) => v.text))

        db.transaction(() => {
          for (let j = 0; j < batch.length; j++) {
            const v = batch[j]
            insert.run(v.book, v.chapter, v.verse, toBuffer(embeddings[j]))
          }
        })()

        done += batch.length
        if (!sender.isDestroyed()) {
          sender.send('semantic:indexing-progress', { done, total: totalCached })
        }
      }
    } finally {
      isIndexing = false
      if (!event.sender.isDestroyed()) {
        event.sender.send('semantic:indexing-progress', { done: -1, total: -1, complete: true })
      }
    }
  })

  ipcMain.handle('semantic:search', async (event, query: string) => {
    if (!query.trim()) return { results: [] }

    try {
      const ext = await loadModel(cacheDir, event.sender)
      const db = getDb()

      const queryEmbed = await embedSingle(ext, query)

      const rows = db.prepare(`
        SELECT ve.book, ve.chapter, ve.verse, ve.embedding, bv.text
        FROM verse_embeddings ve
        JOIN bible_verses bv
          ON bv.translation = ve.translation
          AND bv.book = ve.book
          AND bv.chapter = ve.chapter
          AND bv.verse = ve.verse
        WHERE ve.translation = 'KJV'
      `).all() as Array<{ book: string; chapter: number; verse: number; embedding: Buffer; text: string }>

      if (rows.length === 0) return { results: [], empty: true }

      const scored = rows.map((row) => ({
        book: row.book,
        chapter: row.chapter,
        verse: row.verse,
        text: row.text,
        reference: `${row.book} ${row.chapter}:${row.verse}`,
        score: cosineSimilarity(queryEmbed, toFloat32(row.embedding)),
      }))

      scored.sort((a, b) => b.score - a.score)

      return { results: scored.slice(0, 8) }
    } catch (err) {
      return { results: [], error: String(err) }
    }
  })
}
