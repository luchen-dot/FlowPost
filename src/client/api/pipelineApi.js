export async function fetchTopic(topicId) {
  const res = await fetch(`/api/topics/${topicId}`)
  if (!res.ok) throw new Error('Failed to load topic')
  return res.json()
}

export async function fetchPostByTopic(topicId) {
  const res = await fetch(`/api/posts?topicId=${topicId}`)
  if (!res.ok) throw new Error('Failed to load post')
  return res.json()
}

export async function savePost(postId, payload) {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Save failed' }))
    throw new Error(err.error || 'Save failed')
  }
  return res.json()
}

// Returns the raw Response for SSE reading
export async function requestDraftGeneration(topicTitle, brief) {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicTitle, brief }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Generation failed' }))
    throw new Error(err.error || 'Generation failed')
  }
  return res
}

export async function exportPng(postId, cardIndex) {
  const res = await fetch('/api/export/png', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, cardIndex }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Export failed' }))
    throw new Error(err.error || 'Export failed')
  }
  return res.blob()
}

export async function exportAll(postId) {
  const res = await fetch('/api/export/all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Export failed' }))
    throw new Error(err.error || 'Export failed')
  }
  return res.blob()
}
