import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CardPreview from '../components/CardPreview.jsx'
import CardEditor from '../components/CardEditor.jsx'
import AIPanel from '../components/AIPanel.jsx'
import { STEPS, CONTENT_FORMS, PLATFORMS, DEFAULT_BRIEF, DEFAULT_CARD_STYLE } from '../constants/pipeline.js'
import { fetchTopic, fetchPostByTopic, savePost as apiSavePost, requestDraftGeneration, exportPng as apiExportPng, exportAll as apiExportAll } from '../api/pipelineApi.js'

export default function Pipeline() {
  const { topicId } = useParams()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [topic, setTopic] = useState(null)
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const hasChanges = useRef(false)

  // Brief
  const [brief, setBrief] = useState(DEFAULT_BRIEF)

  // Generation
  const [generating, setGenerating] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [draft, setDraft] = useState(null) // { titles, cards, hashtags }
  const [selectedTitle, setSelectedTitle] = useState(0)

  // Cards (editable)
  const [cards, setCards] = useState([]) // [{ title, content }]
  const [cardStyle, setCardStyle] = useState(DEFAULT_CARD_STYLE)

  // AI Panel
  const [aiPanel, setAiPanel] = useState(null) // { cardIndex, field }

  // Export
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')

  useEffect(() => {
    loadData()
  }, [topicId])

  // Wrappers that mark data as changed before updating state
  function updateBrief(val) { hasChanges.current = true; setBrief(val) }
  function updateCards(val) { hasChanges.current = true; setCards(val) }
  function updateCardStyle(val) { hasChanges.current = true; setCardStyle(val) }
  function updateSelectedTitle(val) { hasChanges.current = true; setSelectedTitle(val) }

  async function loadData() {
    setLoading(true)
    try {
      const [topicData, postData] = await Promise.all([
        fetchTopic(topicId),
        fetchPostByTopic(topicId),
      ])

      setTopic(topicData)
      setPost(postData)

      const cd = postData.card_data ? JSON.parse(postData.card_data) : {}

      if (cd.brief) setBrief({ ...brief, ...cd.brief })
      if (cd.cards?.length) setCards(cd.cards)
      if (cd.style) setCardStyle(cd.style)
      if (cd.titles?.length) {
        setDraft({ titles: cd.titles, cards: cd.cards || [], hashtags: cd.hashtags || [] })
        setSelectedTitle(cd.selectedTitle || 0)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function savePost(updates = {}) {
    if (!post) return
    setSaving(true)
    hasChanges.current = false
    try {
      const currentCd = post.card_data ? JSON.parse(post.card_data) : {}
      const newCd = {
        ...currentCd,
        brief,
        titles: draft?.titles || [],
        selectedTitle,
        cards,
        hashtags: draft?.hashtags || [],
        style: cardStyle,
        ...updates.cardData,
      }
      const updated = await apiSavePost(post.id, {
        title: draft?.titles?.[selectedTitle] || null,
        cardData: newCd,
        ...updates,
      })
      setPost(updated)
    } catch (err) {
      console.error(err)
      hasChanges.current = true // restore flag so retry is possible
    } finally {
      setSaving(false)
    }
  }

  async function generateDraft() {
    setGenerating(true)
    setStreamText('')
    setError('')

    try {
      const response = await requestDraftGeneration(topic.title, brief)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let result = null

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
              if (data.chunk) setStreamText((prev) => prev + data.chunk)
              if (data.done && data.result) result = data.result
              if (data.error) throw new Error(data.error)
            } catch (e) {
              if (e.message !== 'Unexpected token') throw e
            }
          }
        }
      }

      if (result) {
        setDraft(result)
        setSelectedTitle(0)
        setCards(result.cards || [])
        hasChanges.current = true
      } else {
        setError('AI 生成内容为空，请重试')
      }
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('未配置') || msg.includes('No AI provider')) {
        setError('未配置 AI Provider，请先前往 Settings 添加 API Key')
      } else if (msg.includes('API Key') || msg.includes('无效')) {
        setError(msg)
      } else {
        setError(`生成失败：${msg}`)
      }
    } finally {
      setGenerating(false)
    }
  }

  async function exportPng(cardIndex) {
    setExporting(true)
    setExportStatus('导出中...')
    try {
      await savePost()
      const blob = await apiExportPng(post.id, cardIndex)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `card_${cardIndex + 1}.png`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus('✓ 导出成功')
    } catch (err) {
      setExportStatus(`✗ ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  async function exportAll() {
    setExporting(true)
    setExportStatus('正在渲染所有卡片...')
    try {
      await savePost()
      const blob = await apiExportAll(post.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `flowpost_${post.id}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setExportStatus('✓ 全部导出成功')
    } catch (err) {
      setExportStatus(`✗ ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  function goStep(n) {
    if (hasChanges.current) savePost()
    setStep(n)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        加载中...
      </div>
    )
  }

  if (!topic) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>选题不存在</div>
        <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => navigate('/topics')}>
          返回选题中心
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div
        style={{
          padding: '16px 32px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('/topics')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{topic.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>创作流水线</div>
        </div>
        {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>保存中...</span>}
      </div>

      {/* Step tabs */}
      <div
        style={{
          display: 'flex',
          padding: '0 32px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        {STEPS.map((s) => (
          <button
            key={s.n}
            onClick={() => goStep(s.n)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: step === s.n ? '2px solid var(--accent)' : '2px solid transparent',
              color: step === s.n ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: step === s.n ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            <span>{s.icon}</span>
            <span>Step {s.n}: {s.label}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {error && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FF4A4A11', border: '1px solid var(--danger)', borderRadius: 8, color: 'var(--danger)', fontSize: 13 }}>
            {error}
            <button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {step === 1 && (
          <StepBrief brief={brief} onChange={updateBrief} />
        )}

        {step === 2 && (
          <StepGenerate
            topic={topic}
            brief={brief}
            generating={generating}
            streamText={streamText}
            draft={draft}
            selectedTitle={selectedTitle}
            onSelectTitle={updateSelectedTitle}
            onGenerate={generateDraft}
          />
        )}

        {step === 3 && (
          cards.length === 0 ? (
            <EmptyStep message="请先在 Step 2 生成草稿" onGoBack={() => setStep(2)} />
          ) : (
            <StepEdit
              cards={cards}
              onChange={updateCards}
              platform={brief.platform}
              draft={draft}
              selectedTitle={selectedTitle}
              onSelectTitle={updateSelectedTitle}
              aiPanel={aiPanel}
              onOpenAIPanel={(idx, field) => setAiPanel({ cardIndex: idx, field })}
              onCloseAIPanel={() => setAiPanel(null)}
            />
          )
        )}

        {step === 4 && (
          cards.length === 0 ? (
            <EmptyStep message="请先在 Step 2-3 生成并编辑内容" onGoBack={() => setStep(2)} />
          ) : (
            <StepPreview
              cards={cards}
              style={cardStyle}
              platform={brief.platform}
              onChange={updateCards}
              onStyleChange={updateCardStyle}
            />
          )
        )}

        {step === 5 && cards.length === 0 && (
          <EmptyStep message="当前还没有可导出的卡片，请先完成 Step 2-3" onGoBack={() => setStep(2)} />
        )}

        {step === 5 && cards.length > 0 && (
          <StepExport
            cards={cards}
            post={post}
            draft={draft}
            selectedTitle={selectedTitle}
            exporting={exporting}
            exportStatus={exportStatus}
            onExportSingle={exportPng}
            onExportAll={exportAll}
          />
        )}
      </div>

      {/* Bottom navigation */}
      <div
        style={{
          padding: '16px 32px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={() => step > 1 && goStep(step - 1)}
          disabled={step === 1}
        >
          ← 上一步
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {step} / {STEPS.length}
        </span>
        <button
          className="btn btn-primary"
          onClick={() => step < STEPS.length && goStep(step + 1)}
          disabled={step === STEPS.length}
        >
          下一步 →
        </button>
      </div>
    </div>
  )
}

/* ─── Empty state placeholder ─── */
function EmptyStep({ message, onGoBack }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
      <div style={{ fontSize: 15, marginBottom: 16 }}>{message}</div>
      <button className="btn btn-secondary" onClick={onGoBack}>← 返回生成</button>
    </div>
  )
}

/* ─── Step 1: Brief ─── */
function StepBrief({ brief, onChange }) {
  const upd = (key, val) => onChange({ ...brief, [key]: val })

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>📋 填写 Brief</h2>
      <p style={{ margin: '0 0 28px', color: 'var(--text-muted)', fontSize: 14 }}>
        告诉 AI 你想写什么，越清晰输出越好
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label className="label">目标平台</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => upd('platform', p.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${brief.platform === p.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: brief.platform === p.value ? 'var(--accent)22' : 'transparent',
                  color: brief.platform === p.value ? 'var(--accent)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: brief.platform === p.value ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">目标读者</label>
          <input
            className="input"
            placeholder="例：想用 AI 提效的产品经理"
            value={brief.targetAudience}
            onChange={(e) => upd('targetAudience', e.target.value)}
          />
        </div>

        <div>
          <label className="label">核心传递信息</label>
          <input
            className="input"
            placeholder="一句话描述你最想读者记住的是什么"
            value={brief.coreMessage}
            onChange={(e) => upd('coreMessage', e.target.value)}
          />
        </div>

        <div>
          <label className="label">内容形式</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CONTENT_FORMS.map((f) => (
              <button
                key={f}
                onClick={() => upd('contentForm', f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: `1px solid ${brief.contentForm === f ? 'var(--accent)' : 'var(--border)'}`,
                  background: brief.contentForm === f ? 'var(--accent)22' : 'transparent',
                  color: brief.contentForm === f ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'all 0.15s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">预估卡片数 ({brief.cardCount} 张)</label>
          <input
            type="range"
            min={1}
            max={9}
            value={brief.cardCount}
            onChange={(e) => upd('cardCount', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>1 张</span><span>9 张</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Step 2: Generate ─── */
function StepGenerate({ topic, brief, generating, streamText, draft, selectedTitle, onSelectTitle, onGenerate }) {
  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>✦ AI 生成草稿</h2>
      <p style={{ margin: '0 0 28px', color: 'var(--text-muted)', fontSize: 14 }}>
        基于你的 Brief，AI 将生成 3 个标题候选 + 分段正文
      </p>

      {!draft && !generating && (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            border: '1px dashed var(--border)',
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
          <div style={{ fontSize: 15, marginBottom: 8 }}>准备就绪</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            选题：{topic.title}
          </div>
          <button className="btn btn-primary" style={{ padding: '10px 28px', fontSize: 15 }} onClick={onGenerate}>
            开始生成草稿
          </button>
        </div>
      )}

      {generating && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="streaming-dot" />
            <span className="streaming-dot" style={{ animationDelay: '0.2s' }} />
            <span className="streaming-dot" style={{ animationDelay: '0.4s' }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>AI 正在生成中...</span>
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 16,
              fontFamily: 'monospace',
              fontSize: 12,
              color: 'var(--text-secondary)',
              maxHeight: 300,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {streamText}
            <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--accent)', animation: 'pulse-dot 1s infinite', verticalAlign: 'middle' }} />
          </div>
        </div>
      )}

      {draft && !generating && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Titles */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              标题候选 — 点击选择
            </div>
            {draft.titles?.map((title, i) => (
              <div
                key={i}
                onClick={() => onSelectTitle(i)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `1px solid ${selectedTitle === i ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedTitle === i ? 'var(--accent)11' : 'var(--bg-card)',
                  cursor: 'pointer',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${selectedTitle === i ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedTitle === i ? 'var(--accent)' : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#fff',
                  }}
                >
                  {selectedTitle === i ? '✓' : i + 1}
                </span>
                <span style={{ fontSize: 14, color: selectedTitle === i ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {title}
                </span>
              </div>
            ))}
          </div>

          {/* Cards preview */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              正文预览 ({draft.cards?.length} 张卡片)
            </div>
            {draft.cards?.map((card, i) => (
              <div
                key={i}
                className="card"
                style={{ marginBottom: 12, borderLeft: '3px solid var(--accent)44' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>
                  卡片 {i + 1}：{card.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {card.content}
                </div>
              </div>
            ))}
          </div>

          {/* Hashtags */}
          {draft.hashtags?.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                话题标签
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {draft.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'var(--accent)22',
                      color: 'var(--accent)',
                      fontSize: 12,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onGenerate}>
            ↻ 重新生成
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Step 3: Edit ─── */
function StepEdit({ cards, onChange, platform, draft, selectedTitle, onSelectTitle, aiPanel, onOpenAIPanel, onCloseAIPanel }) {
  function updateCard(index, field, value) {
    const updated = cards.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    onChange(updated)
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>✍️ 人工审核编辑</h2>
      <p style={{ margin: '0 0 28px', color: 'var(--text-muted)', fontSize: 14 }}>
        逐卡编辑内容，点击 AI 按钮使用润色/重写功能
      </p>

      {/* Title selector */}
      {draft?.titles?.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="label" style={{ marginBottom: 8 }}>当前标题（点击切换）</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>
            {draft.titles[selectedTitle]}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {draft.titles.map((t, i) => (
              <button
                key={i}
                onClick={() => onSelectTitle(i)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: `1px solid ${selectedTitle === i ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedTitle === i ? 'var(--accent)22' : 'transparent',
                  color: selectedTitle === i ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  transition: 'all 0.15s',
                }}
              >
                标题 {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {cards.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 12 }}>
          请先在 Step 2 生成草稿
        </div>
      )}

      {cards.map((card, i) => (
        <CardEditBlock
          key={i}
          card={card}
          index={i}
          total={cards.length}
          platform={platform}
          onChangeTitle={(v) => updateCard(i, 'title', v)}
          onChangeContent={(v) => updateCard(i, 'content', v)}
          onAIAction={() => onOpenAIPanel(i, 'content')}
          showAIPanel={aiPanel?.cardIndex === i}
          onCloseAIPanel={onCloseAIPanel}
          onApplyAI={(text) => updateCard(i, 'content', text)}
        />
      ))}
    </div>
  )
}

function CardEditBlock({ card, index, total, platform, onChangeTitle, onChangeContent, onAIAction, showAIPanel, onCloseAIPanel, onApplyAI }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: card.content || '',
    onUpdate: ({ editor }) => {
      onChangeContent(editor.getText())
    },
  })

  // Sync content when card changes externally (e.g., AI apply)
  useEffect(() => {
    if (editor && card.content !== editor.getText()) {
      editor.commands.setContent(card.content || '')
    }
  }, [card.content])

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
          卡片 {index + 1} / {total}
        </div>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }} onClick={onAIAction}>
          ✦ AI 助手
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="label">卡片小标题</label>
        <input
          className="input"
          value={card.title || ''}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="这张卡片的核心观点"
        />
      </div>

      <div>
        <label className="label">正文内容</label>
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>

      {showAIPanel && (
        <div style={{ marginTop: 16 }}>
          <AIPanel
            text={card.content}
            platform={platform}
            onApply={onApplyAI}
            onClose={onCloseAIPanel}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Step 4: Preview ─── */
function StepPreview({ cards, style, platform, onChange, onStyleChange }) {
  function updateCardField(index, field, value) {
    const updated = cards.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    onChange(updated)
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>🎨 卡片排版预览</h2>
      <p style={{ margin: '0 0 28px', color: 'var(--text-muted)', fontSize: 14 }}>
        所见即所得预览，调整样式后实时更新
      </p>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        {/* Left: Style controls */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <div className="card">
            <CardEditor style={style} onChange={onStyleChange} />
          </div>
        </div>

        {/* Right: Card previews */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {cards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              请先在 Step 2-3 生成和编辑内容
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                共 {cards.length} 张卡片 · 横向滚动查看
              </div>
              <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
                {cards.map((card, i) => (
                  <div key={i} style={{ flexShrink: 0 }}>
                    <CardPreview
                      card={card}
                      style={style}
                      platform={platform}
                      cardIndex={i}
                      totalCards={cards.length}
                      scale={true}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                      卡片 {i + 1}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Step 5: Export ─── */
function StepExport({ cards, post, draft, selectedTitle, exporting, exportStatus, onExportSingle, onExportAll }) {
  const title = draft?.titles?.[selectedTitle] || '未命名'

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>📤 导出</h2>
      <p style={{ margin: '0 0 28px', color: 'var(--text-muted)', fontSize: 14 }}>
        将卡片导出为 PNG 图片，可直接发布到社交平台
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>当前内容</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{cards.length} 张卡片</div>
      </div>

      {exportStatus && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 20,
            background: exportStatus.startsWith('✓') ? '#4AFFB011' : exportStatus.startsWith('✗') ? '#FF4A4A11' : 'var(--bg-card)',
            border: `1px solid ${exportStatus.startsWith('✓') ? 'var(--success)' : exportStatus.startsWith('✗') ? 'var(--danger)' : 'var(--border)'}`,
            color: exportStatus.startsWith('✓') ? 'var(--success)' : exportStatus.startsWith('✗') ? 'var(--danger)' : 'var(--text-primary)',
            fontSize: 13,
          }}
        >
          {exportStatus}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          className="btn btn-primary"
          style={{ justifyContent: 'center', padding: '14px', fontSize: 15 }}
          disabled={exporting || !cards.length || !post}
          onClick={onExportAll}
        >
          {exporting ? '导出中...' : `📦 导出全部 ${cards.length} 张（ZIP）`}
        </button>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>或者单独导出</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cards.map((card, i) => (
            <button
              key={i}
              className="btn btn-secondary"
              disabled={exporting || !post}
              onClick={() => onExportSingle(i)}
            >
              卡片 {i + 1}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: 'var(--bg-card)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.8,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>💡 提示</div>
        <div>· 首次导出会启动 Chromium，可能需要 10-30 秒</div>
        <div>· 小红书卡片尺寸：1080×1440px（3:4 比例）</div>
        <div>· 导出后状态将自动更新为"已导出"</div>
        <div>· 如图片出现乱码，请安装中文字体（如 fonts-wqy-microhei）</div>
      </div>
    </div>
  )
}
