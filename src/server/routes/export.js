import { Router } from 'express'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import archiver from 'archiver'
import db from '../db/database.js'
import { validateExportInput } from '../utils/validators.js'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FONTS_DIR = join(__dirname, '../../../fonts')
const FONT_PATH = join(FONTS_DIR, 'NotoSansSC-Regular.woff2')
// jsDelivr CDN — Chinese Simplified subset (~2MB, downloads once)
const FONT_URL =
  'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.0.12/files/noto-sans-sc-chinese-simplified-400-normal.woff2'

const PLATFORM_SIZES = {
  xiaohongshu: { width: 1080, height: 1440 },
  wechat: { width: 900, height: 500 },
  jike: { width: 1080, height: 1080 },
  twitter: { width: 1200, height: 675 },
}

// ── Font loading (lazy, cached after first download) ──────────────────────────

let fontCache = null

async function loadFont() {
  if (fontCache) return fontCache
  if (existsSync(FONT_PATH)) {
    fontCache = readFileSync(FONT_PATH)
    return fontCache
  }
  console.log('正在下载中文字体（首次运行，约 2MB）…')
  mkdirSync(FONTS_DIR, { recursive: true })
  const res = await fetch(FONT_URL)
  if (!res.ok) throw new Error(`字体下载失败: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(FONT_PATH, buf)
  fontCache = buf
  console.log('字体下载完成，已缓存到 fonts/ 目录')
  return fontCache
}

// ── Card layout node (Satori JSX-compatible object) ──────────────────────────

function buildCardNode(cardInfo, style, size) {
  const bg      = style.backgroundColor || '#1A1A2E'
  const accent  = style.accentColor     || '#4A9EFF'
  const text    = style.textColor       || '#E8E8E8'
  const fs      = style.fontSize        || 28
  const pad     = style.padding         || 60

  const children = [
    // Header
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          fontSize: 20,
          color: accent,
          opacity: 0.6,
          fontWeight: 500,
        },
        children: [
          { type: 'span', props: { children: String(cardInfo.platform) } },
          { type: 'span', props: { children: `${cardInfo.cardIndex + 1} / ${cardInfo.totalCards}` } },
        ],
      },
    },
    // Title
    {
      type: 'div',
      props: {
        style: {
          fontSize: fs + 8,
          fontWeight: 700,
          color: accent,
          marginBottom: 28,
          lineHeight: 1.5,
        },
        children: String(cardInfo.title || ''),
      },
    },
    // Accent bar
    {
      type: 'div',
      props: {
        style: {
          width: 40,
          height: 4,
          background: accent,
          borderRadius: 2,
          marginBottom: 28,
        },
      },
    },
    // Body
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          fontSize: fs,
          lineHeight: 2,
          flex: 1,
          color: text,
        },
        children: String(cardInfo.content || ''),
      },
    },
  ]

  if (style.showSignature && style.signature) {
    children.push({
      type: 'div',
      props: {
        style: {
          marginTop: 32,
          fontSize: 18,
          color: text,
          opacity: 0.4,
        },
        children: `@${style.signature}`,
      },
    })
  }

  return {
    type: 'div',
    props: {
      style: {
        width: size.width,
        height: size.height,
        background: bg,
        color: text,
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: `${accent}33`,
      },
      children,
    },
  }
}

// ── Render to image buffer ────────────────────────────────────────────────────

async function renderCard(node, size, format = 'png') {
  const font = await loadFont()

  const svg = await satori(node, {
    width: size.width,
    height: size.height,
    fonts: [{ name: 'NotoSansSC', data: font, weight: 400, style: 'normal' }],
  })

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size.width } })
  const pngBuf = resvg.render().asPng()

  if (format === 'jpg' || format === 'jpeg') {
    return sharp(pngBuf).jpeg({ quality: 90 }).toBuffer()
  }
  return pngBuf
}

function mimeAndExt(format) {
  const isJpg = format === 'jpg' || format === 'jpeg'
  return { mime: isJpg ? 'image/jpeg' : 'image/png', ext: isJpg ? 'jpg' : 'png' }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/export/image  — single card, format: 'png' | 'jpg'
router.post('/image', async (req, res) => {
  const { postId, cardIndex = 0, format = 'png' } = req.body
  const fmt = ['png', 'jpg', 'jpeg'].includes(format) ? format : 'png'

  const v = validateExportInput({ postId, cardIndex })
  if (!v.ok) return res.status(400).json({ error: v.error })

  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const cardData = JSON.parse(post.card_data || '{}')
    const cards    = cardData.cards  || []
    const style    = cardData.style  || {}
    const platform = post.platform   || 'xiaohongshu'
    const size     = PLATFORM_SIZES[platform] || PLATFORM_SIZES.xiaohongshu

    if (!cards.length)          return res.status(400).json({ error: 'No cards to export' })
    if (cardIndex >= cards.length) return res.status(400).json({ error: 'Card index out of range' })

    const node   = buildCardNode({ ...cards[cardIndex], platform, cardIndex, totalCards: cards.length }, style, size)
    const imgBuf = await renderCard(node, size, fmt)
    const { mime, ext } = mimeAndExt(fmt)

    db.prepare("UPDATE posts SET status = 'exported', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(postId)

    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `attachment; filename="card_${cardIndex + 1}.${ext}"`)
    res.send(imgBuf)
  } catch (err) {
    console.error('Export image error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/export/png  — kept for backwards compatibility
router.post('/png', async (req, res) => {
  const { postId, cardIndex = 0 } = req.body
  const v = validateExportInput({ postId, cardIndex })
  if (!v.ok) return res.status(400).json({ error: v.error })

  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const cardData = JSON.parse(post.card_data || '{}')
    const cards    = cardData.cards  || []
    const style    = cardData.style  || {}
    const platform = post.platform   || 'xiaohongshu'
    const size     = PLATFORM_SIZES[platform] || PLATFORM_SIZES.xiaohongshu

    if (!cards.length)             return res.status(400).json({ error: 'No cards to export' })
    if (cardIndex >= cards.length) return res.status(400).json({ error: 'Card index out of range' })

    const node   = buildCardNode({ ...cards[cardIndex], platform, cardIndex, totalCards: cards.length }, style, size)
    const imgBuf = await renderCard(node, size, 'png')

    db.prepare("UPDATE posts SET status = 'exported', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(postId)

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Disposition', `attachment; filename="card_${cardIndex + 1}.png"`)
    res.send(imgBuf)
  } catch (err) {
    console.error('Export PNG error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/export/all  — all cards as ZIP, format: 'png' | 'jpg'
router.post('/all', async (req, res) => {
  const { postId, format = 'png' } = req.body
  const fmt = ['png', 'jpg', 'jpeg'].includes(format) ? format : 'png'

  const v = validateExportInput({ postId })
  if (!v.ok) return res.status(400).json({ error: v.error })

  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const cardData = JSON.parse(post.card_data || '{}')
    const cards    = cardData.cards  || []
    const style    = cardData.style  || {}
    const platform = post.platform   || 'xiaohongshu'
    const size     = PLATFORM_SIZES[platform] || PLATFORM_SIZES.xiaohongshu

    if (!cards.length) return res.status(400).json({ error: 'No cards to export' })

    const { ext } = mimeAndExt(fmt)
    const buffers = []
    for (let i = 0; i < cards.length; i++) {
      const node = buildCardNode({ ...cards[i], platform, cardIndex: i, totalCards: cards.length }, style, size)
      buffers.push(await renderCard(node, size, fmt))
    }

    db.prepare("UPDATE posts SET status = 'exported', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(postId)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="flowpost_cards_${postId}.zip"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.pipe(res)
    buffers.forEach((buf, i) => archive.append(buf, { name: `card_${i + 1}.${ext}` }))
    await archive.finalize()
  } catch (err) {
    console.error('Export all error:', err)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

export default router
