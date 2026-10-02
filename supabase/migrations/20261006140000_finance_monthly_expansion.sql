CREATE TABLE public.future_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  planned_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'paid', 'cancelled')),
  paid_date DATE,
  resulting_expense_id UUID UNIQUE
    REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT future_expenses_paid_date_check
    CHECK ((status = 'paid') = (paid_date IS NOT NULL)),
  CONSTRAINT future_expenses_paid_link_check
    CHECK (status = 'paid' OR resulting_expense_id IS NULL)
);

CREATE INDEX future_expenses_user_date_idx
  ON public.future_expenses (user_id, planned_date DESC);
CREATE INDEX future_expenses_user_status_date_idx
  ON public.future_expenses (user_id, status, planned_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_expenses TO authenticated;
GRANT ALL ON public.future_expenses TO service_role;
ALTER TABLE public.future_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own future expenses select"
  ON public.future_expenses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own future expenses insert"
  ON public.future_expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own future expenses update"
  ON public.future_expenses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own future expenses delete"
  ON public.future_expenses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER future_expenses_set_updated_at
  BEFORE UPDATE ON public.future_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_future_expense_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.resulting_expense_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'paid' THEN
    RAISE EXCEPTION 'Only paid future expenses can reference an actual expense'
      USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.transactions AS expense
  WHERE expense.id = NEW.resulting_expense_id
    AND expense.user_id = NEW.user_id
    AND expense.type = 'expense'
    AND expense.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked expense must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER future_expenses_validate_link
  BEFORE INSERT OR UPDATE OF resulting_expense_id, status, user_id
  ON public.future_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_future_expense_link();

CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  creditor TEXT NOT NULL CHECK (length(trim(creditor)) > 0),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  debt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT debts_paid_date_check CHECK ((status = 'paid') = (paid_date IS NOT NULL))
);

CREATE INDEX debts_user_date_idx ON public.debts (user_id, debt_date DESC);
CREATE INDEX debts_user_status_due_idx ON public.debts (user_id, status, due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own debts select"
  ON public.debts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own debts insert"
  ON public.debts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own debts update"
  ON public.debts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own debts delete"
  ON public.debts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER debts_set_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.pay_future_expense(
  p_future_expense_id UUID,
  p_paid_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  planned public.future_expenses%ROWTYPE;
  actual_expense_id UUID;
BEGIN
  SELECT *
  INTO planned
  FROM public.future_expenses
  WHERE id = p_future_expense_id
    AND user_id = auth.uid()
    AND status = 'planned'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planned expense was not found or is no longer payable'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transactions (
    user_id, type, amount, category, description, transaction_date
  )
  VALUES (
    planned.user_id,
    'expense',
    planned.amount,
    planned.title,
    planned.description,
    p_paid_date
  )
  RETURNING id INTO actual_expense_id;

  UPDATE public.future_expenses
  SET status = 'paid',
      paid_date = p_paid_date,
      resulting_expense_id = actual_expense_id
  WHERE id = planned.id
    AND user_id = planned.user_id;

  RETURN actual_expense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_future_expense(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_future_expense(UUID, DATE) TO authenticated;
