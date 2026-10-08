CREATE TABLE public.project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  planned_amount NUMERIC(12, 2) NOT NULL CHECK (planned_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'HTG')),
  available_funds NUMERIC(12, 2) CHECK (available_funds IS NULL OR available_funds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_budgets_id_user_id_unique UNIQUE (id, user_id)
);

CREATE TABLE public.project_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  budget_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  category TEXT NOT NULL CHECK (length(trim(category)) > 0),
  planned_amount NUMERIC(12, 2) NOT NULL CHECK (planned_amount >= 0),
  actual_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (actual_amount >= 0),
  target_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_budget_items_budget_owner_fkey
    FOREIGN KEY (budget_id, user_id)
    REFERENCES public.project_budgets (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX project_budget_items_budget_date_idx
  ON public.project_budget_items (budget_id, target_date, created_at);

CREATE FUNCTION public.validate_project_budget_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Project budgets must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = NEW.project_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Budget project must belong to the same user'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER project_budgets_validate_ownership
  BEFORE INSERT OR UPDATE OF user_id, project_id
  ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_budget_ownership();

CREATE FUNCTION public.prevent_project_budget_currency_change_with_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.currency IS DISTINCT FROM OLD.currency AND EXISTS (
    SELECT 1 FROM public.project_budget_items
    WHERE budget_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Delete all budget items before changing the budget currency'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER project_budgets_currency_change_guard
  BEFORE UPDATE OF currency
  ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_project_budget_currency_change_with_items();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_budgets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_budget_items TO authenticated;
GRANT ALL ON public.project_budgets TO service_role;
GRANT ALL ON public.project_budget_items TO service_role;

ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own project budgets select"
  ON public.project_budgets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own project budgets insert"
  ON public.project_budgets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own project budgets update"
  ON public.project_budgets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own project budgets delete"
  ON public.project_budgets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own project budget items select"
  ON public.project_budget_items FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users manage own project budget items insert"
  ON public.project_budget_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own project budget items update"
  ON public.project_budget_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own project budget items delete"
  ON public.project_budget_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER project_budgets_set_updated_at
  BEFORE UPDATE ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER project_budget_items_set_updated_at
  BEFORE UPDATE ON public.project_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
