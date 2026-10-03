CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  category TEXT NOT NULL CHECK (length(trim(category)) > 0),
  achievement_date DATE NOT NULL,
  notes TEXT,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  learning_item_id UUID REFERENCES public.learning_items(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX achievements_user_date_idx
  ON public.achievements (user_id, achievement_date DESC, created_at DESC);
CREATE INDEX achievements_user_category_idx
  ON public.achievements (user_id, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own achievements select"
  ON public.achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own achievements insert"
  ON public.achievements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own achievements update"
  ON public.achievements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own achievements delete"
  ON public.achievements FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER achievements_set_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_achievement_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Achievements must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.goals
    WHERE id = NEW.goal_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Achievement goal must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = NEW.project_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Achievement project must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.learning_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.learning_items
    WHERE id = NEW.learning_item_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Achievement learning item must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id = NEW.task_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Achievement task must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER achievements_validate_ownership
  BEFORE INSERT OR UPDATE OF user_id, goal_id, project_id, learning_item_id, task_id
  ON public.achievements
  FOR EACH ROW EXECUTE FUNCTION public.validate_achievement_ownership();
