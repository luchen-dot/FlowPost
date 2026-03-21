/**
 * CardEditor — visual style controls for card appearance
 * Emits onChange(newStyle) when any control changes.
 */
export default function CardEditor({ style = {}, onChange }) {
  const s = {
    backgroundColor: '#1A1A2E',
    accentColor: '#4A9EFF',
    textColor: '#E8E8E8',
    fontSize: 28,
    padding: 60,
    showSignature: false,
    signature: '',
    ...style,
  }

  const update = (key, value) => onChange({ ...s, [key]: value })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: -8 }}>
        卡片样式
      </div>

      {/* Colors row */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label className="label">背景色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={s.backgroundColor}
              onChange={(e) => update('backgroundColor', e.target.value)}
              style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {s.backgroundColor}
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <label className="label">强调色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={s.accentColor}
              onChange={(e) => update('accentColor', e.target.value)}
              style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {s.accentColor}
            </span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <label className="label">文字色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={s.textColor}
              onChange={(e) => update('textColor', e.target.value)}
              style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {s.textColor}
            </span>
          </div>
        </div>
      </div>

      {/* Sliders row */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label className="label">字体大小 ({s.fontSize}px)</label>
          <input
            type="range"
            min={18}
            max={48}
            value={s.fontSize}
            onChange={(e) => update('fontSize', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <label className="label">内边距 ({s.padding}px)</label>
          <input
            type="range"
            min={32}
            max={100}
            value={s.padding}
            onChange={(e) => update('padding', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>
      </div>

      {/* Presets */}
      <div>
        <label className="label">快捷主题</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '4px 12px' }}
              onClick={() => onChange({ ...s, backgroundColor: preset.bg, accentColor: preset.accent, textColor: preset.text })}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  background: preset.bg,
                  border: `2px solid ${preset.accent}`,
                  borderRadius: 2,
                  marginRight: 4,
                }}
              />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Signature */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={s.showSignature}
            onChange={(e) => update('showSignature', e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>显示署名</span>
        </label>
        {s.showSignature && (
          <input
            className="input"
            style={{ flex: 1, maxWidth: 200 }}
            placeholder="你的署名"
            value={s.signature}
            onChange={(e) => update('signature', e.target.value)}
          />
        )}
      </div>
    </div>
  )
}

const PRESETS = [
  { name: '深空蓝', bg: '#1A1A2E', accent: '#4A9EFF', text: '#E8E8E8' },
  { name: '暗墨绿', bg: '#0D1F1A', accent: '#4AFFB0', text: '#D0EDD7' },
  { name: '深紫', bg: '#1A0F2E', accent: '#C084FC', text: '#E8E8E8' },
  { name: '暖黑', bg: '#1A1410', accent: '#FBBF24', text: '#F0E8D8' },
  { name: '纯黑', bg: '#0A0A0A', accent: '#FFFFFF', text: '#CCCCCC' },
]
