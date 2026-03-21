import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import topicsRouter from './routes/topics.js'
import postsRouter from './routes/posts.js'
import aiRouter from './routes/ai.js'
import exportRouter from './routes/export.js'
import settingsRouter from './routes/settings.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// API routes
app.use('/api/topics', topicsRouter)
app.use('/api/posts', postsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/export', exportRouter)
app.use('/api/settings', settingsRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: '1.0.0' })
})

// Serve built frontend in production
const distPath = join(__dirname, '../../dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html')
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send('Run `npm run build` first, or use `npm run dev` for development.')
  })
})

app.listen(PORT, () => {
  console.log(`✅ FlowPost server running on http://localhost:${PORT}`)
  console.log(`📋 API: http://localhost:${PORT}/api/health`)
  console.log(`💡 Run 'npm run db:init' first if this is your first time`)
})
