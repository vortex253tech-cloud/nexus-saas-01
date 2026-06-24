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
// Layout matches the brand's existing manual-post template: left-aligned
// bold headline + parenthetical subtitle in the upper-middle area, a dark
// left-to-right vignette so text stays legible over a photo background,
// and a logo + handle lockup bottom-left (plus a "deslize →" + slide
// counter bottom-right for carousels).

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import sharp from 'sharp'
import path from 'path'

export const CANVAS_WIDTH  = 1080
export const CANVAS_HEIGHT = 1350 // 4:5 — Instagram's standard feed/carousel ratio

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

export interface OverlayOptions {
  title: string
  subtitle?: string
  /** 1-based slide number, omit for single-image posts */
  slideIndex?: number
  slideTotal?: number
}

export async function overlayTitleSubtitle(
  background: Buffer,
  { title, subtitle, slideIndex, slideTotal }: OverlayOptions,
): Promise<Buffer> {
  ensureFontsRegistered()

  const W = CANVAS_WIDTH
  const H = CANVAS_HEIGHT
  const marginX = 64

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // ── Vignette: strong at the left/top where text sits, fading toward the
  // right so the photo subject stays visible — plus a flat dark strip at
  // the very bottom so the brand lockup is always legible.
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

  // ── Headline + subtitle (upper-middle, left-aligned)
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
  titleLines.forEach((line, i) => {
    ctx.fillText(line, marginX, cursorY + i * titleLineHeight)
  })
  cursorY += titleLines.length * titleLineHeight + 28

  ctx.fillStyle = '#C7CDD6'
  ctx.font = `${subtitleFontSize}px "${FONT_MEDIUM}"`
  subtitleLines.forEach((line, i) => {
    ctx.fillText(line, marginX, cursorY + i * subtitleLineHeight)
  })

  // ── Brand lockup, bottom-left: gradient "N" mark + NEXUS + handle
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

  // ── Bottom-right: carousel swipe affordance + slide counter
  if (slideIndex) {
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

  const overlayBuffer = canvas.toBuffer('image/png')

  const composited = await sharp(background)
    .resize(W, H, { fit: 'cover' })
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer()

  // Defensive copy: some Buffer producers return a view into a larger,
  // pooled ArrayBuffer. Anything downstream that reads `.buffer` directly
  // instead of respecting byteOffset/length would then read garbage before
  // the real data. Buffer.from() here always allocates a tightly-sized,
  // standalone copy, so there's no ambiguity for callers.
  return Buffer.from(composited)
}
