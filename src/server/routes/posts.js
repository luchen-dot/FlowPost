import { Router } from 'express'
import db from '../db/database.js'
import { validatePostUpdate } from '../utils/validators.js'

const router = Router()

const DEFAULT_BRIEF = {
  platform: 'xiaohongshu',
  targetAudience: '',
  coreMessage: '',
  contentForm: '知识卡片',
  cardCount: 3,
}

const DEFAULT_CARD_STYLE = {
  backgroundColor: '#1A1A2E',
  accentColor: '#4A9EFF',
  textColor: '#E8E8E8',
  fontSize: 28,
  padding: 60,
  showSignature: false,
  signature: '',
}

// GET /api/posts?topicId=X  — get or auto-create post for a topic
router.get('/', (req, res) => {
  const { topicId } = req.query
  if (!topicId) return res.status(400).json({ error: 'topicId is required' })

  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topicId)
  if (!topic) return res.status(404).json({ error: 'Topic not found' })

  let post = db.prepare('SELECT * FROM posts WHERE topic_id = ? ORDER BY id DESC LIMIT 1').get(topicId)

  if (!post) {
    // Auto-create post
    const result = db.prepare(
      'INSERT INTO posts (topic_id, platform, card_data) VALUES (?, ?, ?)'
    ).run(topicId, topic.platform, JSON.stringify({
      brief: { ...DEFAULT_BRIEF, platform: topic.platform },
      titles: [],
      selectedTitle: 0,
      cards: [],
      hashtags: [],
      style: DEFAULT_CARD_STYLE,
    }))

    // Update topic status to writing
    db.prepare("UPDATE topics SET status = 'writing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(topicId)

    post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid)
  }

  res.json(post)
})

// GET /api/posts/:id
router.get('/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Post not found' })
  res.json(post)
})

// PUT /api/posts/:id  — update post
router.put('/:id', (req, res) => {
  const { title, body, cardData, status, aiProvider } = req.body
  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Post not found' })

  const v = validatePostUpdate({ cardData, status })
  if (!v.ok) return res.status(400).json({ error: v.error })

  db.prepare(
    `UPDATE posts SET
      title = COALESCE(?, title),
      body = COALESCE(?, body),
      card_data = COALESCE(?, card_data),
      status = COALESCE(?, status),
      ai_provider = COALESCE(?, ai_provider),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).run(
    title || null,
    body || null,
    cardData ? JSON.stringify(cardData) : null,
    status || null,
    aiProvider || null,
    req.params.id
  )

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  res.json(post)
})

// POST /api/posts/:id/versions  — save version snapshot
router.post('/:id/versions', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  if (!post) return res.status(404).json({ error: 'Post not found' })

  const newVersion = post.version + 1

  db.prepare(
    'INSERT INTO post_versions (post_id, body, card_data, version) VALUES (?, ?, ?, ?)'
  ).run(post.id, post.body, post.card_data, post.version)

  db.prepare(
    'UPDATE posts SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(newVersion, post.id)

  res.json({ ok: true, version: newVersion })
})

// GET /api/posts/:id/versions  — list version history
router.get('/:id/versions', (req, res) => {
  const versions = db.prepare(
    'SELECT id, version, created_at FROM post_versions WHERE post_id = ? ORDER BY version DESC'
  ).all(req.params.id)
  res.json(versions)
})

// GET /api/posts/:id/versions/:versionId  — get a specific version
router.get('/:id/versions/:versionId', (req, res) => {
  const version = db.prepare(
    'SELECT * FROM post_versions WHERE id = ? AND post_id = ?'
  ).get(req.params.versionId, req.params.id)
  if (!version) return res.status(404).json({ error: 'Version not found' })
  res.json(version)
})

export default router
