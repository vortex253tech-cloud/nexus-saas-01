-- ─── NEXUS AI Multimodal Engine — Database Schema ────────────────────────────
-- Idempotent: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. ai_attachments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_attachments (
  id                uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id           uuid         REFERENCES users(id) ON DELETE SET NULL,
  conversation_id   uuid         REFERENCES nexus_ai_conversations(id) ON DELETE CASCADE,
  message_id        uuid         NULL,
  name              text         NOT NULL,
  mime_type         text         NOT NULL,
  file_size         bigint       NOT NULL,
  bucket            text         NOT NULL,
  storage_path      text         NOT NULL,
  extracted_text    text         NULL,
  ai_summary        text         NULL,
  metadata          jsonb        NOT NULL DEFAULT '{}',
  created_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_attachments_company  ON ai_attachments(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_attachments_conv     ON ai_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_attachments_created  ON ai_attachments(created_at DESC);

ALTER TABLE ai_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can access own attachments" ON ai_attachments;
CREATE POLICY "company members can access own attachments"
  ON ai_attachments FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 2. ai_memory ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_memory (
  id            uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key           text         NOT NULL,
  value         text         NOT NULL,
  source        text         NULL,
  importance    smallint     NOT NULL DEFAULT 5,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(company_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_company    ON ai_memory(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_importance ON ai_memory(company_id, importance DESC);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can access own memory" ON ai_memory;
CREATE POLICY "company members can access own memory"
  ON ai_memory FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM companies c
      JOIN users u ON u.id = c.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 3. attachments column on nexus_ai_messages ────────────────────────────────

ALTER TABLE nexus_ai_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';

-- ── 4. Storage buckets ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('ai-files',  'ai-files',  false, 10485760,
   ARRAY['application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'text/csv','text/plain']),
  ('ai-images', 'ai-images', false, 5242880,
   ARRAY['image/png','image/jpeg','image/webp','image/gif']),
  ('ai-audio',  'ai-audio',  false, 26214400,
   ARRAY['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a','audio/ogg','audio/webm'])
ON CONFLICT (id) DO NOTHING;

-- ── 5. Storage RLS policies ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated can upload ai-files"        ON storage.objects;
DROP POLICY IF EXISTS "authenticated can read own ai-files"      ON storage.objects;
DROP POLICY IF EXISTS "authenticated can upload ai-images"       ON storage.objects;
DROP POLICY IF EXISTS "authenticated can read own ai-images"     ON storage.objects;
DROP POLICY IF EXISTS "authenticated can upload ai-audio"        ON storage.objects;
DROP POLICY IF EXISTS "authenticated can read own ai-audio"      ON storage.objects;

CREATE POLICY "authenticated can upload ai-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-files');

CREATE POLICY "authenticated can read own ai-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-files');

CREATE POLICY "authenticated can upload ai-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-images');

CREATE POLICY "authenticated can read own ai-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-images');

CREATE POLICY "authenticated can upload ai-audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-audio');

CREATE POLICY "authenticated can read own ai-audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-audio');
