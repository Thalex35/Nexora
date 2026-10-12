CREATE TABLE public.business_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  nickname TEXT,
  contact_info TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_customers_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE public.business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  account_type TEXT NOT NULL CHECK (account_type IN ('meru', 'cash', 'crypto', 'other')),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z0-9]{3,8}$'),
  opening_balance NUMERIC(24, 8) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_accounts_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE public.business_customer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  receipt_account_id UUID NOT NULL,
  payout_account_id UUID NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  htg_received NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (htg_received >= 0),
  usd_sent NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (usd_sent >= 0),
  exchange_rate NUMERIC(18, 6) CHECK (exchange_rate IS NULL OR exchange_rate > 0),
  service_fee_usd NUMERIC(18, 2) CHECK (service_fee_usd IS NULL OR service_fee_usd >= 0),
  crypto_cost_usd NUMERIC(18, 2) CHECK (crypto_cost_usd IS NULL OR crypto_cost_usd >= 0),
  transfer_fee_usd NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (transfer_fee_usd >= 0),
  other_expenses_usd NUMERIC(18, 2) CHECK (other_expenses_usd IS NULL OR other_expenses_usd >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'reversed')),
  reference_code TEXT,
  idempotency_key UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_customer_transactions_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT business_customer_transactions_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT business_customer_transactions_customer_owner_fkey
    FOREIGN KEY (customer_id, user_id)
    REFERENCES public.business_customers (id, user_id),
  CONSTRAINT business_customer_transactions_receipt_account_owner_fkey
    FOREIGN KEY (receipt_account_id, user_id)
    REFERENCES public.business_accounts (id, user_id),
  CONSTRAINT business_customer_transactions_payout_account_owner_fkey
    FOREIGN KEY (payout_account_id, user_id)
    REFERENCES public.business_accounts (id, user_id)
);

CREATE UNIQUE INDEX business_customer_transactions_reference_idx
  ON public.business_customer_transactions (user_id, reference_code)
  WHERE reference_code IS NOT NULL AND length(trim(reference_code)) > 0;

CREATE TABLE public.business_fundings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  funding_type TEXT NOT NULL CHECK (funding_type IN ('replenishment', 'crypto_purchase', 'crypto_transfer', 'asset_transfer')),
  source_account_id UUID,
  destination_account_id UUID NOT NULL,
  source_amount NUMERIC(24, 8),
  credited_amount NUMERIC(24, 8) NOT NULL CHECK (credited_amount > 0),
  fee_amount NUMERIC(24, 8) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  fee_usd NUMERIC(18, 2) CHECK (fee_usd IS NULL OR fee_usd >= 0),
  crypto_quantity NUMERIC(24, 8) CHECK (crypto_quantity IS NULL OR crypto_quantity > 0),
  crypto_unit_price_usd NUMERIC(24, 8) CHECK (crypto_unit_price_usd IS NULL OR crypto_unit_price_usd > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'reversed')),
  reference_code TEXT,
  idempotency_key UUID NOT NULL,
  funding_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_fundings_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT business_fundings_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT business_fundings_source_account_owner_fkey
    FOREIGN KEY (source_account_id, user_id)
    REFERENCES public.business_accounts (id, user_id),
  CONSTRAINT business_fundings_destination_account_owner_fkey
    FOREIGN KEY (destination_account_id, user_id)
    REFERENCES public.business_accounts (id, user_id),
  CONSTRAINT business_fundings_distinct_accounts_check
    CHECK (source_account_id IS NULL OR source_account_id <> destination_account_id),
  CONSTRAINT business_fundings_source_amount_check
    CHECK (source_account_id IS NOT NULL OR source_amount IS NULL OR source_amount = 0)
);

CREATE UNIQUE INDEX business_fundings_reference_idx
  ON public.business_fundings (user_id, reference_code)
  WHERE reference_code IS NOT NULL AND length(trim(reference_code)) > 0;

