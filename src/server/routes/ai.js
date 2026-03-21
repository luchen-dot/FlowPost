import { Router } from 'express'
import { generate, getActiveProviderInfo } from '../services/aiProvider.js'
import { normalizeDraft } from '../services/normalizeDraft.js'
import { validateGenerateInput } from '../utils/validators.js'

const router = Router()

const PLATFORM_PROMPTS = {
  xiaohongshu:
    '你是一位小红书内容创作者，专注 AI 效率和工具类内容。写作要求：开头直接抓住痛点或好奇心，不废话；口语化，有互动感，适当用"！"但不过度；每段控制在 50 字以内，适合分卡片；结尾引导互动（提问或行动号召）；避免营销感和说教感。',
  twitter:
    'You are a productivity creator on Twitter/X. Style: concise, insight-dense, direct. Hook in first line. Each tweet max 270 chars. Thread format if needed. No corporate speak.',
  wechat:
    '你是一位公众号作者，写作风格专业严谨，内容有深度，逻辑清晰，适合深度阅读。语言流畅，观点独到。',
  jike: '你是一位即刻创作者，风格轻松活泼，有个人见解，适合碎片化阅读。真实表达，有态度。',
}

function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
}

function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// GET /api/ai/provider  — get current active provider info
router.get('/provider', (req, res) => {
  const info = getActiveProviderInfo()
  res.json(info || { provider: null, model: null })
})

// POST /api/ai/generate  — generate draft (SSE streaming)
router.post('/generate', async (req, res) => {
  const { topicTitle, brief } = req.body

  const v = validateGenerateInput(req.body)
  if (!v.ok) return res.status(400).json({ error: v.error })

  const platform = brief?.platform || 'xiaohongshu'
  const systemPrompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.xiaohongshu

  const userPrompt = `选题：${topicTitle}
目标读者：${brief?.targetAudience || '通用读者'}
核心传递信息：${brief?.coreMessage || ''}
内容形式：${brief?.contentForm || '知识卡片'}
预估卡片数：${brief?.cardCount || 3}

请生成以下内容，严格按照 JSON 格式输出，不要有多余文字：

\`\`\`json
{
  "titles": [
    "干货型标题：直接说明价值",
    "情绪型标题：触发共鸣或欲望",
    "疑问型标题：引发好奇心"
  ],
  "cards": [
    {
      "title": "卡片1的小标题",
      "content": "卡片1的正文内容，控制在50字以内，适合单张卡片展示"
    },
    {
      "title": "卡片2的小标题",
      "content": "卡片2的正文内容"
    }
  ],
  "hashtags": ["#标签1", "#标签2", "#标签3", "#标签4", "#标签5"]
}
\`\`\`

要求：
- 生成 ${brief?.cardCount || 3} 张卡片
- 每张卡片内容独立完整，不超过50字
- 话题标签仅针对${platform === 'xiaohongshu' ? '小红书' : platform}平台`

  sseHeaders(res)

  let fullText = ''

  try {
    await generate(
      'draft_generate',
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      (chunk) => {
        fullText += chunk
        sseWrite(res, { chunk })
      }
    )

    const result = normalizeDraft(fullText, topicTitle, brief?.cardCount || 3)
    sseWrite(res, { done: true, result })
  } catch (err) {
    console.error('Generate error:', err.message)
    // Categorize error for frontend display
    const msg = err.message || ''
    if (msg.includes('No AI provider') || msg.includes('not configured')) {
      sseWrite(res, { error: '未配置 AI Provider，请先前往 Settings 添加 API Key' })
    } else if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.includes('invalid api key')) {
      sseWrite(res, { error: 'API Key 无效或已过期，请在 Settings 中检查' })
    } else {
      sseWrite(res, { error: `生成失败：${msg}` })
    }
  }

  res.end()
})

// POST /api/ai/polish  — polish a paragraph (SSE streaming)
router.post('/polish', async (req, res) => {
  const { text, platform } = req.body
  if (!text) return res.status(400).json({ error: 'text is required' })

  const systemPrompt = PLATFORM_PROMPTS[platform || 'xiaohongshu']
  sseHeaders(res)

  try {
    await generate(
      'polish',
      systemPrompt,
      [{ role: 'user', content: `请润色以下内容，保持原意和长度，使其更流畅自然，符合平台风格。只输出润色后的内容，不要解释：\n\n${text}` }],
      (chunk) => sseWrite(res, { chunk })
    )
    sseWrite(res, { done: true })
  } catch (err) {
    sseWrite(res, { error: err.message })
  }

  res.end()
})

// POST /api/ai/rewrite  — rewrite a paragraph (SSE streaming)
router.post('/rewrite', async (req, res) => {
  const { text, instruction, platform } = req.body
  if (!text) return res.status(400).json({ error: 'text is required' })

  const systemPrompt = PLATFORM_PROMPTS[platform || 'xiaohongshu']
  const prompt = instruction
    ? `请按照以下要求重写内容（${instruction}）。只输出重写后的内容，不要解释：\n\n${text}`
    : `请重写以下内容，使其更加精炼有力。只输出重写后的内容，不要解释：\n\n${text}`

  sseHeaders(res)

  try {
    await generate(
      'rewrite',
      systemPrompt,
      [{ role: 'user', content: prompt }],
      (chunk) => sseWrite(res, { chunk })
    )
    sseWrite(res, { done: true })
  } catch (err) {
    sseWrite(res, { error: err.message })
  }

  res.end()
})

export default router
