import { ipcMain, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { getDb } from '../database'

type HistoryEntry = {
  type: string
  reference: string
  content: string
  translation: string
  shown_at: string
}

export function setupExportHandlers(): void {
  ipcMain.handle('history:export-notes', async () => {
    const db = getDb()
    const entries = db
      .prepare('SELECT * FROM service_history ORDER BY shown_at ASC')
      .all() as HistoryEntry[]

    if (entries.length === 0) {
      return { success: false, error: 'No history to export' }
    }

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Sermon Notes',
      defaultPath: `sermon-notes-${new Date().toISOString().split('T')[0]}.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    })

    if (canceled || !filePath) return { success: false }

    const lines: string[] = [
      'SERMON NOTES',
      `Exported: ${new Date().toLocaleString()}`,
      '='.repeat(60),
      '',
    ]

    for (const entry of entries) {
      const time = new Date(entry.shown_at).toLocaleTimeString()
      if (entry.type === 'verse') {
        lines.push(`[${time}]  ${entry.reference} (${entry.translation})`)
        lines.push(entry.content)
      } else {
        lines.push(`[${time}]  \u266a ${entry.reference}`)
        lines.push(entry.content)
      }
      lines.push('')
    }

    try {
      writeFileSync(filePath, lines.join('\n'), 'utf8')
      return { success: true, path: filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
