import { forwardRef } from 'react'

const PLATFORM_LABELS = {
  xiaohongshu: '小红书',
  wechat: '公众号',
  jike: '即刻',
  twitter: 'Twitter/X',
}

// Scale factor for preview display
const PLATFORM_DISPLAY_HEIGHT = 400

const PLATFORM_SIZES = {
  xiaohongshu: { width: 1080, height: 1440 },
  wechat: { width: 900, height: 500 },
  jike: { width: 1080, height: 1080 },
  twitter: { width: 1200, height: 675 },
}

/**
 * CardPreview renders a single content card.
 * Used both for in-browser preview (scaled) and as the source for puppeteer export.
 *
 * Props:
 *   card: { title, content }
 *   style: { backgroundColor, accentColor, textColor, fontSize, padding, showSignature, signature }
 *   platform: string
 *   cardIndex: number
 *   totalCards: number
 *   scale: boolean (default true — scale for display)
 */
const CardPreview = forwardRef(function CardPreview(
  { card, style = {}, platform = 'xiaohongshu', cardIndex = 0, totalCards = 1, scale = true },
  ref
) {
  const bg = style.backgroundColor || '#1A1A2E'
  const accent = style.accentColor || '#4A9EFF'
  const textColor = style.textColor || '#E8E8E8'
  const fontSize = style.fontSize || 28
  const padding = style.padding || 60

  const size = PLATFORM_SIZES[platform] || PLATFORM_SIZES.xiaohongshu
  const scaleRatio = scale ? PLATFORM_DISPLAY_HEIGHT / size.height : 1
  const displayWidth = size.width * scaleRatio
  const displayHeight = size.height * scaleRatio

  const cardContent = (
    <div
      ref={ref}
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        color: textColor,
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
        padding: padding,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${accent}33`,
        position: 'relative',
        overflow: 'hidden',
        transformOrigin: 'top left',
        transform: scale ? `scale(${scaleRatio})` : 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          fontSize: 20,
          color: accent,
          opacity: 0.6,
          fontWeight: 500,
        }}
      >
        <span>{PLATFORM_LABELS[platform] || platform}</span>
        <span>{cardIndex + 1} / {totalCards}</span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: fontSize + 8,
          fontWeight: 700,
          color: accent,
          marginBottom: 24,
          lineHeight: 1.5,
          letterSpacing: '0.01em',
        }}
      >
        {card?.title || '标题'}
      </div>

      {/* Accent bar */}
      <div
        style={{
          width: 40,
          height: 4,
          background: accent,
          borderRadius: 2,
          marginBottom: 24,
        }}
      />

      {/* Body */}
      <div
        style={{
          fontSize: fontSize,
          lineHeight: 1.9,
          flex: 1,
          color: textColor,
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
        }}
      >
        {card?.content || ''}
      </div>

      {/* Footer signature */}
      {style.showSignature && style.signature && (
        <div
          style={{
            marginTop: 32,
            fontSize: 18,
            color: textColor,
            opacity: 0.4,
            textAlign: 'right',
          }}
        >
          @{style.signature}
        </div>
      )}
    </div>
  )

  if (!scale) return cardContent

  return (
    <div
      style={{
        width: displayWidth,
        height: displayHeight,
        overflow: 'hidden',
        borderRadius: 8,
        flexShrink: 0,
      }}
    >
      {cardContent}
    </div>
  )
})

export default CardPreview
