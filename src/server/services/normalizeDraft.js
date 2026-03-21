/**
 * Normalizes AI-generated text into a structured draft object.
 * Tries fenced JSON → bare JSON → plain-text fallback.
 *
 * @param {string} fullText         Raw AI output
 * @param {string} fallbackTitle    Used when titles are missing
 * @param {number} expectedCardCount  Target card count (default 3)
 * @returns {{ titles: string[], cards: {title:string, content:string}[], hashtags: string[] }}
 */
export function normalizeDraft(fullText, fallbackTitle = '未命名', expectedCardCount = 3) {
  let parsed = null

  // 1. Try fenced JSON block
  const fenced = fullText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try { parsed = JSON.parse(fenced[1].trim()) } catch {}
  }

  // 2. Try bare JSON (find outermost { ... })
  if (!parsed) {
    const match = fullText.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch {}
    }
  }

  // 3. Plain-text fallback: split by paragraphs into cards
  if (!parsed) {
    const paragraphs = fullText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    const cards = paragraphs.length > 0
      ? paragraphs.slice(0, expectedCardCount).map((p, i) => ({ title: `卡片 ${i + 1}`, content: p }))
      : [{ title: '正文', content: fullText.trim() }]

    return { titles: [fallbackTitle], cards, hashtags: [] }
  }

  // Normalize titles
  let titles = Array.isArray(parsed.titles) ? parsed.titles.filter(Boolean) : []
  if (!titles.length) titles = [fallbackTitle]

  // Normalize cards: pad to expectedCardCount, cap at expectedCardCount + 2
  let cards = Array.isArray(parsed.cards) ? parsed.cards : []
  while (cards.length < expectedCardCount) {
    cards.push({ title: `卡片 ${cards.length + 1}`, content: '' })
  }
  if (cards.length > expectedCardCount + 2) {
    cards = cards.slice(0, expectedCardCount + 2)
  }

  // Normalize hashtags
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : []

  return { titles, cards, hashtags }
}
