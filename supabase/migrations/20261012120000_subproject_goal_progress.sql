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
    AND goals.subproject_id IS NOT NULL;

  IF total_goals > 0 THEN
    NEW.progress := round(completed_goals * 100.0 / total_goals)::INTEGER;
  END IF;
  RETURN NEW;
END;
$$;
