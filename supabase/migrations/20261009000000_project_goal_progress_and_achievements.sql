ALTER TABLE public.goals
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX goals_project_id_idx ON public.goals (project_id);

CREATE OR REPLACE FUNCTION public.validate_goal_project_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Goals must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = NEW.project_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Goal project must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER goals_validate_project_ownership
  BEFORE INSERT OR UPDATE OF user_id, project_id
  ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.validate_goal_project_ownership();

ALTER TABLE public.achievements
  ADD COLUMN is_project_completion BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX achievements_project_completion_unique_idx
  ON public.achievements (user_id, project_id)
  WHERE is_project_completion AND project_id IS NOT NULL;

DROP POLICY "Users manage own achievements insert" ON public.achievements;
CREATE POLICY "Users add own manual achievements"
  ON public.achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT is_project_completion);

DROP POLICY "Users manage own achievements update" ON public.achievements;
CREATE POLICY "Users update own manual achievements"
  ON public.achievements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND NOT is_project_completion)
  WITH CHECK (auth.uid() = user_id AND NOT is_project_completion);

CREATE OR REPLACE FUNCTION public.recalculate_project_goal_progress(target_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_owner UUID;
  total_goals INTEGER;
  completed_goals INTEGER;
  project_record public.projects%ROWTYPE;
BEGIN
  SELECT * INTO project_record
  FROM public.projects
  WHERE id = target_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  project_owner := project_record.user_id;
  IF auth.uid() IS NOT NULL AND project_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Project must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*)::INTEGER,
    count(*) FILTER (WHERE goals.status = 'completed')::INTEGER
  INTO total_goals, completed_goals
  FROM public.goals
  WHERE goals.project_id = target_project_id
     OR goals.id = project_record.goal_id;

  IF total_goals = 0 THEN
    UPDATE public.projects
    SET progress = 0,
        status = CASE
          WHEN status = 'completed' THEN 'active'::public.project_status
          ELSE status
        END
    WHERE id = target_project_id;
    DELETE FROM public.achievements
    WHERE user_id = project_owner
      AND project_id = target_project_id
      AND is_project_completion;
    RETURN;
  END IF;

  UPDATE public.projects
  SET progress = round(completed_goals * 100.0 / total_goals)::INTEGER,
      status = CASE
        WHEN completed_goals = total_goals THEN 'completed'::public.project_status
        WHEN status = 'completed' THEN 'active'::public.project_status
        ELSE status
      END
  WHERE id = target_project_id;

  IF completed_goals = total_goals THEN
    INSERT INTO public.achievements (
      user_id, title, description, category, achievement_date, notes, project_id,
      is_project_completion
    )
    VALUES (
      project_owner,
      'Completed project: ' || project_record.name,
      project_record.description,
      'Projects',
      CURRENT_DATE,
      'Completed after all ' || total_goals || ' linked '
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
    WHERE user_id = project_owner
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

CREATE TRIGGER goals_recalculate_project_progress
  AFTER INSERT OR UPDATE OF project_id, status OR DELETE
  ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_goal_project_progress();

CREATE OR REPLACE FUNCTION public.handle_project_legacy_goal_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.goal_id IS DISTINCT FROM NEW.goal_id THEN
    PERFORM public.recalculate_project_goal_progress(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_recalculate_legacy_goal_progress
  AFTER UPDATE OF goal_id
  ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_project_legacy_goal_progress();

CREATE OR REPLACE FUNCTION public.recalculate_project_after_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_project_goal_progress(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_recalculate_goals_after_create
  AFTER INSERT
  ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_project_after_create();

CREATE OR REPLACE FUNCTION public.sync_project_progress_from_goals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_goals INTEGER;
  completed_goals INTEGER;
BEGIN
  SELECT
    count(*)::INTEGER,
    count(*) FILTER (WHERE goals.status = 'completed')::INTEGER
  INTO total_goals, completed_goals
  FROM public.goals
  WHERE goals.project_id = NEW.id
     OR goals.id = NEW.goal_id;

  IF total_goals > 0 THEN
    NEW.progress := round(completed_goals * 100.0 / total_goals)::INTEGER;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_sync_goal_progress_before_insert
  BEFORE INSERT
  ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_progress_from_goals();

CREATE TRIGGER projects_sync_goal_progress_before_update
  BEFORE UPDATE OF progress, goal_id
  ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_progress_from_goals();

CREATE OR REPLACE FUNCTION public.handle_project_reopen_achievement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    DELETE FROM public.achievements
    WHERE user_id = NEW.user_id
      AND project_id = NEW.id
      AND is_project_completion;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_remove_completion_achievement_on_reopen
  AFTER UPDATE OF status
  ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_project_reopen_achievement();

WITH project_goal_counts AS (
  SELECT
    projects.id,
    count(goals.id)::INTEGER AS total_goals,
    count(goals.id) FILTER (WHERE goals.status = 'completed')::INTEGER AS completed_goals
  FROM public.projects
  LEFT JOIN public.goals
    ON goals.project_id = projects.id
    OR goals.id = projects.goal_id
  GROUP BY projects.id
)
UPDATE public.projects
SET progress = CASE
      WHEN project_goal_counts.total_goals = 0 THEN public.projects.progress
      ELSE round(
        project_goal_counts.completed_goals * 100.0 / project_goal_counts.total_goals
      )::INTEGER
    END,
    status = CASE
      WHEN project_goal_counts.total_goals > 0
       AND project_goal_counts.completed_goals = project_goal_counts.total_goals
        THEN 'completed'::public.project_status
      WHEN project_goal_counts.total_goals > 0
       AND project_goal_counts.completed_goals < project_goal_counts.total_goals
       AND public.projects.status = 'completed'
        THEN 'active'::public.project_status
      ELSE public.projects.status
    END
FROM project_goal_counts
WHERE project_goal_counts.id = public.projects.id;

REVOKE EXECUTE ON FUNCTION public.recalculate_project_goal_progress(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_goal_project_progress()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_project_legacy_goal_progress()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_project_after_create()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_project_reopen_achievement()
  FROM PUBLIC, anon, authenticated;
