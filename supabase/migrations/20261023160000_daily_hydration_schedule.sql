CREATE TABLE public.daily_hydration_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, time),
  UNIQUE (id, user_id)
);

CREATE TABLE public.daily_hydration_schedule_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, completed_date),
  FOREIGN KEY (slot_id, user_id)
    REFERENCES public.daily_hydration_schedule_slots(id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX daily_hydration_schedule_completions_user_date_idx
  ON public.daily_hydration_schedule_completions (user_id, completed_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_hydration_schedule_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_hydration_schedule_completions TO authenticated;
GRANT ALL ON public.daily_hydration_schedule_slots TO service_role;
GRANT ALL ON public.daily_hydration_schedule_completions TO service_role;

ALTER TABLE public.daily_hydration_schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_hydration_schedule_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own daily hydration schedule slots"
  ON public.daily_hydration_schedule_slots FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own daily hydration schedule completions"
  ON public.daily_hydration_schedule_completions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
