// ─── Branded title/subtitle overlay for social images ────────────────────────
// AI image models render baked-in text unreliably (garbled letters, typos).
// This renders the whole text/brand layer as real SVG (via sharp) and
// composites it onto the generated background — guaranteed legible,
// correctly spelled, on-brand every time.
//
// Layout matches the brand's existing manual-post template: left-aligned
// bold headline + parenthetical subtitle in the upper-middle area, a dark
// left-to-right vignette so text stays legible over a photo background,
// and a logo + handle lockup bottom-left (plus a "deslize →" + slide
// counter bottom-right for carousels).

import sharp from 'sharp'

export const CANVAS_WIDTH  = 1080
export const CANVAS_HEIGHT = 1350 // 4:5 — Instagram's standard feed/carousel ratio

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
  const W = CANVAS_WIDTH
  const H = CANVAS_HEIGHT
  const marginX = 64

  const titleLines    = wrapLines(title, 16)
  const subtitleLines = subtitle ? wrapLines(`(${subtitle})`, 34) : []

  const titleFontSize      = 58
  const titleLineHeight    = titleFontSize * 1.18
  const subtitleFontSize   = 30
  const subtitleLineHeight = subtitleFontSize * 1.35

  // Headline block starts in the upper-middle area, like the reference template.
  let cursorY = H * 0.34

  const titleTspans = titleLines.map((line, i) => {
    const y = cursorY + i * titleLineHeight
    return `<text x="${marginX}" y="${y}" font-family="Arial, 'Helvetica Neue', sans-serif" font-weight="800" font-size="${titleFontSize}" fill="#FFFFFF">${escapeXml(line)}</text>`
  }).join('\n')

  cursorY += titleLines.length * titleLineHeight + 28

  const subtitleTspans = subtitleLines.map((line, i) => {
    const y = cursorY + i * subtitleLineHeight
    return `<text x="${marginX}" y="${y}" font-family="Arial, 'Helvetica Neue', sans-serif" font-weight="500" font-size="${subtitleFontSize}" fill="#C7CDD6">${escapeXml(line)}</text>`
  }).join('\n')

  // Brand lockup, bottom-left: small gradient "N" mark + NEXUS + handle
  const logoX = marginX
  const logoY = H - 96
  const logoSize = 44

  const brandLockup = `
    <defs>
      <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3B82F6"/>
        <stop offset="100%" stop-color="#7C3AED"/>
      </linearGradient>
    </defs>
    <rect x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" rx="10" fill="url(#logoGrad)"/>
    <text x="${logoX + logoSize / 2}" y="${logoY + logoSize / 2 + 8}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="26" fill="#FFFFFF">N</text>
    <text x="${logoX + logoSize + 14}" y="${logoY + 18}" font-family="Arial, sans-serif" font-weight="800" font-size="22" letter-spacing="1" fill="#FFFFFF">NEXUS</text>
    <text x="${logoX + logoSize + 14}" y="${logoY + 38}" font-family="Arial, sans-serif" font-weight="400" font-size="16" fill="#9AA4B2">@nexus.saas.ia</text>
  `

  // Bottom-right: carousel swipe affordance + slide counter (single posts: omitted)
  const slideLabel = slideTotal
    ? `${String(slideIndex).padStart(2, '0')}/${String(slideTotal).padStart(2, '0')}`
    : String(slideIndex).padStart(2, '0')

  const carouselHint = slideIndex
    ? `
      <text x="${W - marginX}" y="${H - 118}" text-anchor="end" font-family="Arial, sans-serif" font-weight="500" font-size="20" fill="#C7CDD6">deslize →</text>
      <text x="${W - marginX}" y="${H - 78}" text-anchor="end" font-family="Arial, sans-serif" font-weight="800" font-size="30" fill="#FFFFFF">${slideLabel}</text>
    `
    : ''

  // Dark vignette: strongest at the left/top where text sits, fading toward
  // the right/bottom so the photo subject stays visible — plus a flat dark
  // strip at the very bottom so the brand lockup is always legible.
  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vignette" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stop-color="#060A12" stop-opacity="0.92"/>
          <stop offset="55%" stop-color="#060A12" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#060A12" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#060A12" stop-opacity="0"/>
          <stop offset="100%" stop-color="#060A12" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="${H * 0.78}" fill="url(#vignette)"/>
      <rect x="0" y="${H * 0.78}" width="${W}" height="${H * 0.22}" fill="url(#bottomFade)"/>
      ${titleTspans}
      ${subtitleTspans}
      ${brandLockup}
      ${carouselHint}
    </svg>
  `

  const svgBuffer = Buffer.from(svg)

  const composited = await sharp(background)
    .resize(W, H, { fit: 'cover' })
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer()

  // Defensive copy: some Buffer producers return a view into a larger,
  // pooled ArrayBuffer. Anything downstream that reads `.buffer` directly
  // instead of respecting byteOffset/length would then read garbage before
  // the real data. Buffer.from() here always allocates a tightly-sized,
  // standalone copy, so there's no ambiguity for callers.
  return Buffer.from(composited)
}
