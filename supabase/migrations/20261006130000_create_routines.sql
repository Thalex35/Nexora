CREATE TABLE public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX routines_user_active_order_idx
  ON public.routines (user_id, is_active, sort_order, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT ALL ON public.routines TO service_role;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own routines select"
  ON public.routines FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own routines insert"
  ON public.routines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own routines update"
  ON public.routines FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own routines delete"
  ON public.routines FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER routines_set_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.routine_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL,
  user_id UUID NOT NULL,
  completion_date DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (routine_id, completion_date),
  FOREIGN KEY (routine_id, user_id)
    REFERENCES public.routines (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX routine_completions_user_date_idx
  ON public.routine_completions (user_id, completion_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_completions TO authenticated;
GRANT ALL ON public.routine_completions TO service_role;
ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own routine completions select"
  ON public.routine_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own routine completions insert"
  ON public.routine_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own routine completions update"
  ON public.routine_completions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own routine completions delete"
  ON public.routine_completions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
