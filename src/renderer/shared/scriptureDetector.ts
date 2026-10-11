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
  labeticus: 'Leviticus', lebeticus: 'Leviticus', labiticus: 'Leviticus',
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

const canonicalBookPattern = BIBLE_BOOKS
  .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')

const BOOK_CHAPTER_COUNTS: Record<string, number> = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34,
  Joshua: 24, Judges: 21, Ruth: 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Proverbs: 31,
  Ecclesiastes: 12, 'Song of Solomon': 8, Isaiah: 66, Jeremiah: 52,
  Lamentations: 5, Ezekiel: 48, Daniel: 12, Hosea: 14, Joel: 3, Amos: 9,
  Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3,
  Haggai: 2, Zechariah: 14, Malachi: 4, Matthew: 28, Mark: 16, Luke: 24,
  John: 21, Acts: 28, Romans: 16, '1 Corinthians': 16, '2 Corinthians': 13,
  Galatians: 6, Ephesians: 6, Philippians: 4, Colossians: 4,
  '1 Thessalonians': 5, '2 Thessalonians': 3, '1 Timothy': 6,
  '2 Timothy': 4, Titus: 3, Philemon: 1, Hebrews: 13, James: 5,
  '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1, '3 John': 1,
  Jude: 1, Revelation: 22,
}

// Matches "John", "1 Cor", "Song of Solomon", etc.
const BOOK_RE = `((?:\\d\\s?)?(?:${bookPattern})\\.?)`

const VERSE_RANGE = `(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?`

// ── Pattern 1: Typed colon form — "John 3:16", "1 Cor 13:4-7"
const TYPED_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s*(\\d{1,3})\\s*:\\s*${VERSE_RANGE}`,
  'gi'
)

// ── Pattern 2: "verse" keyword — "John chapter 3 verse 16", "John 3 the verse 48"
const SPOKEN_VERSE_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s*(?:chapters?\\s*)?(\\d{1,3})(?:\\s*,\\s*|\\s+)(?:the\\s+)?verses?\\s+${VERSE_RANGE}`,
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

// ── Pattern 5: Chapter-only — "turn to Romans 8", "according to Matthew 14"
//   Only fires when preceded by a navigation word to reduce false positives
const CHAPTER_ONLY_REGEX = new RegExp(
  `\\b(?:turn\\s+to|open|read|go\\s+to|look\\s+at|according\\s+to|in|from|see)\\s+(?:the\\s+book\\s+of\\s+)?${BOOK_RE}\\s*(?:chapters?\\s*)?(\\d{1,3})\\b(?!\\s*(?:[:\\d]|,?\\s*(?:the\\s+)?verses?\\b))`,
  'gi'
)

// A bare canonical book + chapter is also a reference: "Genesis 5" means Genesis 5:1.
// Exclude numbered-book suffixes (e.g. "John 3" inside "1 John 3") and anything that
// continues into an explicit verse reference.
const BARE_CHAPTER_ONLY_REGEX = new RegExp(
  `(?<!\\d\\s)\\b(?:the\\s+book\\s+of\\s+)?(${canonicalBookPattern})\\s+(?:chapters?\\s*)?(\\d{1,3})\\b(?!\\s*(?:[:\\d]|,?\\s*(?:the\\s+)?verses?\\b))`,
  'gi'
)

// Transcription may omit the pause or separator in chapter/verse references:
// "John 515" means John 5:15. A valid full chapter number takes precedence.
const COMPRESSED_REFERENCE_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s+(\\d{3,4})\\b(?!\\s*:)`,
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

function makeCompressedResult(bookRaw: string, digits: string, raw: string): DetectedScripture | null {
  const book = resolveBook(bookRaw)
  if (!book) return null
  const maxChapter = BOOK_CHAPTER_COUNTS[book]
  if (!maxChapter) return null

  // Try the longest possible chapter first, so "Genesis 501" resolves to 50:1.
  for (let split = digits.length - 1; split >= 1; split--) {
    const chapter = parseInt(digits.slice(0, split), 10)
    const verse = parseInt(digits.slice(split), 10)
    if (chapter >= 1 && chapter <= maxChapter && verse >= 1 && verse <= 176) {
      return { book, chapter, verse, raw }
    }
  }
  return null
}

// ── Public API ────────────────────────────────────────────────────────────────

export function detectScriptures(
  rawText: string,
  options: { includeChapterOnly?: boolean } = {}
): DetectedScripture[] {
  // Strip possessive 's ("Mark's 6" → "Mark 6") — common in Ghanaian preaching style
  const text = wordsToDigits(rawText.replace(/[''']s\b/g, ''))
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

  // 4. Spoken bare (space/comma) — only if not already matched
  for (const m of text.matchAll(SPOKEN_BARE_REGEX)) {
    add(makeResult(m[1], m[2], m[3], m[4], m[0]))
  }

  // 5. Compact chapter/verse digits, e.g. "John 515" → John 5:15.
  for (const m of text.matchAll(COMPRESSED_REFERENCE_REGEX)) {
    const book = resolveBook(m[1])
    const number = parseInt(m[2], 10)
    if (book && number > (BOOK_CHAPTER_COUNTS[book] ?? 0)) {
      add(makeCompressedResult(m[1], m[2], m[0]))
    }
  }

  if (options.includeChapterOnly !== false) {
    // Ordinal Psalm: "the 23rd Psalm" → Psalms 23:1
    for (const m of text.matchAll(ORDINAL_PSALM_REGEX)) {
      add(makeChapterResult('Psalms', m[1], m[0]))
    }

    // Chapter-only with navigation trigger word, or a bare canonical book name.
    for (const m of text.matchAll(CHAPTER_ONLY_REGEX)) {
      add(makeChapterResult(m[1], m[2], m[0]))
    }
    for (const m of text.matchAll(BARE_CHAPTER_ONLY_REGEX)) {
      add(makeChapterResult(m[1], m[2], m[0]))
    }
  }

  return results
}
