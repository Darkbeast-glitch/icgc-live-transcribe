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

// API.Bible — NIV, NLT, NKJV via rest.api.bible
const APIBIBLE_KEY = 'v5gH-oIsKnvmkvgVZZcX9'
const APIBIBLE_BASE = 'https://rest.api.bible/v1'

const APIBIBLE_IDS: Record<string, string> = {
  NIV:  '78a9f6124f344018-01',
  NLT:  'd6e14a625393b4da-01',
  NKJV: '63097d2a0a2f7db3-01',
}

// Maps app book names → USFM codes used by API.Bible
const BOOK_TO_USFM: Record<string, string> = {
  'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM',
  'Deuteronomy': 'DEU', 'Joshua': 'JOS', 'Judges': 'JDG', 'Ruth': 'RUT',
  '1 Samuel': '1SA', '2 Samuel': '2SA', '1 Kings': '1KI', '2 Kings': '2KI',
  '1 Chronicles': '1CH', '2 Chronicles': '2CH', 'Ezra': 'EZR', 'Nehemiah': 'NEH',
  'Esther': 'EST', 'Job': 'JOB', 'Psalms': 'PSA', 'Proverbs': 'PRO',
  'Ecclesiastes': 'ECC', 'Song of Solomon': 'SNG', 'Isaiah': 'ISA',
  'Jeremiah': 'JER', 'Lamentations': 'LAM', 'Ezekiel': 'EZK', 'Daniel': 'DAN',
  'Hosea': 'HOS', 'Joel': 'JOL', 'Amos': 'AMO', 'Obadiah': 'OBA', 'Jonah': 'JON',
  'Micah': 'MIC', 'Nahum': 'NAM', 'Habakkuk': 'HAB', 'Zephaniah': 'ZEP',
  'Haggai': 'HAG', 'Zechariah': 'ZEC', 'Malachi': 'MAL', 'Matthew': 'MAT',
  'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT', 'Romans': 'ROM',
  '1 Corinthians': '1CO', '2 Corinthians': '2CO', 'Galatians': 'GAL',
  'Ephesians': 'EPH', 'Philippians': 'PHP', 'Colossians': 'COL',
  '1 Thessalonians': '1TH', '2 Thessalonians': '2TH', '1 Timothy': '1TI',
  '2 Timothy': '2TI', 'Titus': 'TIT', 'Philemon': 'PHM', 'Hebrews': 'HEB',
  'James': 'JAS', '1 Peter': '1PE', '2 Peter': '2PE', '1 John': '1JN',
  '2 John': '2JN', '3 John': '3JN', 'Jude': 'JUD', 'Revelation': 'REV',
}

const APIBIBLE_PARAMS = new URLSearchParams({
  'content-type': 'text',
  'include-notes': 'false',
  'include-titles': 'false',
  'include-chapter-numbers': 'false',
  'include-verse-spans': 'false',
})

