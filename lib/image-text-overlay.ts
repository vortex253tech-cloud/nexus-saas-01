// ─── Title/subtitle overlay for social images ────────────────────────────────
// AI image models render baked-in text unreliably (garbled letters, typos).
// This renders title/subtitle as a real SVG <text> layer and composites it
// onto the generated background with sharp — guaranteed legible, correctly
// spelled, on-brand every time.

import sharp from 'sharp'

const CANVAS = 1024

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
  /** Where the text block sits vertically. Default 'bottom'. */
  position?: 'top' | 'bottom'
}

export async function overlayTitleSubtitle(
  background: Buffer,
  { title, subtitle, position = 'bottom' }: OverlayOptions,
): Promise<Buffer> {
  const titleLines    = wrapLines(title, 18)
  const subtitleLines = subtitle ? wrapLines(subtitle, 30) : []

  const titleFontSize    = 64
  const subtitleFontSize = 34
  const titleLineHeight  = titleFontSize * 1.15
  const subtitleLineHeight = subtitleFontSize * 1.3
  const blockPadding     = 64

  const textBlockHeight =
    titleLines.length * titleLineHeight +
    (subtitleLines.length ? 24 + subtitleLines.length * subtitleLineHeight : 0)

  const scrimHeight = textBlockHeight + blockPadding * 2
  const scrimY = position === 'bottom' ? CANVAS - scrimHeight : 0

  let cursorY = scrimY + blockPadding + titleFontSize * 0.85

  const titleTspans = titleLines.map((line, i) => {
    const y = cursorY + i * titleLineHeight
    return `<text x="50%" y="${y}" text-anchor="middle" font-family="Arial, 'Helvetica Neue', sans-serif" font-weight="800" font-size="${titleFontSize}" fill="#FFFFFF">${escapeXml(line)}</text>`
  }).join('\n')

  cursorY += titleLines.length * titleLineHeight + 24

  const subtitleTspans = subtitleLines.map((line, i) => {
    const y = cursorY + i * subtitleLineHeight + subtitleFontSize * 0.8
    return `<text x="50%" y="${y}" text-anchor="middle" font-family="Arial, 'Helvetica Neue', sans-serif" font-weight="400" font-size="${subtitleFontSize}" fill="#C9A227">${escapeXml(line)}</text>`
  }).join('\n')

  const gradientDirection = position === 'bottom' ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="1" x2="0" y2="0"'

  const svg = `
    <svg width="${CANVAS}" height="${CANVAS}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" ${gradientDirection}>
          <stop offset="0%" stop-color="#0A0E16" stop-opacity="0"/>
          <stop offset="100%" stop-color="#0A0E16" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${scrimY}" width="${CANVAS}" height="${scrimHeight}" fill="url(#scrim)"/>
      ${titleTspans}
      ${subtitleTspans}
    </svg>
  `

  const svgBuffer = Buffer.from(svg)

  const composited = await sharp(background)
    .resize(CANVAS, CANVAS)
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
