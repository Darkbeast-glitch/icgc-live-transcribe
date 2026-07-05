import { DetectedScripture, BIBLE_BOOKS } from './types'

// ── Number-word → digit conversion ──────────────────────────────────────────

const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine',
               'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
               'seventeen','eighteen','nineteen']
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety']

function wordsToDigits(text: string): string {
  let out = text

  // Book-name ordinals: "First" / "Second" / "Third" → "1" / "2" / "3"
  // Must come BEFORE general word replacement so "First Corinthians" → "1 Corinthians"
  out = out.replace(/\bfirst\b/gi, '1').replace(/\bsecond\b/gi, '2').replace(/\bthird\b/gi, '3')
  out = out.replace(/\b1st\b/gi, '1').replace(/\b2nd\b/gi, '2').replace(/\b3rd\b/gi, '3')

  // Tens + ones: "twenty one" / "twenty-one" → 21
  out = out.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](one|two|three|four|five|six|seven|eight|nine)\b/gi,
    (_, ten, one) => {
      const t = TENS.findIndex(w => w === ten.toLowerCase()) * 10
      const o = ONES.findIndex(w => w === one.toLowerCase())
      return String(t + o)
    }
  )
  // "one hundred" → 100
  out = out.replace(/\bone\s+hundred\b/gi, '100')
  // Standalone tens
  out = out.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi,
    (w) => String(TENS.findIndex(t => t === w.toLowerCase()) * 10)
  )
  // Ones and teens
  out = out.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi,
    (w) => String(ONES.findIndex(o => o === w.toLowerCase()))
  )
  return out
}

// ── Book alias map ───────────────────────────────────────────────────────────

