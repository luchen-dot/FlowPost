import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import flowDb from '../db/database.js'

const DEFAULT_KEYWORDS = [
  'AI', '人工智能', '大模型', 'LLM', 'GPT', 'Claude', 'Gemini', 'Grok',
  '创作', '内容', '写作', '自媒体', '博主', '运营', '小红书', '公众号',
  '生成式', 'AIGC', '多模态', 'agent', 'Agent',
]

function getConfig() {
  const row = flowDb.prepare('SELECT * FROM trendradar_config WHERE id = 1').get()
  if (!row) return null
  return {
    ...row,
    topic_keywords: row.topic_keywords ? JSON.parse(row.topic_keywords) : DEFAULT_KEYWORDS,
  }
}

/**
 * Sync AI/content-related news from TrendRadar SQLite into FlowPost feed_items.
 * Returns { total, filtered, added, skipped, error? }
 */
export function syncFromTrendRadar() {
  const config = getConfig()
  if (!config?.db_path) {
    return { total: 0, filtered: 0, added: 0, skipped: 0, error: 'TrendRadar DB 路径未配置' }
  }
  if (!existsSync(config.db_path)) {
    return { total: 0, filtered: 0, added: 0, skipped: 0, error: `文件不存在: ${config.db_path}` }
  }

  const keywords = config.topic_keywords?.length ? config.topic_keywords : DEFAULT_KEYWORDS
  const minScore = config.min_relevance ?? 0.6
  const lastSync = config.last_synced_at || null

  let trDb
  try {
    trDb = new Database(config.db_path, { readonly: true })
  } catch (err) {
    return { total: 0, filtered: 0, added: 0, skipped: 0, error: `无法打开 DB: ${err.message}` }
  }

  // Check what tables exist in TrendRadar DB
  const tables = trDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name)

  const hasAiFilter = tables.includes('ai_filter_results') && tables.includes('ai_filter_tags')
  const hasPlatforms = tables.includes('platforms')

  let rows = []

  try {
    if (hasAiFilter) {
      // Use AI-filtered results (primary path)
      const platformJoin = hasPlatforms
        ? 'JOIN platforms p ON ni.platform_id = p.id'
        : ''
      const platformName = hasPlatforms ? 'p.name' : 'ni.platform_id'

      rows = trDb
        .prepare(
          `SELECT ni.id as tr_id, ni.title, ni.url,
                  ni.platform_id as source, ${platformName} as source_name,
                  ni.first_crawl_time as published_at,
                  MAX(afr.relevance_score) as relevance_score,
                  GROUP_CONCAT(DISTINCT aft.tag) as tags
           FROM news_items ni
           ${platformJoin}
           JOIN ai_filter_results afr ON ni.id = afr.news_item_id
           JOIN ai_filter_tags aft ON afr.tag_id = aft.id
           WHERE afr.matched = 1
             AND afr.relevance_score >= ?
             AND (? IS NULL OR ni.first_crawl_time > ?)
           GROUP BY ni.id
           ORDER BY ni.first_crawl_time DESC
           LIMIT 500`
        )
        .all(minScore, lastSync, lastSync)
    } else if (tables.includes('news_items')) {
      // Fallback: no AI filter table, pull all recent news_items
      const platformJoin = hasPlatforms ? 'LEFT JOIN platforms p ON ni.platform_id = p.id' : ''
      const platformName = hasPlatforms ? 'p.name' : 'ni.platform_id'
      rows = trDb
        .prepare(
          `SELECT ni.id as tr_id, ni.title, ni.url,
                  ni.platform_id as source, ${platformName} as source_name,
                  ni.first_crawl_time as published_at,
                  0.7 as relevance_score,
                  NULL as tags
           FROM news_items ni
           ${platformJoin}
           WHERE (? IS NULL OR ni.first_crawl_time > ?)
           ORDER BY ni.first_crawl_time DESC
           LIMIT 500`
        )
        .all(lastSync, lastSync)
    }
  } catch (err) {
    trDb.close()
    return { total: 0, filtered: 0, added: 0, skipped: 0, error: `查询失败: ${err.message}` }
  }

  trDb.close()

  const total = rows.length

  // Layer 2: topic keyword filter in JS (case-insensitive)
  const kwLower = keywords.map((k) => k.toLowerCase())
  const filtered = rows.filter((row) => {
    const text = `${row.title || ''} ${row.tags || ''}`.toLowerCase()
    return kwLower.some((kw) => text.includes(kw))
  })

  // Insert into FlowPost feed_items, deduplicating by URL
  const insertStmt = flowDb.prepare(`
    INSERT INTO feed_items
      (source, source_name, title, url, summary, published_at, relevance_score, trendradar_id)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM feed_items WHERE url = ?)
  `)

  let added = 0
  const insertMany = flowDb.transaction((items) => {
    for (const row of items) {
      const summary = row.tags ? `[${row.tags}]` : null
      const changes = insertStmt.run(
        row.source,
        row.source_name,
        row.title,
        row.url,
        summary,
        row.published_at,
        row.relevance_score,
        row.tr_id,
        row.url
      ).changes
      if (changes) added++
    }
  })

  insertMany(filtered)

  // Update last_synced_at
  flowDb
    .prepare(
      `INSERT INTO trendradar_config (id, last_synced_at, updated_at)
       VALUES (1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`
    )
    .run()

  return {
    total,
    filtered: filtered.length,
    added,
    skipped: filtered.length - added,
  }
}
