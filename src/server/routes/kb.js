import { Router } from 'express'
import db from '../db/database.js'
import { syncFromTrendRadar } from '../services/trendradarSync.js'
import { generate } from '../services/aiProvider.js'

const router = Router()

// ── Config ────────────────────────────────────────────────────────────────────

// GET /api/kb/config
router.get('/config', (req, res) => {
  const row = db.prepare('SELECT * FROM trendradar_config WHERE id = 1').get()
  if (!row) {
    return res.json({
      db_path: '',
      min_relevance: 0.6,
      topic_keywords: ['AI', '人工智能', '大模型', 'LLM', 'GPT', 'Claude', '创作', '内容', '写作', '自媒体'],
      auto_sync: 0,
      sync_interval_hours: 6,
      last_synced_at: null,
    })
  }
  res.json({
    ...row,
    topic_keywords: row.topic_keywords ? JSON.parse(row.topic_keywords) : [],
  })
})

// PUT /api/kb/config
router.put('/config', (req, res) => {
  const { db_path, min_relevance, topic_keywords, auto_sync, sync_interval_hours } = req.body
  db.prepare(`
    INSERT INTO trendradar_config (id, db_path, min_relevance, topic_keywords, auto_sync, sync_interval_hours, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      db_path = excluded.db_path,
      min_relevance = excluded.min_relevance,
      topic_keywords = excluded.topic_keywords,
      auto_sync = excluded.auto_sync,
      sync_interval_hours = excluded.sync_interval_hours,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    db_path ?? null,
    min_relevance ?? 0.6,
    Array.isArray(topic_keywords) ? JSON.stringify(topic_keywords) : topic_keywords,
    auto_sync ? 1 : 0,
    sync_interval_hours ?? 6
  )
  res.json({ ok: true })
})

// ── Sync ──────────────────────────────────────────────────────────────────────

// POST /api/kb/sync
router.post('/sync', (req, res) => {
  try {
    const result = syncFromTrendRadar()
    if (result.error) return res.status(400).json({ error: result.error })
    res.json(result)
  } catch (err) {
    console.error('KB sync error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Feed items (inbox) ────────────────────────────────────────────────────────

// GET /api/kb/feeds?page=1&limit=50
router.get('/feeds', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, parseInt(req.query.limit) || 50)
  const offset = (page - 1) * limit

  const items = db
    .prepare(
      `SELECT * FROM feed_items
       WHERE saved_as_topic = 0
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset)

  const { total } = db
    .prepare('SELECT COUNT(*) as total FROM feed_items WHERE saved_as_topic = 0')
    .get()

  res.json({ items, total, page, limit })
})

// POST /api/kb/feeds/:id/save  — promote feed item to kb_document
router.post('/feeds/:id/save', (req, res) => {
  const item = db.prepare('SELECT * FROM feed_items WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'Feed item not found' })

  const doc = db
    .prepare(`
      INSERT INTO kb_documents (title, source, category, raw_text, file_type, synced_at)
      VALUES (?, ?, ?, ?, 'url', CURRENT_TIMESTAMP)
    `)
    .run(item.title, item.source_name || item.source || 'trendradar', item.source, item.summary)

  db.prepare('UPDATE feed_items SET saved_as_topic = 1 WHERE id = ?').run(item.id)

  res.json({ ok: true, docId: doc.lastInsertRowid })
})

// DELETE /api/kb/feeds/:id
router.delete('/feeds/:id', (req, res) => {
  db.prepare('DELETE FROM feed_items WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── KB Documents ──────────────────────────────────────────────────────────────

// GET /api/kb/docs
router.get('/docs', (req, res) => {
  const docs = db
    .prepare('SELECT * FROM kb_documents ORDER BY created_at DESC')
    .all()
  res.json(docs)
})

// DELETE /api/kb/docs/:id
router.delete('/docs/:id', (req, res) => {
  db.prepare('DELETE FROM kb_documents WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Topic Suggestions ─────────────────────────────────────────────────────────

// GET /api/kb/suggestions
router.get('/suggestions', (req, res) => {
  const rows = db
    .prepare("SELECT * FROM kb_topic_suggestions WHERE status = 'pending' ORDER BY created_at DESC")
    .all()
  res.json(rows)
})

// POST /api/kb/suggestions/generate  — ask AI to generate suggestions from recent docs
router.post('/suggestions/generate', async (req, res) => {
  const docs = db
    .prepare('SELECT title, source, raw_text FROM kb_documents ORDER BY created_at DESC LIMIT 20')
    .all()

  if (!docs.length) {
    return res.status(400).json({ error: '知识库为空，请先存入一些资讯文档' })
  }

  const docList = docs
    .map((d, i) => `${i + 1}. 【${d.source}】${d.title}${d.raw_text ? `\n   摘要: ${d.raw_text.slice(0, 120)}` : ''}`)
    .join('\n')

  const systemPrompt = `你是一名资深的内容策划专家，专注于 AI 技术科普和自媒体创作领域。
根据用户提供的资讯列表，生成 5 个有创意、有深度的选题建议。
每个建议必须：
1. 贴合 AI/创作/自媒体主题
2. 有明确的创作角度和差异化观点
3. 适合小红书、公众号等平台
以 JSON 数组形式返回，格式：
[{"title":"选题标题","angle":"创作角度（1-2句）","source_summary":"参考了哪条资讯"}]
只返回 JSON，不要其他内容。`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  let fullText = ''
  try {
    await generate(
      'draft_generate',
      systemPrompt,
      [{ role: 'user', content: `以下是最新资讯：\n${docList}\n\n请生成 5 个选题建议：` }],
      (chunk) => {
        fullText += chunk
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      }
    )

    // Parse and persist suggestions
    try {
      const jsonMatch = fullText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0])
        const insert = db.prepare(`
          INSERT INTO kb_topic_suggestions (title, angle, source_summary, status)
          VALUES (?, ?, ?, 'pending')
        `)
        const insertAll = db.transaction((items) => {
          for (const s of items) {
            insert.run(s.title || '', s.angle || '', s.source_summary || '')
          }
        })
        insertAll(suggestions)
      }
    } catch (parseErr) {
      console.warn('Failed to parse AI suggestions JSON:', parseErr.message)
    }

    res.write(`data: ${JSON.stringify({ done: true, text: fullText })}\n\n`)
    res.end()
  } catch (err) {
    console.error('KB suggestion generation error:', err)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

// PUT /api/kb/suggestions/:id  — update status
router.put('/suggestions/:id', (req, res) => {
  const { status } = req.body
  if (!['pending', 'adopted', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  db.prepare('UPDATE kb_topic_suggestions SET status = ? WHERE id = ?').run(status, req.params.id)
  res.json({ ok: true })
})

// POST /api/kb/suggestions/:id/adopt  — turn suggestion into a topic
router.post('/suggestions/:id/adopt', (req, res) => {
  const suggestion = db
    .prepare('SELECT * FROM kb_topic_suggestions WHERE id = ?')
    .get(req.params.id)
  if (!suggestion) return res.status(404).json({ error: 'Suggestion not found' })

  const topic = db
    .prepare(`
      INSERT INTO topics (title, source, notes, status, platform, created_at, updated_at)
      VALUES (?, 'kb_extract', ?, 'inbox', 'xiaohongshu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .run(suggestion.title, suggestion.angle || suggestion.source_summary || '')

  db.prepare("UPDATE kb_topic_suggestions SET status = 'adopted' WHERE id = ?").run(suggestion.id)

  res.json({ ok: true, topicId: topic.lastInsertRowid })
})

export default router
