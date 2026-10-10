CREATE TABLE public.project_subprojects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  objective TEXT,
  start_date DATE,
  deadline DATE,
  status public.project_status NOT NULL DEFAULT 'planning',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_subprojects_id_project_unique UNIQUE (id, project_id)
);

CREATE INDEX project_subprojects_project_created_idx
  ON public.project_subprojects (project_id, created_at);

ALTER TABLE public.goals
  ADD COLUMN subproject_id UUID
    REFERENCES public.project_subprojects(id) ON DELETE SET NULL;

CREATE INDEX goals_subproject_id_idx ON public.goals (subproject_id);

CREATE FUNCTION public.validate_project_subproject_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Project subprojects must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = NEW.project_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Subproject parent must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER project_subprojects_validate_ownership
  BEFORE INSERT OR UPDATE OF user_id, project_id
  ON public.project_subprojects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_subproject_ownership();

CREATE FUNCTION public.validate_goal_subproject_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.subproject_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.project_subprojects
    WHERE id = NEW.subproject_id
      AND project_id = NEW.project_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Goal subproject must belong to its parent project and user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER goals_validate_subproject_ownership
  BEFORE INSERT OR UPDATE OF user_id, project_id, subproject_id
  ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.validate_goal_subproject_ownership();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_subprojects TO authenticated;
GRANT ALL ON public.project_subprojects TO service_role;

ALTER TABLE public.project_subprojects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own project subprojects select"
  ON public.project_subprojects FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own project subprojects insert"
  ON public.project_subprojects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own project subprojects update"
  ON public.project_subprojects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own project subprojects delete"
  ON public.project_subprojects FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER project_subprojects_set_updated_at
  BEFORE UPDATE ON public.project_subprojects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.recalculate_project_goal_progress(target_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_record public.projects%ROWTYPE;
  subproject_count INTEGER;
  total_goals INTEGER;
  completed_goals INTEGER;
  has_completion_achievement BOOLEAN;
BEGIN
  SELECT * INTO project_record
  FROM public.projects
  WHERE id = target_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND project_record.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Project must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::INTEGER
  INTO subproject_count
  FROM public.project_subprojects
  WHERE project_id = target_project_id;

  SELECT EXISTS (
    SELECT 1 FROM public.achievements
    WHERE user_id = project_record.user_id
      AND project_id = target_project_id
      AND is_project_completion
  ) INTO has_completion_achievement;

  IF subproject_count = 0 THEN
    UPDATE public.projects
    SET progress = 0,
        status = CASE
          WHEN status = 'completed' AND has_completion_achievement
            THEN 'active'::public.project_status
          ELSE status
        END
    WHERE id = target_project_id;

    DELETE FROM public.achievements
    WHERE user_id = project_record.user_id
      AND project_id = target_project_id
      AND is_project_completion;
    RETURN;
  END IF;

  SELECT
    count(*)::INTEGER,
    count(*) FILTER (WHERE goals.status = 'completed')::INTEGER
  INTO total_goals, completed_goals
  FROM public.goals
  WHERE goals.project_id = target_project_id
    AND goals.subproject_id IS NOT NULL;

  IF total_goals = 0 THEN
    UPDATE public.projects
    SET progress = 0,
        status = CASE
          WHEN status = 'completed' AND has_completion_achievement
            THEN 'active'::public.project_status
          ELSE status
        END
    WHERE id = target_project_id;

    DELETE FROM public.achievements
    WHERE user_id = project_record.user_id
      AND project_id = target_project_id
      AND is_project_completion;
    RETURN;
  END IF;

  UPDATE public.projects
  SET progress = round(completed_goals * 100.0 / total_goals)::INTEGER,
      status = CASE
        WHEN status IN ('archived', 'on_hold') THEN status
        WHEN completed_goals = total_goals THEN 'completed'::public.project_status
        WHEN status = 'completed' AND has_completion_achievement
          THEN 'active'::public.project_status
        ELSE status
      END
  WHERE id = target_project_id;

  IF completed_goals = total_goals AND project_record.status NOT IN ('archived', 'on_hold') THEN
    INSERT INTO public.achievements (
      user_id, title, description, category, achievement_date, notes, project_id,
      is_project_completion
    )
    VALUES (
      project_record.user_id,
      'Completed project: ' || project_record.name,
      project_record.description,
      'Projects',
      CURRENT_DATE,
      'Completed after all ' || total_goals || ' subproject '
        || CASE WHEN total_goals = 1 THEN 'goal' ELSE 'goals' END
        || ' were marked complete.',
      target_project_id,
      true
    )
    ON CONFLICT (user_id, project_id)
      WHERE is_project_completion AND project_id IS NOT NULL
      DO NOTHING;
  ELSE
    DELETE FROM public.achievements
    WHERE user_id = project_record.user_id
      AND project_id = target_project_id
      AND is_project_completion;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_goal_project_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.project_id IS NOT NULL THEN
      PERFORM public.recalculate_project_goal_progress(OLD.project_id);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id
     AND OLD.project_id IS NOT NULL THEN
    PERFORM public.recalculate_project_goal_progress(OLD.project_id);
  END IF;

  IF NEW.project_id IS NOT NULL THEN
    PERFORM public.recalculate_project_goal_progress(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER goals_recalculate_project_progress ON public.goals;
CREATE TRIGGER goals_recalculate_project_progress
  AFTER INSERT OR UPDATE OF project_id, subproject_id, status OR DELETE
  ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_goal_project_progress();

CREATE FUNCTION public.handle_subproject_project_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_project_goal_progress(OLD.project_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    PERFORM public.recalculate_project_goal_progress(OLD.project_id);
  END IF;

  PERFORM public.recalculate_project_goal_progress(NEW.project_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_subprojects_recalculate_progress
  AFTER INSERT OR UPDATE OF project_id OR DELETE
  ON public.project_subprojects
  FOR EACH ROW EXECUTE FUNCTION public.handle_subproject_project_progress();

REVOKE EXECUTE ON FUNCTION public.validate_project_subproject_ownership()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_goal_subproject_ownership()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_project_goal_progress(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_goal_project_progress()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_subproject_project_progress()
  FROM PUBLIC, anon, authenticated;
