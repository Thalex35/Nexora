REVOKE ALL ON TABLE public.notification_read_states FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.notification_read_states TO authenticated;
GRANT ALL ON TABLE public.notification_read_states TO service_role;
