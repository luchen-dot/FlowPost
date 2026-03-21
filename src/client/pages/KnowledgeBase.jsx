export default function KnowledgeBase() {
  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>🧠 Knowledge Base</h1>
      <p style={{ margin: '0 0 32px', color: 'var(--text-muted)', fontSize: 14 }}>
        知识库管理 — Phase 2 功能
      </p>

      <div
        style={{
          padding: 60,
          textAlign: 'center',
          border: '1px dashed var(--border)',
          borderRadius: 16,
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
          Phase 2 功能
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, maxWidth: 480, margin: '0 auto' }}>
          知识库将在 Phase 2（Week 3-4）实现，包括：
        </div>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--text-muted)', alignItems: 'flex-start', maxWidth: 320, margin: '20px auto 0' }}>
          {[
            'Notion SDK 接入 + 增量同步',
            'Word/PDF 附件解析',
            '文本切片 + Embedding 向量化',
            '语义搜索（相似度检索）',
            '定时选题挖掘（每日 06:00）',
            '主动方向挖掘（关键词输入）',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--border)', fontSize: 10 }}>○</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
