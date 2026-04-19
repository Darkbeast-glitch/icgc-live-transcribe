import { ipcMain, WebContents } from 'electron'
import { getDb } from '../database'

const BOOK_CHAPTER_COUNTS: Record<string, number> = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
  Joshua: 24, Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Proverbs: 31,
  Ecclesiastes: 12, 'Song of Solomon': 8, Isaiah: 66, Jeremiah: 52,
  Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9,
  Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3,
  Haggai: 2, Zechariah: 14, Malachi: 4,
  Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16,
  '1 Corinthians': 16, '2 Corinthians': 13, Galatians: 6, Ephesians: 6,
  Philippians: 4, Colossians: 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
  '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1, Hebrews: 13,
  James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1,
  '3 John': 1, Jude: 1, Revelation: 22,
}

const TOTAL_CHAPTERS = Object.values(BOOK_CHAPTER_COUNTS).reduce((a, b) => a + b, 0)

let downloadInProgress = false

function getDownloadedChapterCount(): number {
  const db = getDb()
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM (SELECT DISTINCT book, chapter FROM bible_verses WHERE translation = 'KJV')`
  ).get() as { c: number }
  return row.c
}

// Translation code map for bible-api.com
// Only these codes are supported by bible-api.com (copyrighted translations are not available for free)
const TRANSLATION_MAP: Record<string, string> = {
  KJV: 'kjv',
  WEB: 'web',
  ASV: 'asv',
  NASB: 'nasb',
  BBE: 'bbe',
  YLT: 'ylt',
  DARBY: 'darby'
}

export function setupBibleHandlers(): void {
  // Fetch a verse — check local DB first, fall back to API
  ipcMain.handle('bible:get-verse', async (_event, { book, chapter, verse, translation }) => {
    const db = getDb()
    const trans = translation.toUpperCase()

    // Check local cache
    const cached = db
      .prepare(
        'SELECT text FROM bible_verses WHERE translation = ? AND book = ? AND chapter = ? AND verse = ?'
      )
      .get(trans, book, chapter, verse) as { text: string } | undefined

    if (cached) {
      return { success: true, text: cached.text, reference: `${book} ${chapter}:${verse}`, translation: trans }
    }

    // Fetch from API
    try {
      const apiCode = TRANSLATION_MAP[trans] || 'kjv'
      const ref = encodeURIComponent(`${book} ${chapter}:${verse}`)
      const url = `https://bible-api.com/${ref}?translation=${apiCode}`

      const response = await fetch(url)
      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = (await response.json()) as { text: string; reference: string }
      const text = data.text.trim()

      // Cache it locally
      db.prepare(
        'INSERT OR IGNORE INTO bible_verses (translation, book, book_number, chapter, verse, text) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(trans, book, 0, chapter, verse, text)

      return { success: true, text, reference: `${book} ${chapter}:${verse}`, translation: trans }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // Get a verse range (e.g. John 3:16-18)
  ipcMain.handle('bible:get-verse-range', async (_event, { book, chapter, verseStart, verseEnd, translation }) => {
    try {
      const apiCode = TRANSLATION_MAP[translation.toUpperCase()] || 'kjv'
      const ref = encodeURIComponent(`${book} ${chapter}:${verseStart}-${verseEnd}`)
      const url = `https://bible-api.com/${ref}?translation=${apiCode}`

      const response = await fetch(url)
      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = (await response.json()) as { text: string; reference: string }

      return {
        success: true,
        text: data.text.trim(),
        reference: `${book} ${chapter}:${verseStart}-${verseEnd}`,
        translation: translation.toUpperCase()
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // Log to service history
  ipcMain.on('history:add', (_event, entry) => {
    getDb()
      .prepare(
        'INSERT INTO service_history (type, reference, content, translation) VALUES (?, ?, ?, ?)'
      )
      .run(entry.type, entry.reference, entry.content, entry.translation)
  })

  ipcMain.handle('history:get', () => {
    return getDb()
      .prepare('SELECT * FROM service_history ORDER BY shown_at DESC LIMIT 50')
      .all()
  })

  ipcMain.handle('bible:get-chapter', async (_event, { book, chapter, translation }) => {
    const db = getDb()
    const trans = (translation as string).toUpperCase()
    const verses = db
      .prepare('SELECT verse, text FROM bible_verses WHERE translation = ? AND book = ? AND chapter = ? ORDER BY verse')
      .all(trans, book, chapter) as Array<{ verse: number; text: string }>

    if (verses.length > 0) return { success: true, verses, book, chapter, translation: trans }

    try {
      const apiCode = TRANSLATION_MAP[trans] || 'kjv'
      const ref = encodeURIComponent(`${book} ${chapter}`)
      const res = await fetch(`https://bible-api.com/${ref}?translation=${apiCode}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as { verses: Array<{ verse: number; text: string }> }

      const insert = db.prepare(
        'INSERT OR IGNORE INTO bible_verses (translation, book, book_number, chapter, verse, text) VALUES (?, ?, ?, ?, ?, ?)'
      )
      db.transaction(() => {
        for (const v of data.verses) insert.run(trans, book, 0, chapter, v.verse, v.text.trim())
      })()

      return {
        success: true,
        verses: data.verses.map((v) => ({ verse: v.verse, text: v.text.trim() })),
        book, chapter, translation: trans,
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('bible:download-status', () => {
    return { downloaded: getDownloadedChapterCount(), total: TOTAL_CHAPTERS, inProgress: downloadInProgress }
  })

  ipcMain.handle('bible:start-download', async (event) => {
    if (downloadInProgress) return
    downloadInProgress = true

    const sender: WebContents = event.sender
    const db = getDb()

    const allChapters: Array<{ book: string; chapter: number }> = []
    for (const [book, count] of Object.entries(BOOK_CHAPTER_COUNTS)) {
      for (let ch = 1; ch <= count; ch++) {
        allChapters.push({ book, chapter: ch })
      }
    }

    const already = db
      .prepare(`SELECT DISTINCT book, chapter FROM bible_verses WHERE translation = 'KJV'`)
      .all() as Array<{ book: string; chapter: number }>
    const done = new Set(already.map((r) => `${r.book}:${r.chapter}`))
    const remaining = allChapters.filter((c) => !done.has(`${c.book}:${c.chapter}`))

    let completed = allChapters.length - remaining.length
    sender.send('bible:download-progress', { done: completed, total: TOTAL_CHAPTERS })

    const insert = db.prepare(
      'INSERT OR IGNORE INTO bible_verses (translation, book, book_number, chapter, verse, text) VALUES (?, ?, ?, ?, ?, ?)'
    )

    for (const { book, chapter } of remaining) {
      if (sender.isDestroyed()) break
      try {
        const ref = encodeURIComponent(`${book} ${chapter}`)
        const res = await fetch(`https://bible-api.com/${ref}?translation=kjv`)
        if (!res.ok) throw new Error(`${res.status}`)

        const data = (await res.json()) as { verses?: Array<{ verse: number; text: string }> }
        if (data.verses?.length) {
          db.transaction(() => {
            for (const v of data.verses!) {
              insert.run('KJV', book, 0, chapter, v.verse, v.text.trim())
            }
          })()
        }

        completed++
        if (!sender.isDestroyed()) {
          sender.send('bible:download-progress', { done: completed, total: TOTAL_CHAPTERS })
        }
      } catch {
        // Skip failed chapters — they stay uncached and will use the API fallback
      }

      await new Promise((r) => setTimeout(r, 120))
    }

    downloadInProgress = false
    if (!sender.isDestroyed()) {
      sender.send('bible:download-progress', { done: TOTAL_CHAPTERS, total: TOTAL_CHAPTERS, complete: true })
    }
  })
}