const BOOK_ALIASES: Record<string, string> = {
  // Old Testament
  gen: 'Genesis', ge: 'Genesis',
  ex: 'Exodus', exo: 'Exodus', exod: 'Exodus',
  lev: 'Leviticus', le: 'Leviticus', lv: 'Leviticus',
  num: 'Numbers', nu: 'Numbers', nm: 'Numbers', numb: 'Numbers',
  deu: 'Deuteronomy', deut: 'Deuteronomy', dt: 'Deuteronomy',
  josh: 'Joshua', jos: 'Joshua',
  judg: 'Judges', jdg: 'Judges', jg: 'Judges',
  rut: 'Ruth', ru: 'Ruth',
  '1sam': '1 Samuel', '1sa': '1 Samuel', '1s': '1 Samuel',
  '2sam': '2 Samuel', '2sa': '2 Samuel', '2s': '2 Samuel',
  '1kgs': '1 Kings', '1ki': '1 Kings', '1k': '1 Kings',
  '2kgs': '2 Kings', '2ki': '2 Kings', '2k': '2 Kings',
  '1chr': '1 Chronicles', '1ch': '1 Chronicles', '1chron': '1 Chronicles',
  '2chr': '2 Chronicles', '2ch': '2 Chronicles', '2chron': '2 Chronicles',
  ezr: 'Ezra', neh: 'Nehemiah', ne: 'Nehemiah',
  est: 'Esther', esth: 'Esther',
  psa: 'Psalms', ps: 'Psalms', psalm: 'Psalms',
  prov: 'Proverbs', pro: 'Proverbs', pr: 'Proverbs', prv: 'Proverbs',
  ecc: 'Ecclesiastes', eccl: 'Ecclesiastes', qoh: 'Ecclesiastes',
  sos: 'Song of Solomon', song: 'Song of Solomon', ss: 'Song of Solomon', sg: 'Song of Solomon',
  isa: 'Isaiah', is: 'Isaiah',
  jer: 'Jeremiah', je: 'Jeremiah',
  lam: 'Lamentations', la: 'Lamentations',
  eze: 'Ezekiel', ezek: 'Ezekiel', ezk: 'Ezekiel',
  dan: 'Daniel', da: 'Daniel', dn: 'Daniel',
  hos: 'Hosea', ho: 'Hosea',
  joel: 'Joel', jl: 'Joel',
  amo: 'Amos', am: 'Amos',
  oba: 'Obadiah', obad: 'Obadiah', ob: 'Obadiah',
  jon: 'Jonah',
  mic: 'Micah', mi: 'Micah',
  nah: 'Nahum', na: 'Nahum',
  hab: 'Habakkuk',
  zep: 'Zephaniah', zeph: 'Zephaniah', zp: 'Zephaniah',
  hag: 'Haggai', hg: 'Haggai',
  zec: 'Zechariah', zech: 'Zechariah', zc: 'Zechariah',
  mal: 'Malachi', ml: 'Malachi',
  // New Testament
  mat: 'Matthew', matt: 'Matthew', mt: 'Matthew',
  mar: 'Mark', mrk: 'Mark', mk: 'Mark',
  luk: 'Luke', lk: 'Luke',
  joh: 'John', jn: 'John',
  act: 'Acts', ac: 'Acts',
  rom: 'Romans', ro: 'Romans', rm: 'Romans',
  '1cor': '1 Corinthians', '1co': '1 Corinthians',
  '2cor': '2 Corinthians', '2co': '2 Corinthians',
  gal: 'Galatians', ga: 'Galatians',
  eph: 'Ephesians',
  php: 'Philippians', phil: 'Philippians',
  col: 'Colossians',
  '1th': '1 Thessalonians', '1thes': '1 Thessalonians', '1thess': '1 Thessalonians',
  '2th': '2 Thessalonians', '2thes': '2 Thessalonians', '2thess': '2 Thessalonians',
  '1ti': '1 Timothy', '1tim': '1 Timothy', '1tm': '1 Timothy',
  '2ti': '2 Timothy', '2tim': '2 Timothy', '2tm': '2 Timothy',
  tit: 'Titus', ti: 'Titus',
  phm: 'Philemon', phlm: 'Philemon', phile: 'Philemon',
  heb: 'Hebrews', he: 'Hebrews',
  jas: 'James', jam: 'James', jm: 'James',
  '1pe': '1 Peter', '1pet': '1 Peter', '1pt': '1 Peter',
  '2pe': '2 Peter', '2pet': '2 Peter', '2pt': '2 Peter',
  '1jn': '1 John', '1jo': '1 John',
  '2jn': '2 John', '2jo': '2 John',
  '3jn': '3 John', '3jo': '3 John',
  jud: 'Jude',
  rev: 'Revelation', re: 'Revelation', apoc: 'Revelation',
}

function resolveBook(raw: string): string {
  const key = raw.trim().replace(/\.$/, '').toLowerCase().replace(/\s+/g, '')
  return BOOK_ALIASES[key] ||
    BIBLE_BOOKS.find((b) => b.toLowerCase().replace(/\s+/g, '') === key) ||
    ''
}

// ── Regex building ───────────────────────────────────────────────────────────

// Escape all book names + aliases for use in regex
const bookPattern = [
  ...BIBLE_BOOKS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ...Object.keys(BOOK_ALIASES).map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
].join('|')

// Matches "John", "1 Cor", "Song of Solomon", etc.
const BOOK_RE = `((?:\\d\\s?)?(?:${bookPattern})\\.?)`

const VERSE_RANGE = `(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?`

// ── Pattern 1: Typed colon form — "John 3:16", "1 Cor 13:4-7"
const TYPED_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s*(\\d{1,3})\\s*:\\s*${VERSE_RANGE}`,
  'gi'
)

// ── Pattern 2: "verse" keyword — "John chapter 3 verse 16", "John 3 verse 16-18"
const SPOKEN_VERSE_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s*(?:chapters?\\s*)?(\\d{1,3})\\s+verses?\\s+${VERSE_RANGE}`,
  'gi'
)

