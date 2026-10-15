ALTER TABLE public.goals
  ADD COLUMN parent_goal_id UUID
    REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX goals_parent_goal_id_idx ON public.goals (parent_goal_id);

ALTER TABLE public.tasks
  ADD COLUMN goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX tasks_goal_id_idx ON public.tasks (goal_id);

CREATE FUNCTION public.validate_goal_parent_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.goals parent
    WHERE parent.id = NEW.parent_goal_id
      AND parent.user_id = NEW.user_id
      AND parent.project_id IS NOT DISTINCT FROM NEW.project_id
      AND parent.subproject_id IS NOT DISTINCT FROM NEW.subproject_id
  ) THEN
    RAISE EXCEPTION 'Parent goal must belong to the same user, project, and subproject'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.parent_goal_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors(id, parent_goal_id) AS (
      SELECT parent.id, parent.parent_goal_id
      FROM public.goals parent
      WHERE parent.id = NEW.parent_goal_id
      UNION ALL
      SELECT parent.id, parent.parent_goal_id
      FROM public.goals parent
      JOIN ancestors ON parent.id = ancestors.parent_goal_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Goal hierarchy cannot contain a cycle'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER goals_validate_parent_ownership
  BEFORE INSERT OR UPDATE OF user_id, project_id, subproject_id, parent_goal_id
  ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.validate_goal_parent_ownership();

CREATE FUNCTION public.validate_task_goal_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.goals goal
    WHERE goal.id = NEW.goal_id
      AND goal.user_id = NEW.user_id
      AND goal.project_id IS NOT DISTINCT FROM NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Task goal must belong to the same user and project'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_validate_goal_ownership
  BEFORE INSERT OR UPDATE OF user_id, project_id, goal_id
  ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_goal_ownership();

CREATE POLICY "Tasks can only reference own goals"
  ON public.tasks
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    goal_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.goals
      WHERE goals.id = tasks.goal_id
        AND goals.user_id = auth.uid()
        AND goals.project_id IS NOT DISTINCT FROM tasks.project_id
    )
  )
  WITH CHECK (
    goal_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.goals
      WHERE goals.id = tasks.goal_id
        AND goals.user_id = auth.uid()
        AND goals.project_id IS NOT DISTINCT FROM tasks.project_id
    )
  );

