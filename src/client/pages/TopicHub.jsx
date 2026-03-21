import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAppStore from '../store/appStore.js'

const PLATFORMS = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'wechat', label: '公众号' },
  { value: 'jike', label: '即刻' },
  { value: 'twitter', label: 'Twitter/X' },
]

const STATUS_LABELS = {
  inbox: { label: '待处理', color: 'var(--text-muted)', bg: '#ffffff11' },
  writing: { label: '写作中', color: 'var(--accent)', bg: '#4A9EFF22' },
  done: { label: '已完成', color: 'var(--success)', bg: '#4AFFB022' },
  archived: { label: '已归档', color: 'var(--text-muted)', bg: '#ffffff08' },
}

const PLATFORM_COLORS = {
  xiaohongshu: { color: '#FF2442', label: '小红书' },
  wechat: { color: '#07C160', label: '公众号' },
  jike: { color: '#FFE411', label: '即刻' },
  twitter: { color: '#1DA1F2', label: 'Twitter' },
}

export default function TopicHub() {
  const navigate = useNavigate()
  const { topics, setTopics, addTopic, updateTopic, removeTopic } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({ title: '', platform: 'xiaohongshu', notes: '' })
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    loadTopics()
  }, [])

  async function loadTopics() {
    setLoading(true)
    try {
      const res = await fetch('/api/topics')
      const data = await res.json()
      setTopics(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function createTopic(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const topic = await res.json()
      addTopic(topic)
      setShowModal(false)
      setForm({ title: '', platform: 'xiaohongshu', notes: '' })
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(id, status) {
    try {
      await fetch(`/api/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      updateTopic(id, { status })
    } catch (err) {
      console.error(err)
    }
  }

  async function deleteTopic(id) {
    try {
      await fetch(`/api/topics/${id}`, { method: 'DELETE' })
      removeTopic(id)
      setDeleteConfirm(null)
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = filterStatus === 'all'
    ? topics
    : topics.filter((t) => t.status === filterStatus)

  const statusGroups = ['inbox', 'writing', 'done', 'archived']

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            📥 Topic Hub
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            {topics.length} 个选题 · 选择一个开始创作
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 新建选题
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ value: 'all', label: '全部' }, ...statusGroups.map((s) => ({ value: s, label: STATUS_LABELS[s].label }))].map(
          (tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: filterStatus === tab.value ? 'var(--accent)' : 'var(--border)',
                background: filterStatus === tab.value ? 'var(--accent)22' : 'transparent',
                color: filterStatus === tab.value ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: filterStatus === tab.value ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
              <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>
                {tab.value === 'all' ? topics.length : topics.filter((t) => t.status === tab.value).length}
              </span>
            </button>
          )
        )}
      </div>

      {/* Topic list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>加载中...</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 80,
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>暂无选题</div>
          <div style={{ fontSize: 13 }}>点击"新建选题"添加你的第一个创作想法</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onEnter={() => navigate(`/pipeline/${topic.id}`)}
              onStatusChange={(s) => updateStatus(topic.id, s)}
              onDelete={() => setDeleteConfirm(topic.id)}
              confirmingDelete={deleteConfirm === topic.id}
              onConfirmDelete={() => deleteTopic(topic.id)}
              onCancelDelete={() => setDeleteConfirm(null)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <form onSubmit={createTopic}>
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700 }}>新建选题</h2>

            <div style={{ marginBottom: 16 }}>
              <label className="label">选题标题 *</label>
              <input
                className="input"
                placeholder="你想写什么？一句话描述你的想法..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label">目标平台</label>
              <select
                className="input"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="label">备注（可选）</label>
              <textarea
                className="input"
                placeholder="记录灵感来源、参考链接、关键点..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={creating || !form.title.trim()}>
                {creating ? '创建中...' : '创建选题'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function TopicCard({ topic, onEnter, onStatusChange, onDelete, confirmingDelete, onConfirmDelete, onCancelDelete }) {
  const st = STATUS_LABELS[topic.status] || STATUS_LABELS.inbox
  const pl = PLATFORM_COLORS[topic.platform] || { color: '#999', label: topic.platform }

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)44')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {/* Platform dot */}
      <div
        style={{
          width: 4,
          height: 40,
          background: pl.color,
          borderRadius: 2,
          flexShrink: 0,
          opacity: 0.8,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }} onClick={onEnter}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {topic.title}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#ffffff11', color: 'var(--text-muted)' }}>
            {pl.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {new Date(topic.created_at).toLocaleDateString('zh-CN')}
          </span>
          {topic.notes && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              · {topic.notes}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span
        style={{
          fontSize: 12,
          padding: '3px 10px',
          borderRadius: 6,
          background: st.bg,
          color: st.color,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {st.label}
      </span>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          className="btn btn-primary"
          style={{ padding: '6px 14px', fontSize: 12 }}
          onClick={onEnter}
        >
          ✍️ 开始创作
        </button>

        {/* Status quick-change */}
        <select
          className="input"
          style={{ width: 'auto', padding: '6px 8px', fontSize: 12 }}
          value={topic.status}
          onChange={(e) => onStatusChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="inbox">待处理</option>
          <option value="writing">写作中</option>
          <option value="done">已完成</option>
          <option value="archived">归档</option>
        </select>

        {confirmingDelete ? (
          <>
            <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 12px' }} onClick={onConfirmDelete}>
              确认删除
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={onCancelDelete}>
              取消
            </button>
          </>
        ) : (
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: 12, color: 'var(--text-muted)' }}
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            🗑
          </button>
        )}
      </div>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#00000088',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 32,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 24px 80px #00000080',
        }}
      >
        {children}
      </div>
    </div>
  )
}
