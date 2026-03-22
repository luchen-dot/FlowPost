import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAppStore from '../store/appStore'

// ── helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(`/api/kb${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function Tag({ label, color = 'var(--accent)' }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 99,
        background: `${color}22`,
        color,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function ScoreBadge({ score }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const color = score >= 0.8 ? '#4ade80' : score >= 0.6 ? '#facc15' : '#94a3b8'
  return <Tag label={`${pct}%`} color={color} />
}

function EmptyState({ icon, text }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 16px',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      {text}
    </div>
  )
}

// ── Config panel ──────────────────────────────────────────────────────────────

function ConfigPanel({ config, onSave, onClose }) {
  const [dbPath, setDbPath] = useState(config?.db_path || '')
  const [minScore, setMinScore] = useState(config?.min_relevance ?? 0.6)
  const [keywords, setKeywords] = useState(
    Array.isArray(config?.topic_keywords) ? config.topic_keywords.join(', ') : ''
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await apiFetch('/config', {
        method: 'PUT',
        body: JSON.stringify({
          db_path: dbPath.trim(),
          min_relevance: parseFloat(minScore),
          topic_keywords: keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
        }),
      })
      onSave()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 28,
          width: 480,
          maxWidth: '90vw',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>TrendRadar 连接配置</h3>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            TrendRadar 数据库路径（.db 文件绝对路径）
          </div>
          <input
            value={dbPath}
            onChange={(e) => setDbPath(e.target.value)}
            placeholder="/path/to/trendradar/data/news.db"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            最低相关度分数（0~1，默认 0.6）
          </div>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            style={{
              width: 100,
              padding: '8px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            主题关键词（逗号分隔，仅导入含这些词的资讯）
          </div>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Feed item card ────────────────────────────────────────────────────────────

function FeedCard({ item, onSave, onDelete }) {
  const [loading, setLoading] = useState(false)
  const tags = item.summary
    ? item.summary
        .replace(/^\[|\]$/g, '')
        .split(',')
        .filter(Boolean)
    : []

  async function handleSave() {
    setLoading(true)
    try {
      await apiFetch(`/feeds/${item.id}/save`, { method: 'POST' })
      onSave(item.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    await apiFetch(`/feeds/${item.id}`, { method: 'DELETE' })
    onDelete(item.id)
  }

  return (
    <div
      style={{
        padding: '12px 14px',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 8,
        background: 'var(--bg-secondary)',
      }}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {item.source_name && (
          <Tag label={item.source_name} color="var(--text-muted)" />
        )}
        {tags.slice(0, 2).map((t) => (
          <Tag key={t} label={t} />
        ))}
        <ScoreBadge score={item.relevance_score} />
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textDecoration: 'none',
          lineHeight: 1.5,
          display: 'block',
          marginBottom: 8,
        }}
      >
        {item.title}
      </a>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {loading ? '…' : '存入知识库'}
        </button>
        <button
          onClick={handleDelete}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          忽略
        </button>
      </div>
    </div>
  )
}

// ── Doc card ──────────────────────────────────────────────────────────────────

function DocCard({ doc, onDelete }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 8,
        background: 'var(--bg-secondary)',
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        {doc.source && <Tag label={doc.source} color="var(--text-muted)" />}
        {doc.category && <Tag label={doc.category} />}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 6,
          lineHeight: 1.5,
        }}
      >
        {doc.title}
      </div>
      {doc.raw_text && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 8,
            lineHeight: 1.6,
          }}
        >
          {doc.raw_text.slice(0, 100)}…
        </div>
      )}
      <button
        onClick={() => onDelete(doc.id)}
        style={{
          padding: '3px 8px',
          fontSize: 11,
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        删除
      </button>
    </div>
  )
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({ s, onAdopt, onDismiss }) {
  const [loading, setLoading] = useState(false)

  async function handleAdopt() {
    setLoading(true)
    try {
      await apiFetch(`/suggestions/${s.id}/adopt`, { method: 'POST' })
      onAdopt(s.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDismiss() {
    await apiFetch(`/suggestions/${s.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'dismissed' }),
    })
    onDismiss(s.id)
  }

  return (
    <div
      style={{
        padding: '12px 14px',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 8,
        background: 'var(--bg-secondary)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: 6,
          lineHeight: 1.5,
        }}
      >
        {s.title}
      </div>
      {s.angle && (
        <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 4, lineHeight: 1.5 }}>
          角度：{s.angle}
        </div>
      )}
      {s.source_summary && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          参考：{s.source_summary}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleAdopt}
          disabled={loading}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {loading ? '…' : '采用 → 选题'}
        </button>
        <button
          onClick={handleDismiss}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          忽略
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const navigate = useNavigate()
  const {
    kbFeeds, kbFeedsTotal, setKbFeeds,
    kbDocs, setKbDocs,
    kbSuggestions, setKbSuggestions,
    kbConfig, setKbConfig,
    kbSyncing, setKbSyncing,
  } = useAppStore()

  const [showConfig, setShowConfig] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [feedPage, setFeedPage] = useState(1)

  // Load all data on mount
  useEffect(() => {
    loadConfig()
    loadFeeds(1)
    loadDocs()
    loadSuggestions()
  }, [])

  async function loadConfig() {
    try {
      const cfg = await apiFetch('/config')
      setKbConfig(cfg)
    } catch {}
  }

  async function loadFeeds(page = 1) {
    try {
      const data = await apiFetch(`/feeds?page=${page}&limit=50`)
      setKbFeeds(data.items, data.total)
      setFeedPage(page)
    } catch {}
  }

  async function loadDocs() {
    try {
      const docs = await apiFetch('/docs')
      setKbDocs(docs)
    } catch {}
  }

  async function loadSuggestions() {
    try {
      const rows = await apiFetch('/suggestions')
      setKbSuggestions(rows)
    } catch {}
  }

  async function handleSync() {
    setKbSyncing(true)
    setSyncResult(null)
    try {
      const result = await apiFetch('/sync', { method: 'POST' })
      setSyncResult(result)
      await loadFeeds(1)
    } catch (err) {
      setSyncResult({ error: err.message })
    } finally {
      setKbSyncing(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/kb/suggestions/generate', { method: 'POST' })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter((l) => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.done) await loadSuggestions()
          } catch {}
        }
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const hasDbPath = kbConfig?.db_path

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top bar ── */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>知识库</h1>

        {kbConfig?.last_synced_at && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            上次同步：{new Date(kbConfig.last_synced_at).toLocaleString('zh-CN')}
          </span>
        )}

        {syncResult && (
          <span
            style={{
              fontSize: 12,
              color: syncResult.error ? '#f87171' : '#4ade80',
            }}
          >
            {syncResult.error
              ? `错误: ${syncResult.error}`
              : `+${syncResult.added} 条（过滤 ${syncResult.filtered}/${syncResult.total}）`}
          </span>
        )}

        <button
          onClick={() => setShowConfig(true)}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {hasDbPath ? '⚙ 配置' : '⚙ 连接 TrendRadar'}
        </button>

        <button
          onClick={handleSync}
          disabled={kbSyncing || !hasDbPath}
          style={{
            padding: '6px 14px',
            background: hasDbPath ? 'var(--accent)' : 'var(--border)',
            border: 'none',
            borderRadius: 8,
            color: hasDbPath ? '#fff' : 'var(--text-muted)',
            cursor: hasDbPath ? 'pointer' : 'not-allowed',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {kbSyncing ? '同步中…' : '▶ 立即同步'}
        </button>
      </div>

      {/* ── 3-column body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Column 1: Inbox */}
        <div
          style={{
            flex: 1,
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span>资讯收件箱</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              {kbFeedsTotal} 条
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {!hasDbPath ? (
              <EmptyState icon="🔌" text="请先点击右上角「连接 TrendRadar」配置数据库路径" />
            ) : kbFeeds.length === 0 ? (
              <EmptyState icon="📭" text="暂无资讯，点击「立即同步」从 TrendRadar 拉取" />
            ) : (
              <>
                {kbFeeds.map((item) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    onSave={(id) => {
                      setKbFeeds(kbFeeds.filter((f) => f.id !== id), kbFeedsTotal - 1)
                      loadDocs()
                    }}
                    onDelete={(id) => {
                      setKbFeeds(kbFeeds.filter((f) => f.id !== id), kbFeedsTotal - 1)
                    }}
                  />
                ))}
                {kbFeedsTotal > kbFeeds.length && (
                  <button
                    onClick={() => loadFeeds(feedPage + 1)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    加载更多
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 2: Knowledge base docs */}
        <div
          style={{
            flex: 1,
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span>知识库文档</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              {kbDocs.length} 篇
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {kbDocs.length === 0 ? (
              <EmptyState icon="📚" text="从收件箱点击「存入知识库」添加文档" />
            ) : (
              kbDocs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onDelete={(id) => {
                    apiFetch(`/docs/${id}`, { method: 'DELETE' })
                    setKbDocs(kbDocs.filter((d) => d.id !== id))
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: AI topic suggestions */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <span>AI 选题建议</span>
            <button
              onClick={handleGenerate}
              disabled={generating || kbDocs.length === 0}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                background: kbDocs.length > 0 ? 'var(--accent)' : 'var(--border)',
                color: kbDocs.length > 0 ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 6,
                cursor: kbDocs.length > 0 ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              {generating ? '生成中…' : '✦ AI 生成'}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {kbSuggestions.length === 0 ? (
              <EmptyState icon="💡" text={kbDocs.length === 0 ? '先存入文档，再用 AI 生成选题' : '点击「AI 生成」自动提炼创作选题'} />
            ) : (
              kbSuggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  s={s}
                  onAdopt={(id) => {
                    setKbSuggestions(kbSuggestions.filter((x) => x.id !== id))
                    navigate('/')
                  }}
                  onDismiss={(id) => {
                    setKbSuggestions(kbSuggestions.filter((x) => x.id !== id))
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Config modal */}
      {showConfig && (
        <ConfigPanel
          config={kbConfig}
          onSave={() => {
            setShowConfig(false)
            loadConfig()
          }}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}
