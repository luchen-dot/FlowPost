import { Router } from 'express'
import db from '../db/database.js'
import { PROVIDERS } from '../services/aiProvider.js'

const router = Router()

// GET /api/settings  — list all provider settings (no API keys exposed)
router.get('/', (req, res) => {
  const settings = db.prepare(
    'SELECT id, provider, model, enabled, is_active, task_routing FROM ai_settings ORDER BY id'
  ).all()
  res.json(settings)
})

// GET /api/settings/providers  — list available providers + models
router.get('/providers', (req, res) => {
  res.json(PROVIDERS)
})

// POST /api/settings  — save a provider's settings (including API key)
router.post('/', (req, res) => {
  const { provider, model, apiKey, enabled, isActive } = req.body

  if (!provider || !PROVIDERS[provider]) {
    return res.status(400).json({ error: 'Invalid provider' })
  }

  const existing = db.prepare('SELECT id FROM ai_settings WHERE provider = ?').get(provider)

  if (existing) {
    db.prepare(
      `UPDATE ai_settings SET
        model = COALESCE(?, model),
        api_key = COALESCE(?, api_key),
        enabled = ?,
        is_active = ?
      WHERE provider = ?`
    ).run(model || null, apiKey !== undefined ? apiKey : null, enabled ? 1 : 0, isActive ? 1 : 0, provider)
  } else {
    db.prepare(
      'INSERT INTO ai_settings (provider, model, api_key, enabled, is_active) VALUES (?, ?, ?, ?, ?)'
    ).run(provider, model || PROVIDERS[provider].models[0], apiKey || '', enabled ? 1 : 0, isActive ? 1 : 0)
  }

  // If set as active, deactivate all others
  if (isActive) {
    db.prepare('UPDATE ai_settings SET is_active = 0 WHERE provider != ?').run(provider)
  }

  res.json({ ok: true })
})

// PUT /api/settings/routing  — update task routing config
router.put('/routing', (req, res) => {
  const { routing } = req.body
  if (!routing || typeof routing !== 'object') {
    return res.status(400).json({ error: 'routing object required' })
  }

  // Save on the active provider's row (or first row)
  const target =
    db.prepare('SELECT id FROM ai_settings WHERE is_active = 1').get() ||
    db.prepare('SELECT id FROM ai_settings LIMIT 1').get()

  if (target) {
    db.prepare('UPDATE ai_settings SET task_routing = ? WHERE id = ?').run(
      JSON.stringify(routing),
      target.id
    )
  }

  res.json({ ok: true })
})

// GET /api/settings/routing  — get current task routing
router.get('/routing', (req, res) => {
  const active =
    db.prepare('SELECT task_routing FROM ai_settings WHERE is_active = 1').get() ||
    db.prepare('SELECT task_routing FROM ai_settings LIMIT 1').get()

  const routing = active?.task_routing ? JSON.parse(active.task_routing) : {}
  res.json(routing)
})

// POST /api/settings/test  — test connection for a provider
router.post('/test', async (req, res) => {
  const { provider } = req.body
  const setting = db.prepare('SELECT * FROM ai_settings WHERE provider = ?').get(provider)

  if (!setting || !setting.api_key) {
    return res.status(400).json({ error: 'No API key configured for this provider' })
  }

  try {
    const { generate } = await import('../services/aiProvider.js')
    let response = ''
    await generate(
      'polish',
      'You are a helpful assistant.',
      [{ role: 'user', content: 'Say "ok" in one word.' }],
      (chunk) => { response += chunk },
      provider
    )
    res.json({ ok: true, response: response.trim() })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
