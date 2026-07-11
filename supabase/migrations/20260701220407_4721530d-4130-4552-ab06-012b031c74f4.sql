
CREATE TABLE public.chat_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_tags TO authenticated;
GRANT ALL ON public.chat_tags TO service_role;
ALTER TABLE public.chat_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their tags" ON public.chat_tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.chat_thread_tags (
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.chat_tags(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_thread_tags TO authenticated;
GRANT ALL ON public.chat_thread_tags TO service_role;
ALTER TABLE public.chat_thread_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their thread tags" ON public.chat_thread_tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_thread_tags_thread ON public.chat_thread_tags(thread_id);
CREATE INDEX idx_chat_thread_tags_tag ON public.chat_thread_tags(tag_id);
CREATE INDEX idx_chat_tags_user ON public.chat_tags(user_id);
