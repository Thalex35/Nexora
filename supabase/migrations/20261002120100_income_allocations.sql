CREATE TABLE public.income_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  income_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('percentage', 'fixed')),
  value NUMERIC(14, 2) NOT NULL CHECK (value > 0),
  planned_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT income_allocations_percentage_value_check
    CHECK (allocation_type <> 'percentage' OR value <= 100)
);

CREATE INDEX income_allocations_user_idx ON public.income_allocations (user_id);
CREATE INDEX income_allocations_income_date_idx
  ON public.income_allocations (income_id, planned_date, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_allocations TO authenticated;
GRANT ALL ON public.income_allocations TO service_role;

ALTER TABLE public.income_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own income allocations select"
  ON public.income_allocations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own income allocations insert"
  ON public.income_allocations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own income allocations update"
  ON public.income_allocations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own income allocations delete"
  ON public.income_allocations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allocations can only reference own income"
  ON public.income_allocations
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = income_allocations.income_id
        AND transactions.user_id = auth.uid()
        AND transactions.type = 'income'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE transactions.id = income_allocations.income_id
        AND transactions.user_id = auth.uid()
        AND transactions.type = 'income'
    )
  );

CREATE TRIGGER income_allocations_set_updated_at
  BEFORE UPDATE ON public.income_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
