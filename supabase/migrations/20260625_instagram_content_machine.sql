-- ─── instagram_posts_log: histórico da máquina de postagem orgânica diária ──
-- Tabela platform-level (não por empresa) — registra cada post gerado e
-- publicado automaticamente na conta @nexus.saas.ia, para auditoria e para
-- o picker de ângulo evitar repetir o mesmo tema em dias consecutivos.
-- Acesso exclusivo via service role (cron job) — sem policy pública.

CREATE TABLE IF NOT EXISTS instagram_posts_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  angle_id    text NOT NULL,
  caption     text NOT NULL,
  image_path  text,
  ig_media_id text,
  permalink   text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_log_created_at ON instagram_posts_log (created_at DESC);

ALTER TABLE instagram_posts_log ENABLE ROW LEVEL SECURITY;
-- No policies — only the service role (used by the cron route) can read/write.