async function fetchApiBibleVerse(trans: string, book: string, chapter: number, verse: number): Promise<{ text: string; reference: string }> {
  const bibleId = APIBIBLE_IDS[trans]
  const usfm = BOOK_TO_USFM[book]
  if (!bibleId || !usfm) throw new Error('Translation or book not supported')
  const verseId = `${usfm}.${chapter}.${verse}`
  const params = new URLSearchParams(APIBIBLE_PARAMS)
  params.set('include-verse-numbers', 'false')
  const res = await fetch(`${APIBIBLE_BASE}/bibles/${bibleId}/verses/${verseId}?${params}`, {
    headers: { 'api-key': APIBIBLE_KEY }
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = (await res.json()) as { data: { content: string; reference: string } }
  return { text: data.data.content.trim(), reference: data.data.reference }
}

async function fetchApiBibleRange(trans: string, book: string, chapter: number, verseStart: number, verseEnd: number): Promise<{ text: string; reference: string }> {
  const bibleId = APIBIBLE_IDS[trans]
  const usfm = BOOK_TO_USFM[book]
  if (!bibleId || !usfm) throw new Error('Translation or book not supported')
  const passageId = `${usfm}.${chapter}.${verseStart}-${usfm}.${chapter}.${verseEnd}`
  const params = new URLSearchParams(APIBIBLE_PARAMS)
  params.set('include-verse-numbers', 'false')
  const res = await fetch(`${APIBIBLE_BASE}/bibles/${bibleId}/passages/${passageId}?${params}`, {
    headers: { 'api-key': APIBIBLE_KEY }
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = (await res.json()) as { data: { content: string; reference: string } }
  return { text: data.data.content.trim(), reference: data.data.reference }
}

async function fetchApiBibleChapter(trans: string, book: string, chapter: number): Promise<Array<{ verse: number; text: string }>> {
  const bibleId = APIBIBLE_IDS[trans]
  const usfm = BOOK_TO_USFM[book]
  if (!bibleId || !usfm) throw new Error('Translation or book not supported')
  const chapterId = `${usfm}.${chapter}`
  const params = new URLSearchParams(APIBIBLE_PARAMS)
  params.set('include-verse-numbers', 'true')
  const res = await fetch(`${APIBIBLE_BASE}/bibles/${bibleId}/chapters/${chapterId}?${params}`, {
    headers: { 'api-key': APIBIBLE_KEY }
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const data = (await res.json()) as { data: { content: string } }
  return parseEsvVerses(data.data.content)
}

// ESV API (api.esv.org) — free for non-commercial/ministry use with a personal API key
const ESV_API_KEY = '2c14077cf9bf661826b0bc90fde6faaf9d77fc94'
const ESV_API_BASE = 'https://api.esv.org/v3/passage/text/'

async function fetchEsvPassage(query: string, includeVerseNumbers: boolean): Promise<string> {
  const params = new URLSearchParams({
    q: query,
    'include-headings': 'false',
    'include-footnotes': 'false',
    'include-verse-numbers': includeVerseNumbers ? 'true' : 'false',
    'include-short-copyright': 'false',
    'include-passage-references': 'false',
  })
  const res = await fetch(`${ESV_API_BASE}?${params}`, {
    headers: { Authorization: `Token ${ESV_API_KEY}` },
  })
  if (!res.ok) throw new Error(`Server error (${res.status}). Try again later.`)
  const data = (await res.json()) as { passages?: string[] }
  const passage = data.passages?.[0]
  if (!passage || !passage.trim()) throw new Error('Passage not found.')
  return passage.trim()
}

// Splits ESV's "[1] In the beginning... [2] And the earth..." text into per-verse entries
function parseEsvVerses(text: string): Array<{ verse: number; text: string }> {
  const verses: Array<{ verse: number; text: string }> = []
  const parts = text.split(/\[(\d+)\]\s*/)
  for (let i = 1; i < parts.length; i += 2) {
    const num = parseInt(parts[i], 10)
    const body = (parts[i + 1] || '').replace(/\s+/g, ' ').trim()
    if (!isNaN(num) && body) verses.push({ verse: num, text: body })
  }
  return verses
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
      let text: string

      if (APIBIBLE_IDS[trans]) {
        try {
          const result = await fetchApiBibleVerse(trans, book, chapter, verse)
          text = result.text
        } catch {
          return { success: false, error: `${book} ${chapter}:${verse} was not found.` }
        }
      } else if (trans === 'ESV') {
        try {
          text = await fetchEsvPassage(`${book} ${chapter}:${verse}`, false)
        } catch {
          return { success: false, error: `${book} ${chapter}:${verse} was not found. Please check the book, chapter, and verse number.` }
        }
      } else {
        const apiCode = TRANSLATION_MAP[trans] || 'kjv'
        const ref = encodeURIComponent(`${book} ${chapter}:${verse}`)
        const url = `https://bible-api.com/${ref}?translation=${apiCode}`

        const response = await fetch(url)
        if (response.status === 404) {
          return { success: false, error: `${book} ${chapter}:${verse} was not found. Please check the book, chapter, and verse number.` }
        }
        if (!response.ok) throw new Error(`Server error (${response.status}). Try again later.`)

        const data = (await response.json()) as { text: string; reference: string }
        text = data.text.trim()
      }

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
    const trans = translation.toUpperCase()
    try {
      let text: string

      if (APIBIBLE_IDS[trans]) {
        const result = await fetchApiBibleRange(trans, book, chapter, verseStart, verseEnd)
        text = result.text
      } else if (trans === 'ESV') {
        text = await fetchEsvPassage(`${book} ${chapter}:${verseStart}-${verseEnd}`, false)
      } else {
        const apiCode = TRANSLATION_MAP[trans] || 'kjv'
        const ref = encodeURIComponent(`${book} ${chapter}:${verseStart}-${verseEnd}`)
        const url = `https://bible-api.com/${ref}?translation=${apiCode}`

        const response = await fetch(url)
        if (!response.ok) throw new Error(`API error: ${response.status}`)

        const data = (await response.json()) as { text: string; reference: string }
        text = data.text.trim()
      }

      return {
        success: true,
        text,
        reference: `${book} ${chapter}:${verseStart}-${verseEnd}`,
        translation: trans
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
      let chapterVerses: Array<{ verse: number; text: string }>

      if (APIBIBLE_IDS[trans]) {
        chapterVerses = await fetchApiBibleChapter(trans, book, chapter)
        if (chapterVerses.length === 0) throw new Error(`${book} chapter ${chapter} was not found.`)
      } else if (trans === 'ESV') {
        try {
          const passage = await fetchEsvPassage(`${book} ${chapter}`, true)
          chapterVerses = parseEsvVerses(passage)
          if (chapterVerses.length === 0) throw new Error('empty')
        } catch {
          throw new Error(`${book} chapter ${chapter} was not found. Please check the book and chapter number.`)
        }
      } else {
        const apiCode = TRANSLATION_MAP[trans] || 'kjv'
        const ref = encodeURIComponent(`${book} ${chapter}`)
        const res = await fetch(`https://bible-api.com/${ref}?translation=${apiCode}`)
        if (res.status === 404) throw new Error(`${book} chapter ${chapter} was not found. Please check the book and chapter number.`)
        if (!res.ok) throw new Error(`Server error (${res.status}). Try again later.`)
        const data = (await res.json()) as { verses: Array<{ verse: number; text: string }> }
        chapterVerses = data.verses.map((v) => ({ verse: v.verse, text: v.text.trim() }))
      }

      const insert = db.prepare(
        'INSERT OR IGNORE INTO bible_verses (translation, book, book_number, chapter, verse, text) VALUES (?, ?, ?, ?, ?, ?)'
      )
      db.transaction(() => {
        for (const v of chapterVerses) insert.run(trans, book, 0, chapter, v.verse, v.text)
      })()

      return { success: true, verses: chapterVerses, book, chapter, translation: trans }
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
