CREATE TABLE public.daily_habit_settings (
  user_id UUID PRIMARY KEY,
  reading_target_minutes INTEGER NOT NULL DEFAULT 20
    CHECK (reading_target_minutes BETWEEN 1 AND 1440),
  hydration_target_ml INTEGER NOT NULL DEFAULT 2000
    CHECK (hydration_target_ml > 0),
  learning_target_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (learning_target_minutes BETWEEN 1 AND 1440),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.daily_reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  book_title TEXT,
  pages_read INTEGER NOT NULL DEFAULT 0 CHECK (pages_read >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    duration_minutes > 0
    OR pages_read > 0
    OR length(trim(COALESCE(book_title, ''))) > 0
  )
);

CREATE TABLE public.daily_hydration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_ml INTEGER NOT NULL CHECK (amount_ml > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.daily_learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  topic TEXT,
  studied TEXT,
  understood TEXT,
  practiced TEXT,
  notes TEXT,
  next_steps TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.daily_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reflection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  accomplished TEXT NOT NULL DEFAULT '',
  learned TEXT NOT NULL DEFAULT '',
  improve TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reflection_date)
);

CREATE INDEX daily_reading_sessions_user_date_idx
  ON public.daily_reading_sessions (user_id, session_date DESC, created_at DESC);
CREATE INDEX daily_hydration_logs_user_date_idx
  ON public.daily_hydration_logs (user_id, logged_date DESC, created_at DESC);
CREATE INDEX daily_learning_sessions_user_date_idx
  ON public.daily_learning_sessions (user_id, session_date DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_habit_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reading_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_hydration_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_learning_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reflections TO authenticated;
GRANT ALL ON public.daily_habit_settings TO service_role;
GRANT ALL ON public.daily_reading_sessions TO service_role;
GRANT ALL ON public.daily_hydration_logs TO service_role;
GRANT ALL ON public.daily_learning_sessions TO service_role;
GRANT ALL ON public.daily_reflections TO service_role;

ALTER TABLE public.daily_habit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_hydration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own daily habit settings"
  ON public.daily_habit_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own daily reading sessions"
  ON public.daily_reading_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own daily hydration logs"
  ON public.daily_hydration_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own daily learning sessions"
  ON public.daily_learning_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own daily reflections"
  ON public.daily_reflections FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER daily_habit_settings_set_updated_at
  BEFORE UPDATE ON public.daily_habit_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER daily_reflections_set_updated_at
  BEFORE UPDATE ON public.daily_reflections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
