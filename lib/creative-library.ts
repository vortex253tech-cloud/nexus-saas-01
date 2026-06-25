// ─── Creative library ──────────────────────────────────────────────────────
// On-demand generator for the formats outside the daily organic feed cron:
// Stories (auto-published, like a feed post) and paid-ad creatives (image +
// copy only — there's no Marketing API integration here, so the actual ad
// upload into Meta Ads Manager stays a manual step; this generates the
// asset and matching ad copy, ready to drop into a campaign).
//
// Reuses the same ANGLES catalog as the organic feed system — one source of
// truth for "what NEXUS says", rendered into whichever format fits the use
// case (feed / story / ad_square), with format-specific extras (a CTA bar
// baked into ad creatives, a "Novidade" badge for lançamento angles).

import { getSupabaseServerClient } from '@/lib/supabase'
import { uploadFile } from '@/lib/storage/upload'
import {
  ANGLES, type Angle, generatePostCopy, generateImageWithOverlay,
  publishStoryToInstagram, type PublishResult,
} from '@/lib/instagram-content-machine'
import type { CreativeFormat } from '@/lib/image-text-overlay'

export interface GeneratedCreative {
  angleId: string
  format: CreativeFormat
  title: string
  subtitle: string
  caption: string
  imageUrl: string
  imagePath: string
}

function findAngle(angleId: string): Angle {
  const angle = ANGLES.find(a => a.id === angleId)
  if (!angle) throw new Error(`Ângulo "${angleId}" não encontrado`)
  if (angle.format === 'carousel') throw new Error(`Ângulo "${angleId}" é um carrossel — biblioteca de criativos só gera peças únicas`)
  return angle
}

// Generates (copy + image) and uploads a creative for a given angle in the
// requested format, without publishing anywhere — used by both the ad-asset
// flow and the Stories flow below.
export async function generateCreativeAsset(angleId: string, format: CreativeFormat, ctaLabel?: string): Promise<GeneratedCreative> {
  const angle = findAngle(angleId)
  const copy = await generatePostCopy(angle, [])

  const imageBuffer = await generateImageWithOverlay({
    prompt: angle.imagePrompt,
    screenshotPath: angle.screenshotPath,
    title: copy.title,
    subtitle: copy.subtitle,
    format,
    badge: angle.launchBadge,
    ctaLabel,
  })

  const upload = await uploadFile(imageBuffer, `creative-${format}-${angle.id}-${Date.now()}.png`, 'image/png', 'platform-instagram')
  if ('error' in upload) throw new Error(upload.error)

  return {
    angleId: angle.id, format, title: copy.title, subtitle: copy.subtitle, caption: copy.caption,
    imageUrl: upload.url, imagePath: upload.path,
  }
}

// Ad creative: image (1:1, CTA baked in) + matching copy, stored for manual
// upload into Meta Ads Manager. Default CTA points to the free diagnostic,
// matching the existing paid-traffic funnel.
export async function generateAdCreative(angleId: string, ctaLabel = 'Diagnóstico gratuito >'): Promise<GeneratedCreative> {
  return generateCreativeAsset(angleId, 'ad_square', ctaLabel)
}

// Story: generated, uploaded, AND published immediately (Stories are
// ephemeral and time-sensitive — there's no value in generating one to sit
// unpublished). Logged in the same instagram_posts_log table as feed posts,
// tagged via the angle id, so the daily LRU rotation still sees it as recent
// usage of that angle.
export async function generateAndPublishStory(angleId: string): Promise<GeneratedCreative & PublishResult> {
  const asset = await generateCreativeAsset(angleId, 'story')
  const db = getSupabaseServerClient()

  const { data: inserted } = await db
    .from('instagram_posts_log')
    .insert({ angle_id: asset.angleId, caption: asset.caption, image_path: asset.imagePath, status: 'pending' })
    .select('id')
    .single()

  try {
    const { mediaId, permalink } = await publishStoryToInstagram(asset.imageUrl)
    if (inserted?.id) {
      await db.from('instagram_posts_log').update({ ig_media_id: mediaId, permalink, status: 'published' }).eq('id', inserted.id)
    }
    return { ...asset, mediaId, permalink }
  } catch (err) {
    if (inserted?.id) {
      await db.from('instagram_posts_log').update({ status: 'failed', error: err instanceof Error ? err.message : String(err) }).eq('id', inserted.id)
    }
    throw err
  }
}
