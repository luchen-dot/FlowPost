import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import db from '../src/server/db/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const schemaPath = join(__dirname, '../src/server/db/schema.sql')
const schema = readFileSync(schemaPath, 'utf-8')

db.exec(schema)

console.log('✅ FlowPost database initialized successfully')
console.log('📁 Location: data/flowpost.db')
console.log('')
console.log('Next steps:')
console.log('  npm run dev     — start the app')
console.log('  http://localhost:5173  — open in browser')
console.log('  Go to Settings to configure your AI API key')

process.exit(0)
