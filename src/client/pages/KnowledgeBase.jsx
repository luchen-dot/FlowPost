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

const MODAL_STYLE = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
}

const MODAL_BOX_STYLE = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 28,
  width: 480,
  maxWidth: '90vw',
}

const INPUT_STYLE = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 13,
  boxSizing: 'border-box',
}

// ── TrendRadar Config panel ────────────────────────────────────────────────────

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
    <div style={MODAL_STYLE} onClick={onClose}>
      <div style={MODAL_BOX_STYLE} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>TrendRadar 连接配置</h3>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            TrendRadar 数据库路径（.db 文件绝对路径）
          </div>
          <input
            value={dbPath}
            onChange={(e) => setDbPath(e.target.value)}
            placeholder="/path/to/trendradar/data/news.db"
            style={INPUT_STYLE}
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
            style={{ ...INPUT_STYLE, width: 100 }}
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
            style={{ ...INPUT_STYLE, resize: 'vertical' }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            取消
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NewsNow Config panel ───────────────────────────────────────────────────────

const ALL_PLATFORMS = [
  { id: 'zhihu', label: '知乎热榜' },
  { id: 'weibo', label: '微博热搜' },
  { id: 'bilibili', label: 'B站热门' },
  { id: 'baidu', label: '百度热搜' },
  { id: 'toutiao', label: '今日头条' },
  { id: 'douyin', label: '抖音热榜' },
  { id: 'tieba', label: '贴吧热议' },
  { id: 'thepaper', label: '澎湃新闻' },
  { id: 'wallstreetcn', label: '华尔街见闻' },
  { id: 'ifeng', label: '凤凰资讯' },
  { id: 'cls', label: '财联社' },
]

function NewsnowConfigPanel({ config, onSave, onClose }) {
  const [interest, setInterest] = useState(config?.interest_description || '')
  const [platforms, setPlatforms] = useState(
    Array.isArray(config?.platforms) ? config.platforms : ['zhihu', 'weibo', 'bilibili', 'baidu', 'toutiao']
  )
  const [keywords, setKeywords] = useState(
    Array.isArray(config?.keywords) ? config.keywords.join(', ') : ''
  )
  const [minScore, setMinScore] = useState(config?.min_relevance ?? 0.6)
  const [useAI, setUseAI] = useState(config?.use_ai_filter !== 0)
  const [saving, setSaving] = useState(false)

  function togglePlatform(id) {
    setPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiFetch('/newsnow/config', {
        method: 'PUT',
        body: JSON.stringify({
          interest_description: interest.trim(),
          platforms,
          keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
          min_relevance: parseFloat(minScore),
          use_ai_filter: useAI ? 1 : 0,
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
    <div style={MODAL_STYLE} onClick={onClose}>
      <div style={{ ...MODAL_BOX_STYLE, width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>NewsNow 直连配置</h3>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-muted)' }}>
          直接从 NewsNow 聚合平台拉取热榜，无需安装 TrendRadar
        </p>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            我关注的主题（自然语言描述，Claude 用此给资讯打相关度分）
          </div>
          <textarea
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            rows={3}
            placeholder="例：AI 工具、内容创作、自媒体运营、产品设计"
            style={{ ...INPUT_STYLE, resize: 'vertical' }}
          />
        </label>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>抓取平台</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: platforms.includes(p.id) ? 'var(--accent)' : 'transparent',
                  color: platforms.includes(p.id) ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            关键词预过滤（逗号分隔，留空则不过滤）
          </div>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="AI, 人工智能, 创作, 自媒体"
            style={INPUT_STYLE}
          />
        </label>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
            />
            启用 Claude AI 打分
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>最低分数</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              style={{ ...INPUT_STYLE, width: 70 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            取消
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13 }}>
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
  const [showNewsnowConfig, setShowNewsnowConfig] = useState(false)
  const [newsnowConfig, setNewsnowConfig] = useState(null)
  const [syncResult, setSyncResult] = useState(null)
  const [syncMessage, setSyncMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [feedPage, setFeedPage] = useState(1)
  // 'trendradar' | 'newsnow'
  const [activeSource, setActiveSource] = useState('newsnow')

  // Load all data on mount
  useEffect(() => {
    loadConfig()
    loadNewsnowConfig()
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

  async function loadNewsnowConfig() {
    try {
      const cfg = await apiFetch('/newsnow/config')
      setNewsnowConfig(cfg)
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
    setSyncMessage('')
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

  async function handleNewsnowSync() {
    setKbSyncing(true)
    setSyncResult(null)
    setSyncMessage('连接 NewsNow…')
    try {
      const res = await fetch('/api/kb/newsnow/sync', { method: 'POST' })
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
            if (data.error) {
              setSyncResult({ error: data.error })
            } else if (data.done) {
              setSyncResult(data)
              setSyncMessage('')
              await loadFeeds(1)
              await loadNewsnowConfig()
            } else if (data.message) {
              setSyncMessage(data.message)
            }
          } catch {}
        }
      }
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
  const lastSynced = activeSource === 'newsnow'
    ? newsnowConfig?.last_synced_at
    : kbConfig?.last_synced_at

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top bar ── */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>知识库</h1>

        {/* Source switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
          {[
            { key: 'newsnow', label: '直连热榜' },
            { key: 'trendradar', label: 'TrendRadar' },
          ].map((src) => (
            <button
              key={src.key}
              onClick={() => { setActiveSource(src.key); setSyncResult(null); setSyncMessage('') }}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: activeSource === src.key ? 'var(--accent)' : 'transparent',
                color: activeSource === src.key ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {src.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {lastSynced && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            上次同步：{new Date(lastSynced).toLocaleString('zh-CN')}
          </span>
        )}

        {syncMessage && !syncResult && (
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>{syncMessage}</span>
        )}

        {syncResult && (
          <span style={{ fontSize: 12, color: syncResult.error ? '#f87171' : '#4ade80' }}>
            {syncResult.error
              ? `错误: ${syncResult.error}`
              : activeSource === 'newsnow'
                ? `+${syncResult.added} 条（抓取 ${syncResult.total}，筛选 ${syncResult.qualified}）`
                : `+${syncResult.added} 条（过滤 ${syncResult.filtered}/${syncResult.total}）`}
          </span>
        )}

        {activeSource === 'newsnow' ? (
          <>
            <button
              onClick={() => setShowNewsnowConfig(true)}
              style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}
            >
              ⚙ 配置
            </button>
            <button
              onClick={handleNewsnowSync}
              disabled={kbSyncing}
              style={{ padding: '6px 14px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', cursor: kbSyncing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {kbSyncing ? '同步中…' : '▶ 立即同步'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowConfig(true)}
              style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}
            >
              {hasDbPath ? '⚙ 配置' : '⚙ 连接 TrendRadar'}
            </button>
            <button
              onClick={handleSync}
              disabled={kbSyncing || !hasDbPath}
              style={{ padding: '6px 14px', background: hasDbPath ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, color: hasDbPath ? '#fff' : 'var(--text-muted)', cursor: hasDbPath && !kbSyncing ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600 }}
            >
              {kbSyncing ? '同步中…' : '▶ 立即同步'}
            </button>
          </>
        )}
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
            {kbFeeds.length === 0 ? (
              activeSource === 'newsnow'
                ? <EmptyState icon="📡" text="点击右上角「立即同步」从热榜平台直接拉取资讯" />
                : !hasDbPath
                  ? <EmptyState icon="🔌" text="请先点击右上角「连接 TrendRadar」配置数据库路径" />
                  : <EmptyState icon="📭" text="暂无资讯，点击「立即同步」从 TrendRadar 拉取" />
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

      {/* TrendRadar config modal */}
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

      {/* NewsNow config modal */}
      {showNewsnowConfig && (
        <NewsnowConfigPanel
          config={newsnowConfig}
          onSave={() => {
            setShowNewsnowConfig(false)
            loadNewsnowConfig()
          }}
          onClose={() => setShowNewsnowConfig(false)}
        />
      )}
    </div>
  )
}
