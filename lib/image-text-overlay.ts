// ─── Branded title/subtitle overlay for social images ────────────────────────
// AI image models render baked-in text unreliably (garbled letters, typos),
// so the title/subtitle/logo layer is drawn here instead, with @napi-rs/canvas.
//
// Why canvas instead of SVG+sharp: SVG <text> rendering in sharp depends on
// the OS having fontconfig + actual font files installed. Vercel's
// serverless runtime has none — every <text> element silently rendered as
// invisible while shapes (rects, gradients) still worked, which is exactly
// what happened in production (confirmed via a real published post with a
// blank logo square and no headline at all). @napi-rs/canvas bundles its
// own Skia text renderer and lets us register specific font FILES directly,
// with zero dependency on the host OS having any fonts at all.
//
// Two layouts:
// - 'photo' (default): left-aligned bold headline + parenthetical subtitle
//   in the upper-middle area, dark left-to-right vignette over a full-bleed
//   photo background. Matches the brand's existing manual-post template.
// - 'screenshot': the real product UI is the protagonist — it's "contain"-
//   fitted (never cropped) inside a framed card on a solid brand
//   background, with a compact headline above instead of a heavy vignette
//   that would otherwise cover the actual interface.
// Both end with the same logo + handle lockup bottom-left, and a
// "deslize >" + slide counter bottom-right for carousels.

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import sharp from 'sharp'
import path from 'path'

export const CANVAS_WIDTH  = 1080
export const CANVAS_HEIGHT = 1350 // 4:5 — Instagram's standard feed/carousel ratio

const BRAND_BG = { r: 10, g: 14, b: 22 } // #0A0E16

const FONT_BOLD    = 'NEXUS Inter Bold'
const FONT_MEDIUM  = 'NEXUS Inter Medium'
const FONT_REGULAR = 'NEXUS Inter Regular'

let fontsRegistered = false
function ensureFontsRegistered() {
  if (fontsRegistered) return
  const fontsDir = path.join(process.cwd(), 'assets', 'fonts')
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-ExtraBold.ttf'), FONT_BOLD)
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Medium.ttf'), FONT_MEDIUM)
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Regular.ttf'), FONT_REGULAR)
  fontsRegistered = true
}

// Naive word-wrap by estimated character width — good enough for short
// marketing headlines, not a general-purpose text layout engine.
function wrapLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawLogoLockup(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, marginX: number, H: number) {
  const logoX = marginX
  const logoY = H - 96
  const logoSize = 44

  const logoGrad = ctx.createLinearGradient(logoX, logoY, logoX + logoSize, logoY + logoSize)
  logoGrad.addColorStop(0, '#3B82F6')
  logoGrad.addColorStop(1, '#7C3AED')
  ctx.fillStyle = logoGrad
  const r = 10
  ctx.beginPath()
  ctx.moveTo(logoX + r, logoY)
  ctx.arcTo(logoX + logoSize, logoY, logoX + logoSize, logoY + logoSize, r)
  ctx.arcTo(logoX + logoSize, logoY + logoSize, logoX, logoY + logoSize, r)
  ctx.arcTo(logoX, logoY + logoSize, logoX, logoY, r)
  ctx.arcTo(logoX, logoY, logoX + logoSize, logoY, r)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `26px "${FONT_BOLD}"`
  ctx.textAlign = 'center'
  ctx.fillText('N', logoX + logoSize / 2, logoY + logoSize / 2 + 9)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `22px "${FONT_BOLD}"`
  ctx.fillText('NEXUS', logoX + logoSize + 14, logoY + 18)

  ctx.fillStyle = '#9AA4B2'
  ctx.font = `16px "${FONT_REGULAR}"`
  ctx.fillText('@nexus.saas.ia', logoX + logoSize + 14, logoY + 38)
}

function drawSlideCounter(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  W: number, H: number, marginX: number, slideIndex: number, slideTotal?: number,
) {
  const slideLabel = slideTotal
    ? `${String(slideIndex).padStart(2, '0')}/${String(slideTotal).padStart(2, '0')}`
    : String(slideIndex).padStart(2, '0')

  ctx.textAlign = 'right'
  ctx.fillStyle = '#C7CDD6'
  ctx.font = `20px "${FONT_MEDIUM}"`
  ctx.fillText('deslize >', W - marginX, H - 118)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `30px "${FONT_BOLD}"`
  ctx.fillText(slideLabel, W - marginX, H - 78)
  ctx.textAlign = 'left'
}

export interface OverlayOptions {
  title: string
  subtitle?: string
  /** 1-based slide number, omit for single-image posts */
  slideIndex?: number
  slideTotal?: number
  /** 'photo' (default): full-bleed background + vignette. 'screenshot': real UI framed and never cropped. */
  layout?: 'photo' | 'screenshot'
}

export async function overlayTitleSubtitle(
  background: Buffer,
  { title, subtitle, slideIndex, slideTotal, layout = 'photo' }: OverlayOptions,
): Promise<Buffer> {
  ensureFontsRegistered()

  const W = CANVAS_WIDTH
  const H = CANVAS_HEIGHT
  const marginX = 64

  if (layout === 'screenshot') return renderScreenshotLayout(background, { title, subtitle, slideIndex, slideTotal }, W, H, marginX)
  return renderPhotoLayout(background, { title, subtitle, slideIndex, slideTotal }, W, H, marginX)
}

// ─── Photo layout: full-bleed background, vignette, upper-middle headline ──

