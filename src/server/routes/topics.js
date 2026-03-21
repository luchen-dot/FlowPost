import { Router } from 'express'
import db from '../db/database.js'

const router = Router()

// GET /api/topics
router.get('/', (req, res) => {
  const { status, platform } = req.query
  let query = 'SELECT * FROM topics'
  const params = []
  const conditions = []

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }
  if (platform) {
    conditions.push('platform = ?')
    params.push(platform)
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
  query += ' ORDER BY created_at DESC'

  const topics = db.prepare(query).all(...params)
  res.json(topics)
})

// GET /api/topics/:id
router.get('/:id', (req, res) => {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id)
  if (!topic) return res.status(404).json({ error: 'Topic not found' })
  res.json(topic)
})

// POST /api/topics
router.post('/', (req, res) => {
  const { title, source = 'manual', sourceRef, platform = 'xiaohongshu', notes } = req.body

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Title is required' })
  }

  const result = db.prepare(
    'INSERT INTO topics (title, source, source_ref, platform, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(title.trim(), source, sourceRef || null, platform, notes || null)

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(topic)
})

// PUT /api/topics/:id
router.put('/:id', (req, res) => {
  const { title, status, platform, notes } = req.body
  const existing = db.prepare('SELECT id FROM topics WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Topic not found' })

  db.prepare(
    `UPDATE topics SET
      title = COALESCE(?, title),
      status = COALESCE(?, status),
      platform = COALESCE(?, platform),
      notes = COALESCE(?, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).run(title || null, status || null, platform || null, notes || null, req.params.id)

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id)
  res.json(topic)
})

// DELETE /api/topics/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM topics WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Topic not found' })

  db.prepare('DELETE FROM topics WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
