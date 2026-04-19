export interface VerseResult {
  success: boolean
  text?: string
  reference?: string
  translation?: string
  error?: string
}

export interface Song {
  id: number
  title: string
  artist: string
  lyrics?: string
}

export interface DisplayVerse {
  text: string
  reference: string
  translation: string
}

export interface DisplayLyrics {
  title: string
  artist: string
  lines: string[]
}

export type DisplayMode = 'verse' | 'lyrics' | 'timer' | 'blank'

export interface DisplayTimer {
  secondsLeft: number
  label: string
}

export interface NowShowingInfo {
  type: 'verse' | 'lyrics'
  label: string
  translation?: string
}

export interface ActiveDisplay {
  type: 'verse' | 'lyrics' | 'image' | 'blank'
  verse?: { text: string; reference: string; translation: string; book?: string; chapter?: number; verseNum?: number }
  lyrics?: { title: string; lines: string[] }
  image?: { src: string; caption?: string }
}

export interface QueueItem {
  id: string
  reference: string
  book: string
  chapter: number
  verse: number
  text: string
  translation: string
  source: 'manual' | 'detected'
}

export interface DetectedScripture {
  book: string
  chapter: number
  verse: number
  verseEnd?: number
  raw: string
}

// Only translations supported by bible-api.com (free, no API key required)
export const TRANSLATIONS = ['KJV', 'WEB', 'ASV', 'NASB', 'BBE', 'YLT', 'DARBY']

export const TRANSLATION_LABELS: Record<string, string> = {
  KJV: 'KJV – King James Version',
  WEB: 'WEB – World English Bible',
  ASV: 'ASV – American Standard',
  NASB: 'NASB – New American Standard',
  BBE: 'BBE – Basic English Bible',
  YLT: 'YLT – Young\'s Literal',
  DARBY: 'DARBY – Darby\'s Translation'
}

export const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation'
]
