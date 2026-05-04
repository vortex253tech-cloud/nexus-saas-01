-- ──────────────────────────────────────────────────────────────────────────────
-- NEXUS AI CHAT SYSTEM — Database Migration
-- Run this in Supabase SQL Editor
-- ──────────────────────────────────────────────────────────────────────────────

-- nexus_ai_conversations: one row per chat session
CREATE TABLE IF NOT EXISTS public.nexus_ai_conversations (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID        NOT NULL,
  title      TEXT        NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_company ON public.nexus_ai_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_user    ON public.nexus_ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_updated ON public.nexus_ai_conversations(updated_at DESC);

ALTER TABLE public.nexus_ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_conversations" ON public.nexus_ai_conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "service_role_all_conversations" ON public.nexus_ai_conversations
  FOR ALL TO service_role USING (true);

-- nexus_ai_messages: individual messages inside a conversation
CREATE TABLE IF NOT EXISTS public.nexus_ai_messages (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID        NOT NULL REFERENCES public.nexus_ai_conversations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL,
  action_card     JSONB,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_msg_conversation ON public.nexus_ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_msg_created      ON public.nexus_ai_messages(created_at);

ALTER TABLE public.nexus_ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_messages" ON public.nexus_ai_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.nexus_ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_all_messages" ON public.nexus_ai_messages
  FOR ALL TO service_role USING (true);

-- Auto-update updated_at on conversations when messages are inserted
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.nexus_ai_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_ts ON public.nexus_ai_messages;
CREATE TRIGGER trg_update_conversation_ts
  AFTER INSERT ON public.nexus_ai_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();
