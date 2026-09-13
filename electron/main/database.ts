import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  return db
}

export function setupDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(join(dbDir, 'church.db'))
  db.pragma('journal_mode = WAL')

  createTables()
  migrateCachedChapters()
  backfillCachedChapters()
  seedDefaultData()
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bible_verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      translation TEXT NOT NULL,
      book TEXT NOT NULL,
      book_number INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL,
      UNIQUE(translation, book, chapter, verse)
    );

    CREATE INDEX IF NOT EXISTS idx_bible_lookup
      ON bible_verses(translation, book, chapter, verse);

    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT,
      lyrics TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts
      USING fts5(title, artist, lyrics, content=songs, content_rowid=id);

    -- Which (translation, book, chapter) triples have been fetched in full.
    -- Individual verses are also cached one at a time, so the presence of rows in
    -- bible_verses does NOT mean the chapter is complete — this table is what
    -- distinguishes "we have all of John 3" from "we happen to have John 3:16".
    CREATE TABLE IF NOT EXISTS cached_chapters (
      translation TEXT NOT NULL,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      cached_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (translation, book, chapter)
    );

    CREATE TABLE IF NOT EXISTS service_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      reference TEXT,
      content TEXT NOT NULL,
      translation TEXT,
      shown_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

// Installs created before cache expiry existed have no cached_at column. Add it
// rather than rebuild the table, so an existing offline download survives.
function migrateCachedChapters(): void {
  const cols = db.prepare(`PRAGMA table_info(cached_chapters)`).all() as Array<{ name: string }>
  if (cols.some((c) => c.name === 'cached_at')) return
  db.exec(`ALTER TABLE cached_chapters ADD COLUMN cached_at INTEGER NOT NULL DEFAULT 0`)
}

// Existing installs (including a completed offline KJV download) predate the
// cached_chapters table. Rather than re-downloading everything, mark any chapter
// whose stored verses run contiguously from verse 1 — the shape produced by a
// wholesale chapter insert. A lone cached verse leaves a gap and is skipped, so
// it will be fetched properly on next use.
function backfillCachedChapters(): void {
  const already = (db.prepare('SELECT COUNT(*) as c FROM cached_chapters').get() as { c: number }).c
  if (already > 0) return

  db.exec(`
    INSERT OR IGNORE INTO cached_chapters (translation, book, chapter, cached_at)
    SELECT translation, book, chapter, 0
    FROM bible_verses
    GROUP BY translation, book, chapter
    HAVING COUNT(*) >= 2 AND MIN(verse) = 1 AND MAX(verse) = COUNT(*)
  `)
}

function seedDefaultData(): void {
  // Seed a few sample songs if table is empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM songs').get() as { c: number }).c
  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO songs (title, artist, lyrics) VALUES (?, ?, ?)'
    )
    insert.run(
      'Amazing Grace',
      'Traditional',
      `[Verse 1]
Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

[Chorus]
My chains are gone I've been set free
My God my Savior has ransomed me
And like a flood His mercy reigns
Unending love amazing grace`
    )

    insert.run(
      'How Great Thou Art',
      'Traditional',
      `[Verse 1]
O Lord my God when I in awesome wonder
Consider all the worlds Thy hands have made
I see the stars I hear the rolling thunder
Thy power throughout the universe displayed

[Chorus]
Then sings my soul my Savior God to Thee
How great Thou art how great Thou art
Then sings my soul my Savior God to Thee
How great Thou art how great Thou art`
    )

    // Rebuild FTS index
    db.exec(`INSERT INTO songs_fts(songs_fts) VALUES('rebuild')`)
  }
}