async function renderPhotoLayout(
  background: Buffer,
  { title, subtitle, slideIndex, slideTotal }: Omit<OverlayOptions, 'layout'>,
  W: number, H: number, marginX: number,
): Promise<Buffer> {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  const vignette = ctx.createLinearGradient(0, 0, W, H * 0.6)
  vignette.addColorStop(0,    'rgba(6,10,18,0.92)')
  vignette.addColorStop(0.55, 'rgba(6,10,18,0.55)')
  vignette.addColorStop(1,    'rgba(6,10,18,0)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H * 0.78)

  const bottomFade = ctx.createLinearGradient(0, H * 0.78, 0, H)
  bottomFade.addColorStop(0, 'rgba(6,10,18,0)')
  bottomFade.addColorStop(1, 'rgba(6,10,18,0.85)')
  ctx.fillStyle = bottomFade
  ctx.fillRect(0, H * 0.78, W, H * 0.22)

  const titleFontSize    = 58
  const titleLineHeight  = titleFontSize * 1.18
  const subtitleFontSize = 30
  const subtitleLineHeight = subtitleFontSize * 1.35

  const titleLines    = wrapLines(title, 16)
  const subtitleLines = subtitle ? wrapLines(`(${subtitle})`, 34) : []

  let cursorY = H * 0.34

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `${titleFontSize}px "${FONT_BOLD}"`
  titleLines.forEach((line, i) => ctx.fillText(line, marginX, cursorY + i * titleLineHeight))
  cursorY += titleLines.length * titleLineHeight + 28

  ctx.fillStyle = '#C7CDD6'
  ctx.font = `${subtitleFontSize}px "${FONT_MEDIUM}"`
  subtitleLines.forEach((line, i) => ctx.fillText(line, marginX, cursorY + i * subtitleLineHeight))

  drawLogoLockup(ctx, marginX, H)
  if (slideIndex) drawSlideCounter(ctx, W, H, marginX, slideIndex, slideTotal)

  const overlayBuffer = canvas.toBuffer('image/png')
  const composited = await sharp(background)
    .resize(W, H, { fit: 'cover' })
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer()

  return Buffer.from(composited)
}

// ─── Screenshot layout: real product UI, framed and never cropped ──────────

async function renderScreenshotLayout(
  background: Buffer,
  { title, subtitle, slideIndex, slideTotal }: Omit<OverlayOptions, 'layout'>,
  W: number, H: number, marginX: number,
): Promise<Buffer> {
  // Frame the screenshot inside a card: padded, rounded corners, subtle
  // border — sized to leave room for a compact headline above and the
  // brand lockup below, without ever cropping the real interface.
  const cardX = marginX
  const cardTop = 280
  const cardWidth = W - marginX * 2
  const cardBottom = H - 170
  const cardHeight = cardBottom - cardTop

  const framedScreenshot = await sharp(background)
    .resize(cardWidth, cardHeight, { fit: 'contain', background: { r: 17, g: 22, b: 32, alpha: 1 } })
    .toBuffer()

  // Base canvas: solid brand background the screenshot card sits on top of.
  const base = await sharp({
    create: { width: W, height: H, channels: 3, background: BRAND_BG },
  }).png().toBuffer()

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Subtle ambient glow behind the card for depth (compositor-cheap radial fill)
  const glow = ctx.createRadialGradient(W / 2, cardTop + cardHeight / 2, 0, W / 2, cardTop + cardHeight / 2, W * 0.7)
  glow.addColorStop(0, 'rgba(59,130,246,0.10)')
  glow.addColorStop(1, 'rgba(59,130,246,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Card border
  const r = 20
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cardX + r, cardTop)
  ctx.arcTo(cardX + cardWidth, cardTop, cardX + cardWidth, cardTop + cardHeight, r)
  ctx.arcTo(cardX + cardWidth, cardTop + cardHeight, cardX, cardTop + cardHeight, r)
  ctx.arcTo(cardX, cardTop + cardHeight, cardX, cardTop, r)
  ctx.arcTo(cardX, cardTop, cardX + cardWidth, cardTop, r)
  ctx.closePath()
  ctx.stroke()

  // Compact headline + subtitle above the card
  const titleFontSize    = 46
  const titleLineHeight  = titleFontSize * 1.18
  const subtitleFontSize = 26
  const subtitleLineHeight = subtitleFontSize * 1.3

  const titleLines    = wrapLines(title, 22)
  const subtitleLines = subtitle ? wrapLines(subtitle, 40) : []

  let cursorY = 100
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `${titleFontSize}px "${FONT_BOLD}"`
  titleLines.forEach((line, i) => ctx.fillText(line, marginX, cursorY + i * titleLineHeight))
  cursorY += titleLines.length * titleLineHeight + 16

  ctx.fillStyle = '#9AA4B2'
  ctx.font = `${subtitleFontSize}px "${FONT_MEDIUM}"`
  subtitleLines.forEach((line, i) => ctx.fillText(line, marginX, cursorY + i * subtitleLineHeight))

  drawLogoLockup(ctx, marginX, H)
  if (slideIndex) drawSlideCounter(ctx, W, H, marginX, slideIndex, slideTotal)

  const overlayBuffer = canvas.toBuffer('image/png')

  const composited = await sharp(base)
    .composite([
      { input: framedScreenshot, top: cardTop, left: cardX },
      { input: overlayBuffer, top: 0, left: 0 },
    ])
    .png()
    .toBuffer()

  return Buffer.from(composited)
}
