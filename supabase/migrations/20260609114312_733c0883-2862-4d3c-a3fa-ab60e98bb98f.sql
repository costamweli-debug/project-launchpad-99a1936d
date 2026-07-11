
CREATE TABLE public.chat_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'New project',
  color TEXT NOT NULL DEFAULT 'slate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_projects TO authenticated;
GRANT ALL ON public.chat_projects TO service_role;

ALTER TABLE public.chat_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat projects" ON public.chat_projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_chat_projects_updated_at
  BEFORE UPDATE ON public.chat_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.chat_threads
  ADD COLUMN project_id UUID REFERENCES public.chat_projects(id) ON DELETE SET NULL;

CREATE INDEX chat_threads_user_project_idx
  ON public.chat_threads(user_id, project_id, updated_at DESC);
