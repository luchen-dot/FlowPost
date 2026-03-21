export const VALID_PLATFORMS = ['xiaohongshu', 'wechat', 'jike', 'twitter']
export const VALID_TOPIC_STATUSES = ['inbox', 'writing', 'done', 'archived']
export const VALID_POST_STATUSES = ['draft', 'reviewed', 'exported']

export function validateTopicInput(body) {
  const { title, platform, status, notes } = body

  if (title !== undefined && !String(title).trim()) {
    return { ok: false, error: 'Title cannot be empty' }
  }
  if (platform !== undefined && !VALID_PLATFORMS.includes(platform)) {
    return { ok: false, error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` }
  }
  if (status !== undefined && !VALID_TOPIC_STATUSES.includes(status)) {
    return { ok: false, error: `Invalid status. Must be one of: ${VALID_TOPIC_STATUSES.join(', ')}` }
  }
  if (notes !== undefined && String(notes).length > 1000) {
    return { ok: false, error: 'Notes must be 1000 characters or less' }
  }
  return { ok: true }
}

export function validatePostUpdate(body) {
  const { cardData, status } = body

  if (cardData !== undefined) {
    if (typeof cardData !== 'object' || cardData === null || Array.isArray(cardData)) {
      return { ok: false, error: 'cardData must be an object' }
    }
    if (cardData.cards !== undefined && !Array.isArray(cardData.cards)) {
      return { ok: false, error: 'cardData.cards must be an array' }
    }
  }
  if (status !== undefined && !VALID_POST_STATUSES.includes(status)) {
    return { ok: false, error: `Invalid status. Must be one of: ${VALID_POST_STATUSES.join(', ')}` }
  }
  return { ok: true }
}

export function validateGenerateInput(body) {
  const { topicTitle, brief } = body

  if (!topicTitle || !String(topicTitle).trim()) {
    return { ok: false, error: 'topicTitle is required' }
  }
  if (brief?.cardCount !== undefined) {
    const n = Number(brief.cardCount)
    if (!Number.isInteger(n) || n < 1 || n > 9) {
      return { ok: false, error: 'brief.cardCount must be an integer between 1 and 9' }
    }
  }
  return { ok: true }
}

export function validateExportInput(body) {
  const { postId, cardIndex } = body

  if (postId === undefined || postId === null) {
    return { ok: false, error: 'postId is required' }
  }
  const id = Number(postId)
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: 'postId must be a positive integer' }
  }
  if (cardIndex !== undefined) {
    const idx = Number(cardIndex)
    if (!Number.isInteger(idx) || idx < 0) {
      return { ok: false, error: 'cardIndex must be a non-negative integer' }
    }
  }
  return { ok: true }
}
