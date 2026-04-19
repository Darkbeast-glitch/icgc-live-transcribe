import { ipcMain } from 'electron'
import { getDb } from '../database'

export function setupSongHandlers(): void {
  // Search songs (full-text search)
  ipcMain.handle('songs:search', (_event, query: string) => {
    const db = getDb()
    if (!query.trim()) {
      return db.prepare('SELECT id, title, artist FROM songs ORDER BY title LIMIT 50').all()
    }
    return db
      .prepare(
        `SELECT songs.id, songs.title, songs.artist
         FROM songs_fts
         JOIN songs ON songs.id = songs_fts.rowid
         WHERE songs_fts MATCH ?
         ORDER BY rank
         LIMIT 20`
      )
      .all(`${query}*`)
  })

  // Get full song with lyrics
  ipcMain.handle('songs:get', (_event, id: number) => {
    return getDb().prepare('SELECT * FROM songs WHERE id = ?').get(id)
  })

  // Add a new song
  ipcMain.handle('songs:add', (_event, { title, artist, lyrics }) => {
    const db = getDb()
    const result = db
      .prepare('INSERT INTO songs (title, artist, lyrics) VALUES (?, ?, ?)')
      .run(title, artist || '', lyrics)

    // Update FTS index
    db.exec(`INSERT INTO songs_fts(songs_fts) VALUES('rebuild')`)
    return { id: result.lastInsertRowid }
  })

  // Update a song
  ipcMain.handle('songs:update', (_event, { id, title, artist, lyrics }) => {
    const db = getDb()
    db.prepare('UPDATE songs SET title = ?, artist = ?, lyrics = ? WHERE id = ?').run(
      title,
      artist || '',
      lyrics,
      id
    )
    db.exec(`INSERT INTO songs_fts(songs_fts) VALUES('rebuild')`)
    return { success: true }
  })

  // Delete a song
  ipcMain.handle('songs:delete', (_event, id: number) => {
    getDb().prepare('DELETE FROM songs WHERE id = ?').run(id)
    getDb().exec(`INSERT INTO songs_fts(songs_fts) VALUES('rebuild')`)
    return { success: true }
  })

  // Get all songs (for listing)
  ipcMain.handle('songs:list', () => {
    return getDb()
      .prepare('SELECT id, title, artist FROM songs ORDER BY title')
      .all()
  })
}
