import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATA_DIR = join(__dirname, '../../../data')
const DB_PATH = join(DATA_DIR, 'flowpost.db')

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)

// Performance settings
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('synchronous = NORMAL')

export default db