CREATE TABLE public.business_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  paid_from_account_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (length(trim(category)) > 0),
  amount NUMERIC(24, 8) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z0-9]{3,8}$'),
  usd_exchange_rate NUMERIC(24, 8) CHECK (usd_exchange_rate IS NULL OR usd_exchange_rate > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'reversed')),
  idempotency_key UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_expenses_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT business_expenses_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT business_expenses_account_owner_fkey
    FOREIGN KEY (paid_from_account_id, user_id)
    REFERENCES public.business_accounts (id, user_id)
);

CREATE TABLE public.business_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z0-9]{3,8}$' AND currency <> 'USD'),
  usd_per_unit NUMERIC(24, 10) NOT NULL CHECK (usd_per_unit > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_exchange_rates_currency_date_unique UNIQUE (user_id, currency, effective_date)
);

CREATE TABLE public.business_account_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (length(trim(event_type)) > 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('opening', 'customer_transaction', 'funding', 'expense', 'adjustment', 'reversal')),
  source_id UUID NOT NULL,
  amount NUMERIC(24, 8) NOT NULL CHECK (amount <> 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_account_ledger_account_owner_fkey
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.business_accounts (id, user_id),
  CONSTRAINT business_account_ledger_event_unique
    UNIQUE (user_id, account_id, source_type, source_id, event_type)
);

CREATE TABLE public.business_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  amount NUMERIC(24, 8) NOT NULL CHECK (amount <> 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_adjustments_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT business_adjustments_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT business_adjustments_account_owner_fkey
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.business_accounts (id, user_id)
);

CREATE TABLE public.business_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX business_customer_transactions_customer_date_idx
  ON public.business_customer_transactions (user_id, customer_id, transaction_date DESC, status);
CREATE INDEX business_customers_user_name_idx
  ON public.business_customers (user_id, display_name);
CREATE INDEX business_accounts_user_name_idx
  ON public.business_accounts (user_id, name, currency);
CREATE INDEX business_customer_transactions_status_date_idx
  ON public.business_customer_transactions (user_id, status, transaction_date DESC);
CREATE INDEX business_fundings_date_idx
  ON public.business_fundings (user_id, funding_date DESC, status);
CREATE INDEX business_expenses_date_idx
  ON public.business_expenses (user_id, expense_date DESC, status);
CREATE INDEX business_account_ledger_account_date_idx
  ON public.business_account_ledger (user_id, account_id, created_at DESC);
CREATE INDEX business_audit_log_user_date_idx
  ON public.business_audit_log (user_id, created_at DESC);

CREATE FUNCTION public.validate_business_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Business records must belong to the authenticated user'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_customers_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_customers
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();
CREATE TRIGGER business_accounts_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_accounts
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();
CREATE TRIGGER business_customer_transactions_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_customer_transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();
CREATE TRIGGER business_fundings_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_fundings
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();
CREATE TRIGGER business_expenses_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();
CREATE TRIGGER business_exchange_rates_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();
CREATE TRIGGER business_account_ledger_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_account_ledger
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();
CREATE TRIGGER business_adjustments_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();
CREATE TRIGGER business_audit_log_validate_owner
  BEFORE INSERT OR UPDATE OF user_id ON public.business_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_business_owner();

CREATE FUNCTION public.prevent_business_account_financial_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.account_type IS DISTINCT FROM OLD.account_type
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.opening_balance IS DISTINCT FROM OLD.opening_balance THEN
    RAISE EXCEPTION 'Account ownership, type, currency, and opening balance are immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER business_accounts_financial_fields_immutable
  BEFORE UPDATE ON public.business_accounts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_account_financial_edits();

CREATE FUNCTION public.prevent_business_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Business ledger entries are immutable; use a reversal or adjustment'
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER business_account_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.business_account_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_ledger_mutation();
CREATE TRIGGER business_adjustments_immutable
  BEFORE UPDATE OR DELETE ON public.business_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_ledger_mutation();

