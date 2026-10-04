CREATE TABLE public.notification_read_states (
  user_id UUID NOT NULL,
  source_key TEXT NOT NULL CHECK (length(source_key) BETWEEN 1 AND 240),
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source_key)
);

GRANT SELECT, INSERT ON public.notification_read_states TO authenticated;
GRANT ALL ON public.notification_read_states TO service_role;
ALTER TABLE public.notification_read_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notification states"
  ON public.notification_read_states FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users add own notification states"
  ON public.notification_read_states FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
