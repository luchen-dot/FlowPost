import { useState } from 'react'

/**
 * AIPanel — floating panel for AI polish/rewrite actions
 *
 * Props:
 *   text: current text to operate on
 *   platform: current platform for style
 *   onApply(newText): callback with the AI result
 *   onClose(): callback to close the panel
 */
export default function AIPanel({ text, platform, onApply, onClose }) {
  const [mode, setMode] = useState('polish') // polish | rewrite
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  async function run() {
    setLoading(true)
    setResult('')
    setError('')

    const endpoint = mode === 'polish' ? '/api/ai/polish' : '/api/ai/rewrite'
    const body = mode === 'polish'
      ? { text, platform }
      : { text, platform, instruction }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.chunk) {
                accumulated += data.chunk
                setResult(accumulated)
              }
              if (data.error) setError(data.error)
            } catch {}
          }
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
          ✦ AI 助手
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
        >
          ×
        </button>
      </div>

      {/* Source text */}
      <div>
        <div className="label">当前文本</div>
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            color: 'var(--text-secondary)',
            maxHeight: 80,
            overflow: 'auto',
            lineHeight: 1.6,
          }}
        >
          {text || <span style={{ color: 'var(--text-muted)' }}>（无文本）</span>}
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { key: 'polish', label: '✨ 润色', desc: '保持原意，优化表达' },
          { key: 'rewrite', label: '🔄 重写', desc: '按要求重写内容' },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${mode === m.key ? 'var(--accent)' : 'var(--border)'}`,
              background: mode === m.key ? 'var(--accent)22' : 'transparent',
              color: mode === m.key ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: mode === m.key ? 600 : 400,
              textAlign: 'center',
              transition: 'all 0.15s',
            }}
          >
            {m.label}
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Rewrite instruction */}
      {mode === 'rewrite' && (
        <div>
          <label className="label">重写要求（可选）</label>
          <input
            className="input"
            placeholder="例：更简洁、更口语化、加入数字..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </div>
      )}

      {/* Action button */}
      <button
        className="btn btn-primary"
        onClick={run}
        disabled={loading || !text}
        style={{ justifyContent: 'center' }}
      >
        {loading ? (
          <>
            <span className="streaming-dot" />
            <span className="streaming-dot" style={{ animationDelay: '0.2s' }} />
            <span className="streaming-dot" style={{ animationDelay: '0.4s' }} />
            生成中...
          </>
        ) : (
          mode === 'polish' ? '✨ 开始润色' : '🔄 开始重写'
        )}
      </button>

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13, padding: '8px 12px', background: '#FF4A4A11', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <div className="label">AI 结果</div>
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--accent)44',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              maxHeight: 160,
              overflow: 'auto',
            }}
          >
            {result}
          </div>
          {!loading && (
            <button
              className="btn btn-primary"
              onClick={() => { onApply(result); onClose() }}
              style={{ marginTop: 10, justifyContent: 'center', width: '100%' }}
            >
              ✓ 应用此结果
            </button>
          )}
        </div>
      )}
    </div>
  )
}
