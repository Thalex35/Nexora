CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Personal' CHECK (length(trim(category)) > 0),
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  learning_item_id UUID REFERENCES public.learning_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notes_user_updated_idx
  ON public.notes (user_id, updated_at DESC);
CREATE INDEX notes_user_category_idx
  ON public.notes (user_id, category);
CREATE INDEX notes_user_pinned_idx
  ON public.notes (user_id, is_pinned, updated_at DESC);
CREATE INDEX notes_tags_idx ON public.notes USING GIN (tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes select"
  ON public.notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notes insert"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own notes update"
  ON public.notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own notes delete"
  ON public.notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER notes_set_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_note_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Notes must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.goals
    WHERE id = NEW.goal_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Note goal must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = NEW.project_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Note project must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id = NEW.task_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Note task must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.learning_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.learning_items
    WHERE id = NEW.learning_item_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Note learning item must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notes_validate_ownership
  BEFORE INSERT OR UPDATE OF user_id, goal_id, project_id, task_id, learning_item_id
  ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.validate_note_ownership();
