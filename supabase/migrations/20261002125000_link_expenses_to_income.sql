ALTER TABLE public.transactions
  ADD COLUMN income_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE INDEX transactions_income_id_idx
  ON public.transactions (income_id)
  WHERE income_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_transaction_income_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type <> 'income' AND EXISTS (
    SELECT 1
    FROM public.transactions AS linked_expense
    WHERE linked_expense.income_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Income with linked expenses cannot be changed to an expense'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.income_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.type <> 'expense' THEN
    RAISE EXCEPTION 'Only expenses can be linked to income'
      USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.transactions AS income
  WHERE income.id = NEW.income_id
    AND income.user_id = NEW.user_id
    AND income.user_id = auth.uid()
    AND income.type = 'income';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked income must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_validate_income_link
  BEFORE INSERT OR UPDATE OF income_id, user_id, type
  ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transaction_income_link();