CREATE FUNCTION public.business_account_balances()
RETURNS TABLE (
  id UUID,
  name TEXT,
  account_type TEXT,
  currency TEXT,
  opening_balance NUMERIC,
  balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT a.id, a.name, a.account_type, a.currency, a.opening_balance,
      a.opening_balance + COALESCE(sum(l.amount), 0) AS balance
    FROM public.business_accounts a
    LEFT JOIN public.business_account_ledger l
      ON l.account_id = a.id AND l.user_id = a.user_id
    WHERE a.user_id = auth.uid()
    GROUP BY a.id
    ORDER BY a.name;
END;
$$;

CREATE FUNCTION public.create_business_customer_transaction(
  p_idempotency_key UUID,
  p_customer_id UUID,
  p_receipt_account_id UUID,
  p_payout_account_id UUID,
  p_transaction_date TIMESTAMPTZ,
  p_htg_received NUMERIC,
  p_usd_sent NUMERIC,
  p_exchange_rate NUMERIC,
  p_service_fee_usd NUMERIC,
  p_crypto_cost_usd NUMERIC,
  p_transfer_fee_usd NUMERIC,
  p_other_expenses_usd NUMERIC,
  p_reference_code TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_htg_received <= 0 OR p_usd_sent <= 0 OR p_transfer_fee_usd < 0
    OR (p_exchange_rate IS NOT NULL AND p_exchange_rate <= 0)
    OR (p_service_fee_usd IS NOT NULL AND p_service_fee_usd < 0)
    OR (p_crypto_cost_usd IS NOT NULL AND p_crypto_cost_usd < 0)
    OR (p_other_expenses_usd IS NOT NULL AND p_other_expenses_usd < 0) THEN
    RAISE EXCEPTION 'Transaction amounts must be non-negative and exchange rate must be positive'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_accounts WHERE id = p_receipt_account_id AND user_id = v_user_id AND currency = 'HTG')
    OR NOT EXISTS (SELECT 1 FROM public.business_accounts WHERE id = p_payout_account_id AND user_id = v_user_id AND currency = 'USD') THEN
    RAISE EXCEPTION 'Choose an owned HTG receipt account and an owned USD payout account'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.business_customer_transactions (
    user_id, customer_id, receipt_account_id, payout_account_id, transaction_date,
    htg_received, usd_sent, exchange_rate, service_fee_usd, crypto_cost_usd,
    transfer_fee_usd, other_expenses_usd, reference_code, idempotency_key, notes
  ) VALUES (
    v_user_id, p_customer_id, p_receipt_account_id, p_payout_account_id, COALESCE(p_transaction_date, now()),
    p_htg_received, p_usd_sent, p_exchange_rate, p_service_fee_usd, p_crypto_cost_usd,
    p_transfer_fee_usd, p_other_expenses_usd, NULLIF(trim(p_reference_code), ''), p_idempotency_key, p_notes
  )
  ON CONFLICT (user_id, idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_id;

  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (v_user_id, 'customer_transaction', v_id, 'created', jsonb_build_object('status', 'pending'));
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.create_business_funding(
  p_idempotency_key UUID,
  p_funding_type TEXT,
  p_source_account_id UUID,
  p_destination_account_id UUID,
  p_source_amount NUMERIC,
  p_credited_amount NUMERIC,
  p_fee_amount NUMERIC,
  p_fee_usd NUMERIC,
  p_crypto_quantity NUMERIC,
  p_crypto_unit_price_usd NUMERIC,
  p_funding_date TIMESTAMPTZ,
  p_reference_code TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_funding_type NOT IN ('replenishment', 'crypto_purchase', 'crypto_transfer', 'asset_transfer')
    OR p_credited_amount <= 0 OR COALESCE(p_source_amount, 0) < 0 OR p_fee_amount < 0
    OR (p_fee_usd IS NOT NULL AND p_fee_usd < 0)
    OR (p_crypto_quantity IS NOT NULL AND p_crypto_quantity <= 0)
    OR (p_crypto_unit_price_usd IS NOT NULL AND p_crypto_unit_price_usd <= 0) THEN
    RAISE EXCEPTION 'Invalid funding amounts or type' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_accounts WHERE id = p_destination_account_id AND user_id = v_user_id)
    OR (p_source_account_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.business_accounts WHERE id = p_source_account_id AND user_id = v_user_id
    )) THEN
    RAISE EXCEPTION 'Funding accounts must belong to the authenticated user' USING ERRCODE = '23514';
  END IF;
  IF p_funding_type = 'replenishment' AND (
    p_source_account_id IS NOT NULL
    OR p_fee_amount <> 0
    OR NOT EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = p_destination_account_id AND user_id = v_user_id
        AND account_type = 'meru' AND currency = 'USD'
    )
  ) THEN
    RAISE EXCEPTION 'External replenishments must credit an owned USD Meru account'
      USING ERRCODE = '23514';
  ELSIF p_funding_type = 'crypto_purchase' AND (
    p_source_account_id IS NULL
    OR p_crypto_quantity IS NULL
    OR p_crypto_unit_price_usd IS NULL
    OR p_source_amount IS NULL
    OR p_source_amount < p_crypto_quantity * p_crypto_unit_price_usd
    OR p_credited_amount IS DISTINCT FROM p_crypto_quantity
    OR NOT EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = p_source_account_id AND user_id = v_user_id AND currency = 'USD'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = p_destination_account_id AND user_id = v_user_id AND account_type = 'crypto'
    )
  ) THEN
    RAISE EXCEPTION 'Crypto purchases require a USD source, crypto destination, quantity, and unit price'
      USING ERRCODE = '23514';
  ELSIF p_funding_type = 'crypto_transfer' AND (
    p_source_account_id IS NULL
    OR p_crypto_quantity IS NULL
    OR p_crypto_unit_price_usd IS NULL
    OR p_source_amount IS DISTINCT FROM p_crypto_quantity
    OR p_credited_amount > p_crypto_quantity * p_crypto_unit_price_usd
    OR NOT EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = p_source_account_id AND user_id = v_user_id AND account_type = 'crypto'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.business_accounts
      WHERE id = p_destination_account_id AND user_id = v_user_id
        AND account_type = 'meru' AND currency = 'USD'
    )
  ) THEN
    RAISE EXCEPTION 'Crypto wallet funding requires a crypto source and USD Meru destination'
      USING ERRCODE = '23514';
  ELSIF p_funding_type = 'asset_transfer' AND (
    p_source_account_id IS NULL
    OR p_source_amount IS NULL
    OR p_source_amount <> p_credited_amount
    OR NOT EXISTS (
      SELECT 1
      FROM public.business_accounts source_account
      JOIN public.business_accounts destination_account
        ON destination_account.id = p_destination_account_id
       AND destination_account.user_id = v_user_id
      WHERE source_account.id = p_source_account_id
        AND source_account.user_id = v_user_id
        AND source_account.currency = destination_account.currency
    )
  ) THEN
    RAISE EXCEPTION 'Internal asset transfers require equal amounts in the same currency'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.business_fundings (
    user_id, funding_type, source_account_id, destination_account_id, source_amount, credited_amount,
    fee_amount, fee_usd, crypto_quantity, crypto_unit_price_usd, funding_date, reference_code,
    idempotency_key, notes
  ) VALUES (
    v_user_id, p_funding_type, p_source_account_id, p_destination_account_id, p_source_amount,
    p_credited_amount, p_fee_amount, p_fee_usd, p_crypto_quantity, p_crypto_unit_price_usd,
    COALESCE(p_funding_date, now()), NULLIF(trim(p_reference_code), ''), p_idempotency_key, p_notes
  )
  ON CONFLICT (user_id, idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_id;
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (v_user_id, 'funding', v_id, 'created', jsonb_build_object('status', 'pending'));
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.create_business_expense(
  p_idempotency_key UUID,
  p_paid_from_account_id UUID,
  p_category TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_usd_exchange_rate NUMERIC,
  p_expense_date DATE,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_amount <= 0 OR length(trim(p_category)) = 0
    OR (p_usd_exchange_rate IS NOT NULL AND p_usd_exchange_rate <= 0) THEN
    RAISE EXCEPTION 'Expense amount and category are required; rate must be positive'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE id = p_paid_from_account_id AND user_id = v_user_id AND currency = p_currency
  ) THEN
    RAISE EXCEPTION 'Expense currency must match an owned payment account' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.business_expenses (
    user_id, paid_from_account_id, category, amount, currency, usd_exchange_rate,
    expense_date, idempotency_key, notes
  ) VALUES (
    v_user_id, p_paid_from_account_id, trim(p_category), p_amount, p_currency, p_usd_exchange_rate,
    COALESCE(p_expense_date, CURRENT_DATE), p_idempotency_key, p_notes
  )
  ON CONFLICT (user_id, idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
  RETURNING id INTO v_id;
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (v_user_id, 'expense', v_id, 'created', jsonb_build_object('status', 'pending'));
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.create_business_adjustment(
  p_idempotency_key UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
  v_balance NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_amount = 0 OR p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Adjustment requires a non-zero amount and a reason' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.business_adjustments (user_id, account_id, amount, reason, idempotency_key)
  VALUES (v_user_id, p_account_id, p_amount, trim(p_reason), p_idempotency_key)
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.business_adjustments
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
    RETURN v_id;
  END IF;

  PERFORM 1 FROM public.business_accounts
  WHERE id = p_account_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found or not owned' USING ERRCODE = '23514'; END IF;
  SELECT opening_balance + COALESCE((
    SELECT sum(amount) FROM public.business_account_ledger
    WHERE account_id = p_account_id AND user_id = v_user_id
  ), 0) INTO v_balance
  FROM public.business_accounts WHERE id = p_account_id AND user_id = v_user_id;
  IF v_balance + p_amount < 0 THEN RAISE EXCEPTION 'Adjustment would make the account balance negative'; END IF;
  INSERT INTO public.business_account_ledger (
    user_id, account_id, event_type, source_type, source_id, amount, notes
  ) VALUES (
    v_user_id, p_account_id,
    CASE WHEN p_amount > 0 THEN 'adjustment_credit' ELSE 'adjustment_debit' END,
    'adjustment', v_id, p_amount, trim(p_reason)
  );
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (v_user_id, 'adjustment', v_id, 'created', jsonb_build_object('account_id', p_account_id, 'amount', p_amount, 'reason', trim(p_reason)));
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.complete_business_operation(p_operation_type TEXT, p_operation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status TEXT;
  v_receipt_account UUID;
  v_payout_account UUID;
  v_source_account UUID;
  v_destination_account UUID;
  v_payment_account UUID;
  v_htg NUMERIC;
  v_usd NUMERIC;
  v_transfer_fee NUMERIC;
  v_source_amount NUMERIC;
  v_credited_amount NUMERIC;
  v_funding_fee NUMERIC;
  v_expense_amount NUMERIC;
  v_accounts UUID[];
  v_account_id UUID;
  v_required NUMERIC;
  v_balance NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;

  IF p_operation_type = 'customer_transaction' THEN
    SELECT status, receipt_account_id, payout_account_id, htg_received, usd_sent, transfer_fee_usd
    INTO v_status, v_receipt_account, v_payout_account, v_htg, v_usd, v_transfer_fee
    FROM public.business_customer_transactions
    WHERE id = p_operation_id AND user_id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer transaction not found' USING ERRCODE = 'P0002'; END IF;
    v_accounts := ARRAY[v_receipt_account, v_payout_account];
  ELSIF p_operation_type = 'funding' THEN
    SELECT status, source_account_id, destination_account_id, source_amount, credited_amount, fee_amount
    INTO v_status, v_source_account, v_destination_account, v_source_amount, v_credited_amount, v_funding_fee
    FROM public.business_fundings
    WHERE id = p_operation_id AND user_id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Funding record not found' USING ERRCODE = 'P0002'; END IF;
    v_accounts := ARRAY[v_source_account, v_destination_account];
  ELSIF p_operation_type = 'expense' THEN
    SELECT status, paid_from_account_id, amount
    INTO v_status, v_payment_account, v_expense_amount
    FROM public.business_expenses
    WHERE id = p_operation_id AND user_id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Expense record not found' USING ERRCODE = 'P0002'; END IF;
    v_accounts := ARRAY[v_payment_account];
  ELSE
    RAISE EXCEPTION 'Unsupported business operation type' USING ERRCODE = '22023';
  END IF;

  IF v_status = 'completed' THEN RETURN; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'Only pending operations can be completed' USING ERRCODE = '23514'; END IF;

  FOR v_account_id IN
    SELECT DISTINCT account_ids.account_id
    FROM unnest(v_accounts) AS account_ids(account_id)
    WHERE account_ids.account_id IS NOT NULL
    ORDER BY account_ids.account_id
  LOOP
    PERFORM 1 FROM public.business_accounts
    WHERE id = v_account_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found or not owned' USING ERRCODE = '23514'; END IF;
  END LOOP;

  IF p_operation_type = 'customer_transaction' THEN
    IF v_receipt_account = v_payout_account THEN RAISE EXCEPTION 'Receipt and payout accounts must differ'; END IF;
    SELECT opening_balance + COALESCE((SELECT sum(amount) FROM public.business_account_ledger WHERE account_id = v_payout_account AND user_id = v_user_id), 0)
    INTO v_balance FROM public.business_accounts WHERE id = v_payout_account AND user_id = v_user_id;
    v_required := v_usd + v_transfer_fee;
    IF v_balance < v_required THEN RAISE EXCEPTION 'Insufficient payout account balance'; END IF;

    INSERT INTO public.business_account_ledger (user_id, account_id, event_type, source_type, source_id, amount, notes)
    VALUES
      (v_user_id, v_receipt_account, 'customer_receipt', 'customer_transaction', p_operation_id, v_htg, 'Customer HTG received'),
      (v_user_id, v_payout_account, 'customer_transfer', 'customer_transaction', p_operation_id, -v_usd, 'USD sent to customer');
    IF v_transfer_fee > 0 THEN
      INSERT INTO public.business_account_ledger (user_id, account_id, event_type, source_type, source_id, amount, notes)
      VALUES (v_user_id, v_payout_account, 'transfer_fee', 'customer_transaction', p_operation_id, -v_transfer_fee, 'Customer transfer fee');
    END IF;
    UPDATE public.business_customer_transactions SET status = 'completed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  ELSIF p_operation_type = 'funding' THEN
    IF v_source_account IS NOT NULL THEN
      SELECT opening_balance + COALESCE((SELECT sum(amount) FROM public.business_account_ledger WHERE account_id = v_source_account AND user_id = v_user_id), 0)
      INTO v_balance FROM public.business_accounts WHERE id = v_source_account AND user_id = v_user_id;
      v_required := COALESCE(v_source_amount, 0) + v_funding_fee;
      IF v_balance < v_required THEN RAISE EXCEPTION 'Insufficient funding source balance'; END IF;
      IF COALESCE(v_source_amount, 0) > 0 THEN
        INSERT INTO public.business_account_ledger (user_id, account_id, event_type, source_type, source_id, amount, notes)
        VALUES (v_user_id, v_source_account, 'asset_transfer', 'funding', p_operation_id, -v_source_amount, 'Business asset transfer');
      END IF;
      IF v_funding_fee > 0 THEN
        INSERT INTO public.business_account_ledger (user_id, account_id, event_type, source_type, source_id, amount, notes)
        VALUES (v_user_id, v_source_account, 'funding_fee', 'funding', p_operation_id, -v_funding_fee, 'Funding fee');
      END IF;
      INSERT INTO public.business_account_ledger (user_id, account_id, event_type, source_type, source_id, amount, notes)
      VALUES (v_user_id, v_destination_account, 'funding_credit', 'funding', p_operation_id, v_credited_amount, 'Actual amount credited');
    ELSE
      INSERT INTO public.business_account_ledger (user_id, account_id, event_type, source_type, source_id, amount, notes)
      VALUES (v_user_id, v_destination_account, 'external_funding_credit', 'funding', p_operation_id, v_credited_amount, 'External funds credited');
    END IF;
    UPDATE public.business_fundings SET status = 'completed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  ELSE
    SELECT opening_balance + COALESCE((SELECT sum(amount) FROM public.business_account_ledger WHERE account_id = v_payment_account AND user_id = v_user_id), 0)
    INTO v_balance FROM public.business_accounts WHERE id = v_payment_account AND user_id = v_user_id;
    IF v_balance < v_expense_amount THEN RAISE EXCEPTION 'Insufficient expense account balance'; END IF;
    INSERT INTO public.business_account_ledger (user_id, account_id, event_type, source_type, source_id, amount, notes)
    VALUES (v_user_id, v_payment_account, 'business_expense', 'expense', p_operation_id, -v_expense_amount, 'Business expense')
    ON CONFLICT DO NOTHING;
    UPDATE public.business_expenses SET status = 'completed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  END IF;

  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (v_user_id, p_operation_type, p_operation_id, 'completed', jsonb_build_object('previous_status', 'pending', 'status', 'completed'));
END;
$$;

CREATE FUNCTION public.close_business_operation(p_operation_type TEXT, p_operation_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_old_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('failed', 'cancelled') THEN RAISE EXCEPTION 'Only failed or cancelled status is accepted'; END IF;
  IF p_operation_type = 'customer_transaction' THEN
    UPDATE public.business_customer_transactions SET status = p_status, updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id AND status = 'pending' RETURNING 'pending' INTO v_old_status;
  ELSIF p_operation_type = 'funding' THEN
    UPDATE public.business_fundings SET status = p_status, updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id AND status = 'pending' RETURNING 'pending' INTO v_old_status;
  ELSIF p_operation_type = 'expense' THEN
    UPDATE public.business_expenses SET status = p_status, updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id AND status = 'pending' RETURNING 'pending' INTO v_old_status;
  ELSE
    RAISE EXCEPTION 'Unsupported business operation type' USING ERRCODE = '22023';
  END IF;
  IF v_old_status IS NULL THEN RAISE EXCEPTION 'Only a pending operation can be closed'; END IF;
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (v_user_id, p_operation_type, p_operation_id, p_status, jsonb_build_object('previous_status', v_old_status, 'status', p_status));
END;
$$;

CREATE FUNCTION public.reverse_business_operation(p_operation_type TEXT, p_operation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status TEXT;
  v_accounts UUID[];
  v_account_id UUID;
  v_entry RECORD;
  v_balance NUMERIC;
  v_operation_net NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_operation_type = 'customer_transaction' THEN
    SELECT status INTO v_status FROM public.business_customer_transactions
    WHERE id = p_operation_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_operation_type = 'funding' THEN
    SELECT status INTO v_status FROM public.business_fundings
    WHERE id = p_operation_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_operation_type = 'expense' THEN
    SELECT status INTO v_status FROM public.business_expenses
    WHERE id = p_operation_id AND user_id = v_user_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unsupported business operation type' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'reversed' THEN RETURN; END IF;
  IF v_status IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Only completed operations can be reversed'; END IF;

  SELECT array_agg(DISTINCT account_id ORDER BY account_id) INTO v_accounts
  FROM public.business_account_ledger
  WHERE user_id = v_user_id AND source_type = p_operation_type AND source_id = p_operation_id;
  IF v_accounts IS NULL THEN RAISE EXCEPTION 'Completed operation has no ledger entries'; END IF;
  FOREACH v_account_id IN ARRAY v_accounts LOOP
    PERFORM 1 FROM public.business_accounts WHERE id = v_account_id AND user_id = v_user_id FOR UPDATE;
  END LOOP;

  FOR v_entry IN
    SELECT account_id, event_type, amount FROM public.business_account_ledger
    WHERE user_id = v_user_id AND source_type = p_operation_type AND source_id = p_operation_id
  LOOP
    SELECT sum(amount) INTO v_operation_net
    FROM public.business_account_ledger
    WHERE user_id = v_user_id AND source_type = p_operation_type
      AND source_id = p_operation_id AND account_id = v_entry.account_id;
    IF v_operation_net > 0 THEN
      SELECT opening_balance + COALESCE((SELECT sum(amount) FROM public.business_account_ledger WHERE account_id = v_entry.account_id AND user_id = v_user_id), 0)
      INTO v_balance FROM public.business_accounts WHERE id = v_entry.account_id AND user_id = v_user_id;
      IF v_balance < v_operation_net THEN
        RAISE EXCEPTION 'Reversal would make an account balance negative';
      END IF;
    END IF;
    INSERT INTO public.business_account_ledger (user_id, account_id, event_type, source_type, source_id, amount, notes)
    VALUES (v_user_id, v_entry.account_id, 'reversal_' || v_entry.event_type, 'reversal', p_operation_id, -v_entry.amount, 'Reversal of ' || p_operation_type);
  END LOOP;

  IF p_operation_type = 'customer_transaction' THEN
    UPDATE public.business_customer_transactions SET status = 'reversed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  ELSIF p_operation_type = 'funding' THEN
    UPDATE public.business_fundings SET status = 'reversed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  ELSE
    UPDATE public.business_expenses SET status = 'reversed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  END IF;
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (v_user_id, p_operation_type, p_operation_id, 'reversed', jsonb_build_object('previous_status', 'completed', 'status', 'reversed'));
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.business_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.business_accounts TO authenticated;
GRANT SELECT ON public.business_customer_transactions, public.business_fundings,
  public.business_expenses, public.business_exchange_rates, public.business_account_ledger,
  public.business_adjustments, public.business_audit_log TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_exchange_rates TO authenticated;
GRANT ALL ON public.business_customers, public.business_accounts, public.business_customer_transactions,
  public.business_fundings, public.business_expenses, public.business_exchange_rates,
  public.business_account_ledger, public.business_adjustments, public.business_audit_log TO service_role;

ALTER TABLE public.business_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_customer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_fundings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_account_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own business customers" ON public.business_customers
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage their own business accounts" ON public.business_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read their own business transactions" ON public.business_customer_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read their own business funding" ON public.business_fundings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read their own business expenses" ON public.business_expenses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own business exchange rates" ON public.business_exchange_rates
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read their own business ledger" ON public.business_account_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read their own business adjustments" ON public.business_adjustments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read their own business audit log" ON public.business_audit_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON FUNCTION public.business_account_balances() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_business_customer_transaction(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_business_funding(UUID, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_business_expense(UUID, UUID, TEXT, NUMERIC, TEXT, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_business_adjustment(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_business_operation(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_business_operation(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_business_operation(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_account_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_customer_transaction(UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_funding(UUID, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_expense(UUID, UUID, TEXT, NUMERIC, TEXT, NUMERIC, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_adjustment(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_business_operation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_business_operation(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_business_operation(TEXT, UUID) TO authenticated;

CREATE TRIGGER business_customers_set_updated_at
  BEFORE UPDATE ON public.business_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER business_accounts_set_updated_at
  BEFORE UPDATE ON public.business_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER business_customer_transactions_set_updated_at
  BEFORE UPDATE ON public.business_customer_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER business_fundings_set_updated_at
  BEFORE UPDATE ON public.business_fundings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER business_expenses_set_updated_at
  BEFORE UPDATE ON public.business_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