// ── Pattern 3: Bare space/comma — "John 3 16", "John 3, 16"
//   Negative lookahead prevents matching already-captured "3:16" forms
const SPOKEN_BARE_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s*(?:chapters?\\s*)?(\\d{1,3})[,\\s]+${VERSE_RANGE}(?!\\s*:\\s*\\d)`,
  'gi'
)

// ── Pattern 4: "the book of X chapter Y verse Z" — strip "book of" prefix
//   Handles: "in the book of Romans chapter 8 verse 28"
const BOOK_OF_REGEX = new RegExp(
  `\\bbook\\s+of\\s+${BOOK_RE}\\s*(?:chapters?\\s*)?(\\d{1,3})\\s+(?:verse\\s+)?${VERSE_RANGE}`,
  'gi'
)

// ── Pattern 5: Chapter-only — "turn to Romans 8", "open Matthew 14"
//   Only fires when preceded by a navigation word to reduce false positives
const CHAPTER_ONLY_REGEX = new RegExp(
  `\\b(?:turn\\s+to|open|read|go\\s+to|look\\s+at|in|from|see)\\s+(?:the\\s+book\\s+of\\s+)?${BOOK_RE}\\s*(?:chapters?\\s*)?(\\d{1,3})\\b(?!\\s*[:\\d])`,
  'gi'
)

// ── Pattern 6: Ordinal Psalms — "the 23rd Psalm", "Psalm 91"
//   Psalm 91 already covered by other patterns; this adds "Xth Psalm" form
const ORDINAL_PSALM_REGEX = /\bthe\s+(\d{1,3})(?:st|nd|rd|th)\s+psalm\b/gi

// ── Core helpers ─────────────────────────────────────────────────────────────

function makeResult(
  bookRaw: string,
  chStr: string,
  vStr: string,
  veStr: string | undefined,
  raw: string
): DetectedScripture | null {
  const book = resolveBook(bookRaw)
  if (!book) return null
  const chapter = parseInt(chStr)
  const verse = parseInt(vStr)
  const verseEnd = veStr ? parseInt(veStr) : undefined
  if (isNaN(chapter) || isNaN(verse)) return null
  if (chapter < 1 || chapter > 150 || verse < 1 || verse > 176) return null
  return { book, chapter, verse, verseEnd, raw }
}

function makeChapterResult(bookRaw: string, chStr: string, raw: string): DetectedScripture | null {
  const book = resolveBook(bookRaw)
  if (!book) return null
  const chapter = parseInt(chStr)
  if (isNaN(chapter) || chapter < 1 || chapter > 150) return null
  return { book, chapter, verse: 1, raw }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function detectScriptures(rawText: string): DetectedScripture[] {
  const text = wordsToDigits(rawText)
  const results: DetectedScripture[] = []
  const seen = new Set<string>()

  const add = (r: DetectedScripture | null) => {
    if (!r) return
    const key = `${r.book}${r.chapter}:${r.verse}`
    if (seen.has(key)) return
    seen.add(key)
    results.push(r)
  }

  // Priority order: most specific → least specific

  // 1. "book of X" prefix
  for (const m of text.matchAll(BOOK_OF_REGEX)) {
    add(makeResult(m[1], m[2], m[3], m[4], m[0]))
  }

  // 2. Typed colon form (highest confidence)
  for (const m of text.matchAll(TYPED_REGEX)) {
    add(makeResult(m[1], m[2], m[3], m[4], m[0]))
  }

  // 3. Spoken with "verse" keyword
  for (const m of text.matchAll(SPOKEN_VERSE_REGEX)) {
    add(makeResult(m[1], m[2], m[3], m[4], m[0]))
  }

  // 4. Ordinal Psalm: "the 23rd Psalm" → Psalms 23:1
  for (const m of text.matchAll(ORDINAL_PSALM_REGEX)) {
    add(makeChapterResult('Psalms', m[1], m[0]))
  }

  // 5. Spoken bare (space/comma) — only if not already matched
  for (const m of text.matchAll(SPOKEN_BARE_REGEX)) {
    add(makeResult(m[1], m[2], m[3], m[4], m[0]))
  }

  // 6. Chapter-only with navigation trigger word
  for (const m of text.matchAll(CHAPTER_ONLY_REGEX)) {
    add(makeChapterResult(m[1], m[2], m[0]))
  }

  return results
}
