-- ─── Extended Company Profile ────────────────────────────────────────────────
-- Adds all fields needed for the Business Profile settings module.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS fantasy_name         text,
  ADD COLUMN IF NOT EXISTS slogan               text,
  ADD COLUMN IF NOT EXISTS description          text,
  ADD COLUMN IF NOT EXISTS instagram            text,
  ADD COLUMN IF NOT EXISTS whatsapp_commercial  text,
  ADD COLUMN IF NOT EXISTS banner_url           text,
  ADD COLUMN IF NOT EXISTS icon_url             text,

  -- ── AI Identity ───────────────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS ai_name              text    DEFAULT 'NEXUS IA',
  ADD COLUMN IF NOT EXISTS ai_role              text,
  ADD COLUMN IF NOT EXISTS ai_style             text    DEFAULT 'profissional',

  -- ── Personalisation (feeds the AI context) ────────────────────────────────
  ADD COLUMN IF NOT EXISTS niche                text,
  ADD COLUMN IF NOT EXISTS client_type          text,
  ADD COLUMN IF NOT EXISTS company_objective    text,
  ADD COLUMN IF NOT EXISTS communication_tone   text;

-- ─── Supabase Storage bucket for brand assets ────────────────────────────────
-- This must be executed by a superuser / service-role session.
-- If the bucket already exists the statement is a no-op.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,                                           -- public: images served without signed URL
  5242880,                                        -- 5 MB limit
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only service_role can upload; public read
DROP POLICY IF EXISTS "brand_assets_service_all"  ON storage.objects;
DROP POLICY IF EXISTS "brand_assets_public_read"  ON storage.objects;

CREATE POLICY "brand_assets_service_all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'brand-assets')
  WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "brand_assets_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'brand-assets');
