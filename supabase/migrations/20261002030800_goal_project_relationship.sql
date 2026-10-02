ALTER TABLE public.projects
  ADD COLUMN goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX projects_goal_id_idx ON public.projects (goal_id);

CREATE POLICY "Projects can only reference own goals"
  ON public.projects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    goal_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.goals
      WHERE goals.id = projects.goal_id
        AND goals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    goal_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.goals
      WHERE goals.id = projects.goal_id
        AND goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Tasks can only reference own projects"
  ON public.tasks
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = tasks.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = tasks.project_id
        AND projects.user_id = auth.uid()
    )
  );
