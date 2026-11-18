import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

// Shared SQLite connection. Each feature module creates its own tables with
// `db.exec('CREATE TABLE IF NOT EXISTS ...')` at import time.
export const db = new Database(process.env.DB_PATH || join(DATA_DIR, 'app.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
