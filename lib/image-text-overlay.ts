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
// Two layouts, three formats — the reusable template library:
// Layouts:
// - 'photo' (default): left-aligned bold headline + parenthetical subtitle
//   in the upper-middle area, dark left-to-right vignette over a full-bleed
//   photo background. Matches the brand's existing manual-post template.
// - 'screenshot': the real product UI is the protagonist — it's "contain"-
//   fitted (never cropped) inside a framed card on a solid brand
//   background, with a compact headline above instead of a heavy vignette
//   that would otherwise cover the actual interface.
// Formats (canvas dimensions, all positions scale to whichever is picked):
// - 'feed' (default): 1080x1350 (4:5) — Instagram feed/carousel.
// - 'story': 1080x1920 (9:16) — Instagram/Facebook Stories.
// - 'ad_square': 1080x1080 (1:1) — safest aspect ratio across Meta Ads
//   placements (Feed, Marketplace, right column).
// Optional pieces, composable with either layout/format:
// - badge: small pill tag near the top (e.g. "NOVIDADE") for launch posts.
// - ctaLabel: a baked-in CTA button bar above the logo lockup, for paid ads
//   where the creative itself should carry an explicit call to action.
// All end with the same logo + handle lockup bottom-left, and a
// "deslize >" + slide counter bottom-right for carousels.

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import sharp from 'sharp'
import path from 'path'

// Kept for backward compatibility with existing callers/imports.
export const CANVAS_WIDTH  = 1080
export const CANVAS_HEIGHT = 1350

export type CreativeFormat = 'feed' | 'story' | 'ad_square'

export const FORMAT_DIMENSIONS: Record<CreativeFormat, { width: number; height: number }> = {
  feed:      { width: 1080, height: 1350 }, // 4:5
  story:     { width: 1080, height: 1920 }, // 9:16
  ad_square: { width: 1080, height: 1080 }, // 1:1
}

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

type Ctx2D = ReturnType<ReturnType<typeof createCanvas>['getContext']>

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

function roundedRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawLogoLockup(ctx: Ctx2D, marginX: number, H: number) {
  const logoX = marginX
  const logoY = H - 96
  const logoSize = 44

  const logoGrad = ctx.createLinearGradient(logoX, logoY, logoX + logoSize, logoY + logoSize)
  logoGrad.addColorStop(0, '#3B82F6')
  logoGrad.addColorStop(1, '#7C3AED')
  ctx.fillStyle = logoGrad
  roundedRectPath(ctx, logoX, logoY, logoSize, logoSize, 10)
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

function drawSlideCounter(ctx: Ctx2D, W: number, H: number, marginX: number, slideIndex: number, slideTotal?: number) {
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

// Small pill tag (e.g. "NOVIDADE") — used for posts de lançamento. Returns
// the y-coordinate immediately below the badge, so callers can stack the
// headline under it without overlap.
function drawBadge(ctx: Ctx2D, marginX: number, top: number, label: string): number {
  ctx.font = `20px "${FONT_BOLD}"`
  const textWidth = ctx.measureText(label.toUpperCase()).width
  const paddingX = 18
  const height = 38
  const width = textWidth + paddingX * 2

  const grad = ctx.createLinearGradient(marginX, top, marginX + width, top + height)
  grad.addColorStop(0, '#3B82F6')
  grad.addColorStop(1, '#7C3AED')
  ctx.fillStyle = grad
  roundedRectPath(ctx, marginX, top, width, height, height / 2)
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.textBaseline = 'middle'
  ctx.fillText(label.toUpperCase(), marginX + paddingX, top + height / 2 + 1)
  ctx.textBaseline = 'alphabetic'

  return top + height
}

// Baked-in CTA button bar — used for paid-ad creatives, where the call to
// action should be visible in the asset itself, not just the caption.
// Drawn full-width, sitting directly above the logo lockup.
function drawCtaBar(ctx: Ctx2D, W: number, H: number, marginX: number, label: string): number {
  const height = 76
  const bottom = H - 96 - 30 // 30px gap above the logo lockup
  const top = bottom - height
  const width = W - marginX * 2

  ctx.fillStyle = '#3B82F6'
  roundedRectPath(ctx, marginX, top, width, height, 14)
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `26px "${FONT_BOLD}"`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, marginX + width / 2, top + height / 2 + 2)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  return top
}

export interface OverlayOptions {
  title: string
  subtitle?: string
  /** 1-based slide number, omit for single-image posts */
  slideIndex?: number
  slideTotal?: number
  /** 'photo' (default): full-bleed background + vignette. 'screenshot': real UI framed and never cropped. */
  layout?: 'photo' | 'screenshot'
  /** Canvas aspect ratio / use case. Defaults to 'feed' (4:5). */
  format?: CreativeFormat
  /** Small pill tag near the top, e.g. "NOVIDADE" — for posts de lançamento. */
  badge?: string
  /** Baked-in CTA button bar above the logo lockup — for paid-ad creatives. */
  ctaLabel?: string
}

export async function overlayTitleSubtitle(background: Buffer, opts: OverlayOptions): Promise<Buffer> {
  ensureFontsRegistered()

  const { width: W, height: H } = FORMAT_DIMENSIONS[opts.format ?? 'feed']
  const marginX = 64

  if (opts.layout === 'screenshot') return renderScreenshotLayout(background, opts, W, H, marginX)
  return renderPhotoLayout(background, opts, W, H, marginX)
}

// ─── Photo layout: full-bleed background, vignette, upper-middle headline ──

async function renderPhotoLayout(
  background: Buffer,
  { title, subtitle, slideIndex, slideTotal, badge, ctaLabel }: OverlayOptions,
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
  if (badge) cursorY = drawBadge(ctx, marginX, H * 0.34 - 70, badge) + 56

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `${titleFontSize}px "${FONT_BOLD}"`
  titleLines.forEach((line, i) => ctx.fillText(line, marginX, cursorY + i * titleLineHeight))
  cursorY += titleLines.length * titleLineHeight + 28

  ctx.fillStyle = '#C7CDD6'
  ctx.font = `${subtitleFontSize}px "${FONT_MEDIUM}"`
  subtitleLines.forEach((line, i) => ctx.fillText(line, marginX, cursorY + i * subtitleLineHeight))

  if (ctaLabel) drawCtaBar(ctx, W, H, marginX, ctaLabel)
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
  { title, subtitle, slideIndex, slideTotal, badge, ctaLabel }: OverlayOptions,
  W: number, H: number, marginX: number,
): Promise<Buffer> {
  // Frame the screenshot inside a card: padded, rounded corners, subtle
  // border — sized to leave room for a compact headline above and the
  // brand lockup (plus CTA bar, if any) below, without ever cropping the
  // real interface. All offsets scale with H so this works across formats.
  const headerHeight = badge ? 340 : 280
  const footerHeight = ctaLabel ? 270 : 170

  // Source screenshots are wide desktop dashboards (~1.6:1); story format is
  // very tall (9:16). Sizing the card to the nominal header/footer-bounded
  // box and letting 'contain' shrink the photo inside it left the card
  // border at full height with the actual photo floating tiny in the
  // middle — a wall of dead space. Instead, size the card itself to the
  // screenshot's real aspect ratio (clamped to the available box) so the
  // border hugs the actual content, with the leftover space distributed as
  // even, intentional padding above/below instead of one big gap.
  const meta = await sharp(background).metadata()
  const srcAspect = (meta.width ?? 1) / (meta.height ?? 1)

  const maxCardWidth  = W - marginX * 2
  const maxCardHeight = (H - footerHeight) - headerHeight

  let cardWidth  = maxCardWidth
  let cardHeight = cardWidth / srcAspect
  if (cardHeight > maxCardHeight) {
    cardHeight = maxCardHeight
    cardWidth  = cardHeight * srcAspect
  }

  const cardX   = marginX + (maxCardWidth - cardWidth) / 2
  const cardTop = headerHeight + (maxCardHeight - cardHeight) / 2

  const framedScreenshot = await sharp(background)
    .resize(Math.round(cardWidth), Math.round(cardHeight), { fit: 'contain', background: { r: 17, g: 22, b: 32, alpha: 1 } })
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
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'
  ctx.lineWidth = 2
  roundedRectPath(ctx, cardX, cardTop, cardWidth, cardHeight, 20)
  ctx.stroke()

  // Compact headline + subtitle above the card (badge first, if present)
  const titleFontSize    = 46
  const titleLineHeight  = titleFontSize * 1.18
  const subtitleFontSize = 26
  const subtitleLineHeight = subtitleFontSize * 1.3

  const titleLines    = wrapLines(title, 22)
  const subtitleLines = subtitle ? wrapLines(subtitle, 40) : []

  let cursorY = 100
  if (badge) cursorY = drawBadge(ctx, marginX, 40, badge) + 60

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `${titleFontSize}px "${FONT_BOLD}"`
  titleLines.forEach((line, i) => ctx.fillText(line, marginX, cursorY + i * titleLineHeight))
  cursorY += titleLines.length * titleLineHeight + 16

  ctx.fillStyle = '#9AA4B2'
  ctx.font = `${subtitleFontSize}px "${FONT_MEDIUM}"`
  subtitleLines.forEach((line, i) => ctx.fillText(line, marginX, cursorY + i * subtitleLineHeight))

  if (ctaLabel) drawCtaBar(ctx, W, H, marginX, ctaLabel)
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
