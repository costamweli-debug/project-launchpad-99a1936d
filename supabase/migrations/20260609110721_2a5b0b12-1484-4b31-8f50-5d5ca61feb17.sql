
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS chat_messages_content_tsv_idx
  ON public.chat_messages USING GIN (content_tsv);

CREATE INDEX IF NOT EXISTS chat_messages_user_thread_created_idx
  ON public.chat_messages (user_id, thread_id, created_at DESC);
