import { generate } from './aiProvider.js'

/**
 * Layer 1: keyword pre-filter.
 * If keywords is empty, all items pass through.
 */
export function keywordFilter(items, keywords) {
  if (!keywords?.length) return items
  const kwLower = keywords.map((k) => k.toLowerCase())
  return items.filter((item) => {
    const text = item.title.toLowerCase()
    return kwLower.some((kw) => text.includes(kw))
  })
}

/**
 * Layer 2: Claude batch scoring.
 * Sends all item titles in a single API call and returns relevance scores (0-1).
 * Falls back to score 0.7 for all items if AI call fails.
 */
export async function aiScoreItems(items, interestDescription) {
  if (!items.length) return []
  if (!interestDescription?.trim()) {
    return items.map((item) => ({ ...item, relevance_score: 0.7 }))
  }

  const numbered = items.map((item, i) => `${i + 1}. ${item.title}`).join('\n')

  const systemPrompt = `你是一个资讯相关度评分助手。根据用户的兴趣描述，为每条资讯标题打一个相关度分数（0.0到1.0）。
只返回 JSON 数组，格式：[{"id":1,"score":0.8},{"id":2,"score":0.2}]
不要输出任何其他内容。`

  const userMsg = `用户关注的主题：${interestDescription}

以下资讯标题，请逐条评分：
${numbered}`

  let fullText = ''
  try {
    await generate(
      'draft_generate',
      systemPrompt,
      [{ role: 'user', content: userMsg }],
      (chunk) => {
        fullText += chunk
      }
    )

    const jsonMatch = fullText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI response contained no JSON array')

    const scores = JSON.parse(jsonMatch[0])
    return items.map((item, i) => {
      const entry = scores.find((s) => s.id === i + 1)
      return { ...item, relevance_score: entry?.score ?? 0.5 }
    })
  } catch (err) {
    console.warn('[newsFilter] AI scoring failed, using default score:', err.message)
    return items.map((item) => ({ ...item, relevance_score: 0.7 }))
  }
}
