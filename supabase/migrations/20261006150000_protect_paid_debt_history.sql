DROP POLICY "Users manage own debts delete" ON public.debts;

CREATE POLICY "Users manage own unpaid debts delete"
  ON public.debts FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'unpaid');

CREATE OR REPLACE FUNCTION public.protect_paid_debt_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'paid' THEN
      RAISE EXCEPTION 'Paid debts cannot be deleted'
        USING ERRCODE = '23514';
    END IF;

    RETURN OLD;
  END IF;

  IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    RAISE EXCEPTION 'Paid debts cannot be reopened'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER debts_protect_paid_history
  BEFORE UPDATE OR DELETE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_paid_debt_history();
