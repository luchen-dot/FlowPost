import { Router } from 'express'
import puppeteer from 'puppeteer'
import { writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import archiver from 'archiver'
import db from '../db/database.js'
import { validateExportInput } from '../utils/validators.js'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const TEMP_DIR = join(__dirname, '../../../temp')

const PLATFORM_SIZES = {
  xiaohongshu: { width: 1080, height: 1440 },
  wechat: { width: 900, height: 500 },
  jike: { width: 1080, height: 1080 },
  twitter: { width: 1200, height: 675 },
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>')
}

function generateCardHTML(cardInfo, style, size) {
  const bg = style.backgroundColor || '#1A1A2E'
  const accent = style.accentColor || '#4A9EFF'
  const textColor = style.textColor || '#E8E8E8'
  const fontSize = style.fontSize || 28
  const padding = style.padding || 60

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: ${size.width}px;
  height: ${size.height}px;
  overflow: hidden;
  background: ${bg};
}
.card {
  width: ${size.width}px;
  height: ${size.height}px;
  background: ${bg};
  color: ${textColor};
  font-family: "WenQuanYi Micro Hei", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  padding: ${padding}px;
  display: flex;
  flex-direction: column;
  border: 1px solid ${accent}33;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  font-size: 20px;
  color: ${accent};
  opacity: 0.6;
  font-weight: 500;
}
.card-title {
  font-size: ${fontSize + 8}px;
  font-weight: 700;
  color: ${accent};
  margin-bottom: 28px;
  line-height: 1.5;
  letter-spacing: 0.02em;
}
.card-body {
  font-size: ${fontSize}px;
  line-height: 2;
  flex: 1;
  color: ${textColor};
}
.card-body p { margin-bottom: 16px; }
.card-footer {
  margin-top: 32px;
  font-size: 18px;
  color: ${textColor};
  opacity: 0.4;
  text-align: right;
}
.accent-bar {
  width: 40px;
  height: 4px;
  background: ${accent};
  border-radius: 2px;
  margin-bottom: 28px;
}
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <span>${escapeHtml(cardInfo.platform)}</span>
    <span>${cardInfo.cardIndex + 1} / ${cardInfo.totalCards}</span>
  </div>
  <div class="card-title">${escapeHtml(cardInfo.title)}</div>
  <div class="accent-bar"></div>
  <div class="card-body">${escapeHtml(cardInfo.content)}</div>
  ${style.showSignature && style.signature
    ? `<div class="card-footer">@${escapeHtml(style.signature)}</div>`
    : ''}
</div>
</body>
</html>`
}

async function launchBrowser() {
  const launchOpts = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    headless: true,
  }

  // Allow overriding Chrome path via env variable
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
  }

  try {
    return await puppeteer.launch(launchOpts)
  } catch (err) {
    if (err.message.includes('Could not find Chrome') || err.message.includes('Failed to find Chrome')) {
      throw new Error(
        '未找到 Chrome/Chromium。请安装 Chromium：\n  apt install chromium\n或设置环境变量：PUPPETEER_EXECUTABLE_PATH=/path/to/chrome'
      )
    }
    throw err
  }
}

async function screenshotCard(browser, html, size) {
  mkdirSync(TEMP_DIR, { recursive: true })
  const tmpFile = join(TEMP_DIR, `card_${Date.now()}_${Math.random().toString(36).slice(2)}.html`)
  writeFileSync(tmpFile, html, 'utf-8')

  const page = await browser.newPage()
  try {
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 })
    await page.goto(`file://${tmpFile}`, { waitUntil: 'load', timeout: 15000 })
    const screenshot = await page.screenshot({ type: 'png' })
    return screenshot
  } finally {
    await page.close()
    try { unlinkSync(tmpFile) } catch {}
  }
}

// POST /api/export/png  — export a single card
router.post('/png', async (req, res) => {
  const { postId, cardIndex = 0 } = req.body

  const v = validateExportInput({ postId, cardIndex })
  if (!v.ok) return res.status(400).json({ error: v.error })

  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const cardData = JSON.parse(post.card_data || '{}')
    const cards = cardData.cards || []
    const style = cardData.style || {}
    const platform = post.platform || 'xiaohongshu'
    const size = PLATFORM_SIZES[platform] || PLATFORM_SIZES.xiaohongshu

    if (!cards.length) return res.status(400).json({ error: 'No cards to export' })
    if (cardIndex >= cards.length) return res.status(400).json({ error: 'Card index out of range' })

    const card = cards[cardIndex]
    const html = generateCardHTML(
      { ...card, platform, cardIndex, totalCards: cards.length },
      style,
      size
    )

    const browser = await launchBrowser()
    const screenshot = await screenshotCard(browser, html, size)
    await browser.close()

    db.prepare("UPDATE posts SET status = 'exported', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(postId)

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Disposition', `attachment; filename="card_${cardIndex + 1}.png"`)
    res.send(Buffer.from(screenshot))
  } catch (err) {
    console.error('Export PNG error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/export/all  — export all cards as ZIP
router.post('/all', async (req, res) => {
  const { postId } = req.body

  const v = validateExportInput({ postId })
  if (!v.ok) return res.status(400).json({ error: v.error })

  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const cardData = JSON.parse(post.card_data || '{}')
    const cards = cardData.cards || []
    const style = cardData.style || {}
    const platform = post.platform || 'xiaohongshu'
    const size = PLATFORM_SIZES[platform] || PLATFORM_SIZES.xiaohongshu

    if (!cards.length) return res.status(400).json({ error: 'No cards to export' })

    const browser = await launchBrowser()
    const screenshots = []

    for (let i = 0; i < cards.length; i++) {
      const html = generateCardHTML(
        { ...cards[i], platform, cardIndex: i, totalCards: cards.length },
        style,
        size
      )
      const shot = await screenshotCard(browser, html, size)
      screenshots.push(shot)
    }

    await browser.close()

    db.prepare("UPDATE posts SET status = 'exported', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(postId)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="flowpost_cards_${postId}.zip"`)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.pipe(res)

    screenshots.forEach((buf, i) => {
      archive.append(Buffer.from(buf), { name: `card_${i + 1}.png` })
    })

    await archive.finalize()
  } catch (err) {
    console.error('Export all error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: err.message })
    }
  }
})

export default router
