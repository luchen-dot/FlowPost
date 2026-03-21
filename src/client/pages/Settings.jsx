import { useState, useEffect } from 'react'
import useAppStore from '../store/appStore.js'

const PROVIDERS = [
  {
    key: 'Claude',
    label: 'Claude (Anthropic)',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    placeholder: 'sk-ant-api03-...',
    desc: '推荐用于文案生成和重写，质量最高',
    color: '#CC785C',
  },
  {
    key: 'OpenAI',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini'],
    placeholder: 'sk-...',
    desc: '用于向量化（text-embedding-3-small），Phase 2 知识库必需',
    color: '#10A37F',
  },
  {
    key: 'Gemini',
    label: 'Google Gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    placeholder: 'AIza...',
    desc: '可作为备用生成模型',
    color: '#4285F4',
  },
  {
    key: 'DeepSeek',
    label: 'DeepSeek',
    models: ['deepseek-chat'],
    placeholder: 'sk-...',
    desc: '性价比高，适合高频润色任务',
    color: '#6366F1',
  },
]

const TASK_LABELS = {
  draft_generate: '文案草稿生成',
  polish: '段落润色',
  rewrite: '段落重写',
}

export default function Settings() {
  const { setAiSettings, setActiveProvider } = useAppStore()
  const [settings, setSettings] = useState({})
  const [routing, setRouting] = useState({ draft_generate: 'Claude', polish: 'Claude', rewrite: 'Claude' })
  const [apiKeys, setApiKeys] = useState({})
  const [showKey, setShowKey] = useState({})
  const [saving, setSaving] = useState({})
  const [testing, setTesting] = useState({})
  const [testResults, setTestResults] = useState({})
  const [routingSaved, setRoutingSaved] = useState(false)

  useEffect(() => {
    loadSettings()
    loadRouting()
  }, [])

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      const map = {}
      data.forEach((s) => { map[s.provider] = s })
      setSettings(map)
      setAiSettings(data)
      const active = data.find((s) => s.is_active)
      if (active) setActiveProvider(active)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadRouting() {
    try {
      const res = await fetch('/api/settings/routing')
      const data = await res.json()
      if (Object.keys(data).length) setRouting(data)
    } catch {}
  }

  async function saveProvider(providerKey, isActive = false) {
    setSaving((s) => ({ ...s, [providerKey]: true }))
    setTestResults((r) => ({ ...r, [providerKey]: null }))

    try {
      const current = settings[providerKey] || {}
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerKey,
          model: current.model || PROVIDERS.find((p) => p.key === providerKey)?.models[0],
          apiKey: apiKeys[providerKey] !== undefined ? apiKeys[providerKey] : current.api_key,
          enabled: !!(apiKeys[providerKey] || current.api_key),
          isActive,
        }),
      })
      await loadSettings()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving((s) => ({ ...s, [providerKey]: false }))
    }
  }

  async function testProvider(providerKey) {
    setTesting((t) => ({ ...t, [providerKey]: true }))
    setTestResults((r) => ({ ...r, [providerKey]: null }))

    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerKey }),
      })
      const data = await res.json()
      setTestResults((r) => ({
        ...r,
        [providerKey]: data.ok ? { ok: true, msg: '连接成功 ✓' } : { ok: false, msg: data.error },
      }))
    } catch (err) {
      setTestResults((r) => ({ ...r, [providerKey]: { ok: false, msg: err.message } }))
    } finally {
      setTesting((t) => ({ ...t, [providerKey]: false }))
    }
  }

  async function saveRouting() {
    try {
      await fetch('/api/settings/routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routing }),
      })
      setRoutingSaved(true)
      setTimeout(() => setRoutingSaved(false), 2000)
    } catch {}
  }

  function updateModel(providerKey, model) {
    setSettings((s) => ({ ...s, [providerKey]: { ...s[providerKey], model } }))
  }

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>⚙️ Settings</h1>
      <p style={{ margin: '0 0 36px', color: 'var(--text-muted)', fontSize: 14 }}>
        配置 AI Provider 和任务路由。API Key 存储在本地 SQLite，不上传任何服务器。
      </p>

      {/* AI Providers */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>
          AI Provider 配置
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {PROVIDERS.map((p) => {
            const s = settings[p.key] || {}
            const isActive = !!s.is_active
            const isEnabled = !!s.enabled
            const currentModel = s.model || p.models[0]
            const testResult = testResults[p.key]

            return (
              <div
                key={p.key}
                className="card"
                style={{ borderLeft: `3px solid ${isEnabled ? p.color : 'var(--border)'}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: isEnabled ? p.color : 'var(--text-primary)' }}>
                        {p.label}
                      </div>
                      {isActive && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: p.color + '33', color: p.color, fontWeight: 600 }}>
                          激活中
                        </span>
                      )}
                      {isEnabled && !isActive && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#ffffff11', color: 'var(--text-muted)', fontWeight: 600 }}>
                          已配置
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{p.desc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isEnabled && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 12px' }}
                        disabled={testing[p.key]}
                        onClick={() => testProvider(p.key)}
                      >
                        {testing[p.key] ? '测试中...' : '测试连接'}
                      </button>
                    )}
                    {isEnabled && !isActive && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 12px', color: p.color, borderColor: p.color }}
                        onClick={() => saveProvider(p.key, true)}
                      >
                        设为激活
                      </button>
                    )}
                  </div>
                </div>

                {testResult && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: testResult.ok ? '#4AFFB011' : '#FF4A4A11',
                      color: testResult.ok ? 'var(--success)' : 'var(--danger)',
                      fontSize: 12,
                    }}
                  >
                    {testResult.msg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">API Key</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="input"
                        type={showKey[p.key] ? 'text' : 'password'}
                        placeholder={s.api_key ? '••••••••（已保存）' : p.placeholder}
                        value={apiKeys[p.key] !== undefined ? apiKeys[p.key] : ''}
                        onChange={(e) => setApiKeys((k) => ({ ...k, [p.key]: e.target.value }))}
                        style={{ paddingRight: 40 }}
                      />
                      <button
                        onClick={() => setShowKey((k) => ({ ...k, [p.key]: !k[p.key] }))}
                        style={{
                          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14,
                        }}
                      >
                        {showKey[p.key] ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">模型</label>
                    <select
                      className="input"
                      style={{ width: 'auto', minWidth: 180 }}
                      value={currentModel}
                      onChange={(e) => updateModel(p.key, e.target.value)}
                    >
                      {p.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ whiteSpace: 'nowrap' }}
                    disabled={saving[p.key]}
                    onClick={() => saveProvider(p.key, isActive)}
                  >
                    {saving[p.key] ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Task Routing */}
      <section>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>
          任务路由配置
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
          指定每种任务使用哪个 AI Provider
        </p>

        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(TASK_LABELS).map(([task, label]) => (
              <div key={task} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 140, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {label}
                </div>
                <select
                  className="input"
                  style={{ width: 'auto', minWidth: 160 }}
                  value={routing[task] || 'Claude'}
                  onChange={(e) => setRouting((r) => ({ ...r, [task]: e.target.value }))}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" onClick={saveRouting}>
              保存路由配置
            </button>
            {routingSaved && (
              <span style={{ fontSize: 13, color: 'var(--success)' }}>✓ 已保存</span>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
