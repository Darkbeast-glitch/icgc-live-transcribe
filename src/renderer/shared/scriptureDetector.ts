import { DetectedScripture, BIBLE_BOOKS } from './types'

// Convert spoken number words to digits so "John three sixteen" → "John 3 16"
const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine',
               'ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen',
               'seventeen','eighteen','nineteen']
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety','hundred']

function wordsToDigits(text: string): string {
  // "twenty-one" / "twenty one" → 21, "one hundred" / "hundred" → 100
  let out = text
  // Tens + ones: "twenty one" → 21
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
  // standalone tens: "twenty" → 20
  out = out.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/gi,
    (w) => String(TENS.findIndex(t => t === w.toLowerCase()) * 10 || 100)
  )
  // ones/teens
  out = out.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi,
    (w) => String(ONES.findIndex(o => o === w.toLowerCase()))
  )
  return out
}

// Abbreviation → full book name map
const BOOK_ALIASES: Record<string, string> = {
  gen: 'Genesis', exo: 'Exodus', ex: 'Exodus', lev: 'Leviticus', num: 'Numbers',
  deu: 'Deuteronomy', deut: 'Deuteronomy', josh: 'Joshua', jdg: 'Judges', judg: 'Judges',
  rut: 'Ruth', '1sam': '1 Samuel', '2sam': '2 Samuel', '1ki': '1 Kings', '2ki': '2 Kings',
  '1chr': '1 Chronicles', '2chr': '2 Chronicles', ezr: 'Ezra', neh: 'Nehemiah',
  est: 'Esther', job: 'Job', psa: 'Psalms', ps: 'Psalms', prov: 'Proverbs', pro: 'Proverbs',
  ecc: 'Ecclesiastes', eccl: 'Ecclesiastes', sos: 'Song of Solomon', song: 'Song of Solomon',
  isa: 'Isaiah', jer: 'Jeremiah', lam: 'Lamentations', eze: 'Ezekiel', ezek: 'Ezekiel',
  dan: 'Daniel', hos: 'Hosea', joel: 'Joel', amo: 'Amos', oba: 'Obadiah', obad: 'Obadiah',
  jon: 'Jonah', mic: 'Micah', nah: 'Nahum', hab: 'Habakkuk', zep: 'Zephaniah', zeph: 'Zephaniah',
  hag: 'Haggai', zec: 'Zechariah', zech: 'Zechariah', mal: 'Malachi',
  mat: 'Matthew', matt: 'Matthew', mar: 'Mark', mrk: 'Mark', luk: 'Luke', joh: 'John',
  jn: 'John', act: 'Acts', rom: 'Romans',
  '1cor': '1 Corinthians', '2cor': '2 Corinthians', gal: 'Galatians',
  eph: 'Ephesians', php: 'Philippians', phil: 'Philippians', col: 'Colossians',
  '1th': '1 Thessalonians', '1thes': '1 Thessalonians', '2th': '2 Thessalonians',
  '2thes': '2 Thessalonians', '1ti': '1 Timothy', '1tim': '1 Timothy',
  '2ti': '2 Timothy', '2tim': '2 Timothy', tit: 'Titus', phm: 'Philemon',
  heb: 'Hebrews', jas: 'James', jam: 'James', '1pe': '1 Peter', '1pet': '1 Peter',
  '2pe': '2 Peter', '2pet': '2 Peter', '1jn': '1 John', '1jo': '1 John',
  '2jn': '2 John', '3jn': '3 John', jud: 'Jude', rev: 'Revelation'
}

// Build a regex that matches all known Bible book names and abbreviations
const bookPattern = [
  ...BIBLE_BOOKS.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ...Object.keys(BOOK_ALIASES).map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
].join('|')

const BOOK_RE = `((?:\\d\\s?)?(?:${bookPattern})\\.?)`
const VERSE_RANGE = `(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?`

// Pattern 1 — typed:   "John 3:16",  "1 Cor 13:4-7"
const TYPED_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s*(\\d{1,3})\\s*:\\s*${VERSE_RANGE}`,
  'gi'
)

// Pattern 2 — spoken with "verse" keyword:
//   "John 3 verse 16",  "John chapter 3 verse 16-18"
const SPOKEN_VERSE_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s*(?:chapter\\s*)?(\\d{1,3})\\s+verse\\s+${VERSE_RANGE}`,
  'gi'
)

// Pattern 3 — spoken comma/space separated (no colon, no "verse" word):
//   "John 3 16",  "John 3, 16"
//   Only match when numbers are in plausible chapter:verse range
const SPOKEN_BARE_REGEX = new RegExp(
  `\\b${BOOK_RE}\\s*(?:chapter\\s*)?(\\d{1,3})[,\\s]+${VERSE_RANGE}(?!\\s*:\\s*\\d)`,
  'gi'
)

function resolveBook(raw: string): string {
  const key = raw.trim().replace(/\.$/, '').toLowerCase().replace(/\s/g, '')
  return BOOK_ALIASES[key] ||
    BIBLE_BOOKS.find((b) => b.toLowerCase().replace(/\s/g, '') === key) ||
    ''
}

function makeResult(bookRaw: string, chStr: string, vStr: string, veStr: string | undefined, raw: string): DetectedScripture | null {
  const book = resolveBook(bookRaw)
  if (!book) return null
  const chapter = parseInt(chStr)
  const verse = parseInt(vStr)
  const verseEnd = veStr ? parseInt(veStr) : undefined
  if (isNaN(chapter) || isNaN(verse)) return null
  if (chapter < 1 || chapter > 150 || verse < 1 || verse > 176) return null
  return { book, chapter, verse, verseEnd, raw }
}

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

  // Typed form (highest priority)
  for (const m of text.matchAll(TYPED_REGEX)) {
    add(makeResult(m[1], m[2], m[3], m[4], m[0]))
  }

  // Spoken with "verse" keyword
  for (const m of text.matchAll(SPOKEN_VERSE_REGEX)) {
    add(makeResult(m[1], m[2], m[3], m[4], m[0]))
  }

  // Spoken bare (space/comma separated) — only if not already matched
  for (const m of text.matchAll(SPOKEN_BARE_REGEX)) {
    add(makeResult(m[1], m[2], m[3], m[4], m[0]))
  }

  return results
}