CREATE FUNCTION public.import_project_structure(
  p_project_id UUID,
  p_subprojects JSONB,
  p_goals JSONB,
  p_tasks JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  importing_user UUID := auth.uid();
  subproject_count INTEGER;
  goal_count INTEGER;
  task_count INTEGER;
BEGIN
  IF importing_user IS NULL THEN
    RAISE EXCEPTION 'Sign in before importing project structure'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_subprojects) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_goals) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_tasks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Import data must contain subproject, goal, and task arrays'
      USING ERRCODE = '22023';
  END IF;

  subproject_count := jsonb_array_length(p_subprojects);
  goal_count := jsonb_array_length(p_goals);
  task_count := jsonb_array_length(p_tasks);
  IF subproject_count + goal_count + task_count > 1000 THEN
    RAISE EXCEPTION 'An import cannot contain more than 1000 items'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_subprojects) AS incoming(id UUID, title TEXT)
    WHERE incoming.id IS NULL OR nullif(trim(incoming.title), '') IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_goals) AS incoming(id UUID, title TEXT)
    WHERE incoming.id IS NULL OR nullif(trim(incoming.title), '') IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_tasks) AS incoming(id UUID, title TEXT)
    WHERE incoming.id IS NULL OR nullif(trim(incoming.title), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Every imported item must have an ID and a non-empty name'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.projects
  WHERE id = p_project_id AND user_id = importing_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected project could not be found'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_subprojects) AS incoming(id UUID, title TEXT)
    GROUP BY lower(trim(title))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'The import contains duplicate subproject names'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_subprojects)
      AS incoming(id UUID, title TEXT)
    JOIN public.project_subprojects existing
      ON existing.project_id = p_project_id
      AND lower(trim(existing.title)) = lower(trim(incoming.title))
  ) THEN
    RAISE EXCEPTION 'A subproject with one of these names already exists'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_goals)
      AS incoming(id UUID, title TEXT, parent_goal_id UUID, subproject_id UUID)
    GROUP BY lower(trim(title)), parent_goal_id, subproject_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'The import contains duplicate goal names under the same parent'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_goals)
      AS incoming(id UUID, title TEXT, parent_goal_id UUID, subproject_id UUID)
    JOIN public.goals existing
      ON existing.project_id = p_project_id
      AND existing.parent_goal_id IS NOT DISTINCT FROM incoming.parent_goal_id
      AND existing.subproject_id IS NOT DISTINCT FROM incoming.subproject_id
      AND lower(trim(existing.title)) = lower(trim(incoming.title))
  ) THEN
    RAISE EXCEPTION 'A goal with one of these names already exists under the selected parent'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_tasks) AS incoming(id UUID, title TEXT, goal_id UUID)
    GROUP BY lower(trim(title)), goal_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'The import contains duplicate objective names under the same goal'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_tasks)
      AS incoming(id UUID, title TEXT, goal_id UUID)
    JOIN public.tasks existing
      ON existing.project_id = p_project_id
      AND existing.goal_id IS NOT DISTINCT FROM incoming.goal_id
      AND lower(trim(existing.title)) = lower(trim(incoming.title))
  ) THEN
    RAISE EXCEPTION 'An objective with one of these names already exists under the selected goal'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.project_subprojects (
    id, user_id, project_id, title, description, objective, start_date, deadline, status, priority
  )
  SELECT
    incoming.id,
    importing_user,
    p_project_id,
    trim(incoming.title),
    nullif(trim(incoming.description), ''),
    nullif(trim(incoming.objective), ''),
    incoming.start_date,
    incoming.deadline,
    coalesce(incoming.status, 'planning'::public.project_status),
    coalesce(incoming.priority, 'medium'::public.task_priority)
  FROM jsonb_to_recordset(p_subprojects) AS incoming(
    id UUID,
    title TEXT,
    description TEXT,
    objective TEXT,
    start_date DATE,
    deadline DATE,
    status public.project_status,
    priority public.task_priority
  );

  INSERT INTO public.goals (
    id, user_id, project_id, subproject_id, parent_goal_id, title, description,
    status, target_date, progress
  )
  SELECT
    incoming.id,
    importing_user,
    p_project_id,
    incoming.subproject_id,
    incoming.parent_goal_id,
    trim(incoming.title),
    nullif(trim(incoming.description), ''),
    coalesce(incoming.status, 'active'::public.goal_status),
    incoming.target_date,
    0
  FROM jsonb_to_recordset(p_goals) AS incoming(
    id UUID,
    subproject_id UUID,
    parent_goal_id UUID,
    title TEXT,
    description TEXT,
    status public.goal_status,
    target_date DATE
  )
  ORDER BY (incoming.parent_goal_id IS NOT NULL);

  INSERT INTO public.tasks (
    id, user_id, project_id, goal_id, title, description, status, priority, due_date
  )
  SELECT
    incoming.id,
    importing_user,
    p_project_id,
    incoming.goal_id,
    trim(incoming.title),
    nullif(trim(incoming.description), ''),
    coalesce(incoming.status, 'todo'::public.task_status),
    coalesce(incoming.priority, 'medium'::public.task_priority),
    incoming.due_date
  FROM jsonb_to_recordset(p_tasks) AS incoming(
    id UUID,
    goal_id UUID,
    title TEXT,
    description TEXT,
    status public.task_status,
    priority public.task_priority,
    due_date DATE
  );

  RETURN jsonb_build_object(
    'subprojects', subproject_count,
    'goals', goal_count,
    'objectives', task_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_project_structure(UUID, JSONB, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_project_structure(UUID, JSONB, JSONB, JSONB) TO authenticated;
