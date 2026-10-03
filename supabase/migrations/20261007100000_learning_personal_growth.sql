CREATE TABLE public.learning_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date DATE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX learning_items_user_status_idx
  ON public.learning_items (user_id, status, updated_at DESC);
CREATE INDEX learning_items_user_category_idx
  ON public.learning_items (user_id, category);
CREATE INDEX learning_items_user_target_date_idx
  ON public.learning_items (user_id, target_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_items TO authenticated;
GRANT ALL ON public.learning_items TO service_role;
ALTER TABLE public.learning_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own learning items select"
  ON public.learning_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own learning items insert"
  ON public.learning_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own learning items update"
  ON public.learning_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own learning items delete"
  ON public.learning_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER learning_items_set_updated_at
  BEFORE UPDATE ON public.learning_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_learning_item_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Learning items must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.goals
    WHERE id = NEW.goal_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Learning item goal must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = NEW.project_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Learning item project must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id = NEW.task_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Learning item task must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER learning_items_validate_ownership
  BEFORE INSERT OR UPDATE OF user_id, goal_id, project_id, task_id
  ON public.learning_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_learning_item_ownership();

CREATE TABLE public.learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  learning_item_id UUID REFERENCES public.learning_items(id) ON DELETE SET NULL,
  learning_item_title TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  studied TEXT NOT NULL CHECK (length(trim(studied)) > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX learning_sessions_user_date_idx
  ON public.learning_sessions (user_id, session_date DESC, created_at DESC);
CREATE INDEX learning_sessions_item_date_idx
  ON public.learning_sessions (learning_item_id, session_date DESC);

GRANT SELECT, INSERT ON public.learning_sessions TO authenticated;
REVOKE UPDATE, DELETE ON public.learning_sessions FROM authenticated;
GRANT ALL ON public.learning_sessions TO service_role;
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own learning sessions"
  ON public.learning_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users add own learning sessions"
  ON public.learning_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_learning_session_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actual_item_title TEXT;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Learning sessions must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.learning_item_id IS NULL THEN
    RAISE EXCEPTION 'New learning sessions must belong to a learning item'
      USING ERRCODE = '23514';
  END IF;

  SELECT title INTO actual_item_title
  FROM public.learning_items
  WHERE id = NEW.learning_item_id AND user_id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Learning session item must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  NEW.learning_item_title := actual_item_title;
  RETURN NEW;
END;
$$;

CREATE TRIGGER learning_sessions_validate_ownership
  BEFORE INSERT ON public.learning_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_learning_session_ownership();
