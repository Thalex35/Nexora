ALTER TABLE public.business_customer_transactions
  ADD COLUMN due_date DATE;

ALTER TABLE public.business_account_ledger
  DROP CONSTRAINT business_account_ledger_source_type_check;

ALTER TABLE public.business_account_ledger
  ADD CONSTRAINT business_account_ledger_source_type_check
  CHECK (source_type IN (
    'opening',
    'customer_transaction',
    'customer_payment',
    'funding',
    'expense',
    'adjustment',
    'loan',
    'loan_repayment',
    'reversal'
  ));

CREATE TABLE public.business_customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_transaction_id UUID NOT NULL,
  account_id UUID NOT NULL,
  amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency = 'HTG'),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'moncash', 'natcash', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_customer_payments_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT business_customer_payments_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT business_customer_payments_transaction_owner_fkey
    FOREIGN KEY (customer_transaction_id, user_id)
    REFERENCES public.business_customer_transactions (id, user_id),
  CONSTRAINT business_customer_payments_account_owner_fkey
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.business_accounts (id, user_id)
);

CREATE INDEX business_customer_payments_transaction_date_idx
  ON public.business_customer_payments (user_id, customer_transaction_id, payment_date);

CREATE FUNCTION public.prevent_closing_business_transaction_with_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('failed', 'cancelled', 'reversed')
    AND OLD.status IS DISTINCT FROM NEW.status
    AND EXISTS (
      SELECT 1
      FROM public.business_customer_payments
      WHERE customer_transaction_id = OLD.id AND user_id = OLD.user_id
    ) THEN
    RAISE EXCEPTION 'Customer payments must be reversed before closing this transaction'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_customer_transaction_payment_guard
  BEFORE UPDATE OF status ON public.business_customer_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_closing_business_transaction_with_payments();

INSERT INTO public.business_customer_payments (
  user_id,
  customer_transaction_id,
  account_id,
  amount,
  currency,
  payment_method,
  payment_date,
  reference,
  notes,
  idempotency_key
)
SELECT
  ledger.user_id,
  transaction.id,
  ledger.account_id,
  ledger.amount,
  account.currency,
  'other',
  ledger.created_at::date,
  transaction.reference_code,
  'Migrated from the immutable legacy customer receipt ledger entry',
  gen_random_uuid()
FROM public.business_account_ledger AS ledger
JOIN public.business_customer_transactions AS transaction
  ON transaction.id = ledger.source_id AND transaction.user_id = ledger.user_id
JOIN public.business_accounts AS account
  ON account.id = ledger.account_id AND account.user_id = ledger.user_id
WHERE ledger.source_type = 'customer_transaction'
  AND ledger.event_type = 'customer_receipt'
  AND ledger.amount > 0
  AND transaction.status = 'completed'
  AND account.currency = 'HTG';

CREATE TABLE public.business_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  account_id UUID NOT NULL,
  principal_amount NUMERIC(24, 8) NOT NULL CHECK (principal_amount > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z0-9]{3,8}$'),
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  interest_amount NUMERIC(24, 8) NOT NULL DEFAULT 0 CHECK (interest_amount >= 0),
  fee_amount NUMERIC(24, 8) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'partially_repaid', 'repaid', 'overdue')),
  notes TEXT,
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_loans_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT business_loans_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT business_loans_customer_owner_fkey
    FOREIGN KEY (customer_id, user_id)
    REFERENCES public.business_customers (id, user_id),
  CONSTRAINT business_loans_account_owner_fkey
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.business_accounts (id, user_id)
);

CREATE INDEX business_loans_customer_due_idx
  ON public.business_loans (user_id, customer_id, due_date)
  WHERE status IN ('active', 'partially_repaid', 'overdue');

CREATE TABLE public.business_loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  loan_id UUID NOT NULL,
  account_id UUID NOT NULL,
  amount NUMERIC(24, 8) NOT NULL CHECK (amount > 0),
  principal_paid NUMERIC(24, 8) NOT NULL CHECK (principal_paid >= 0),
  interest_paid NUMERIC(24, 8) NOT NULL CHECK (interest_paid >= 0),
  fee_paid NUMERIC(24, 8) NOT NULL CHECK (fee_paid >= 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z0-9]{3,8}$'),
  repayment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_loan_repayments_components_check
    CHECK (amount = principal_paid + interest_paid + fee_paid),
  CONSTRAINT business_loan_repayments_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT business_loan_repayments_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT business_loan_repayments_loan_owner_fkey
    FOREIGN KEY (loan_id, user_id)
    REFERENCES public.business_loans (id, user_id),
  CONSTRAINT business_loan_repayments_account_owner_fkey
    FOREIGN KEY (account_id, user_id)
    REFERENCES public.business_accounts (id, user_id)
);

CREATE INDEX business_loan_repayments_loan_date_idx
  ON public.business_loan_repayments (user_id, loan_id, repayment_date);

CREATE FUNCTION public.prevent_business_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Business payments and repayments are immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER business_customer_payments_immutable
  BEFORE UPDATE OR DELETE ON public.business_customer_payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_payment_mutation();
CREATE TRIGGER business_loan_repayments_immutable
  BEFORE UPDATE OR DELETE ON public.business_loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_payment_mutation();

CREATE FUNCTION public.prevent_business_loan_term_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.account_id IS DISTINCT FROM OLD.account_id
    OR NEW.principal_amount IS DISTINCT FROM OLD.principal_amount
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.issued_date IS DISTINCT FROM OLD.issued_date
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.interest_amount IS DISTINCT FROM OLD.interest_amount
    OR NEW.fee_amount IS DISTINCT FROM OLD.fee_amount
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Loan terms are immutable; use a repayment record'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.status NOT IN ('active', 'partially_repaid', 'repaid', 'overdue') THEN
    RAISE EXCEPTION 'Invalid loan status' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_loan_terms_immutable
  BEFORE UPDATE ON public.business_loans
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_loan_term_edits();
CREATE TRIGGER business_loans_immutable
  BEFORE DELETE ON public.business_loans
  FOR EACH ROW EXECUTE FUNCTION public.prevent_business_payment_mutation();

CREATE FUNCTION public.create_business_customer_transaction_with_due_date(
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
  p_notes TEXT,
  p_due_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_id UUID;
  v_existing public.business_customer_transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_idempotency_key::text));
  SELECT * INTO v_existing
  FROM public.business_customer_transactions
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM p_customer_id
      OR v_existing.receipt_account_id IS DISTINCT FROM p_receipt_account_id
      OR v_existing.payout_account_id IS DISTINCT FROM p_payout_account_id
      OR v_existing.transaction_date IS DISTINCT FROM p_transaction_date
      OR v_existing.htg_received IS DISTINCT FROM p_htg_received
      OR v_existing.usd_sent IS DISTINCT FROM p_usd_sent
      OR v_existing.exchange_rate IS DISTINCT FROM p_exchange_rate
      OR v_existing.service_fee_usd IS DISTINCT FROM p_service_fee_usd
      OR v_existing.crypto_cost_usd IS DISTINCT FROM p_crypto_cost_usd
      OR v_existing.transfer_fee_usd IS DISTINCT FROM p_transfer_fee_usd
      OR v_existing.other_expenses_usd IS DISTINCT FROM p_other_expenses_usd
      OR v_existing.reference_code IS DISTINCT FROM NULLIF(trim(p_reference_code), '')
      OR v_existing.notes IS DISTINCT FROM p_notes
      OR v_existing.due_date IS DISTINCT FROM p_due_date THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different transaction'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.id;
  END IF;

  v_id := public.create_business_customer_transaction(
    p_idempotency_key,
    p_customer_id,
    p_receipt_account_id,
    p_payout_account_id,
    p_transaction_date,
    p_htg_received,
    p_usd_sent,
    p_exchange_rate,
    p_service_fee_usd,
    p_crypto_cost_usd,
    p_transfer_fee_usd,
    p_other_expenses_usd,
    p_reference_code,
    p_notes
  );
  UPDATE public.business_customer_transactions
  SET due_date = p_due_date, updated_at = now()
  WHERE id = v_id AND user_id = v_user_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.create_business_customer_payment(
  p_idempotency_key UUID,
  p_customer_transaction_id UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_payment_method TEXT,
  p_payment_date DATE,
  p_reference TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status TEXT;
  v_due NUMERIC;
  v_paid NUMERIC;
  v_payment_id UUID;
  v_existing public.business_customer_payments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_amount <= 0 OR p_currency <> 'HTG'
    OR p_payment_method NOT IN ('cash', 'moncash', 'natcash', 'other') THEN
    RAISE EXCEPTION 'Invalid customer payment details' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_idempotency_key::text));
  SELECT * INTO v_existing FROM public.business_customer_payments
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.customer_transaction_id IS DISTINCT FROM p_customer_transaction_id
      OR v_existing.account_id IS DISTINCT FROM p_account_id
      OR v_existing.amount IS DISTINCT FROM p_amount
      OR v_existing.currency IS DISTINCT FROM p_currency
      OR v_existing.payment_method IS DISTINCT FROM p_payment_method
      OR v_existing.payment_date IS DISTINCT FROM COALESCE(p_payment_date, CURRENT_DATE)
      OR v_existing.reference IS DISTINCT FROM NULLIF(trim(p_reference), '')
      OR v_existing.notes IS DISTINCT FROM NULLIF(trim(p_notes), '') THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different payment'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.id;
  END IF;

  SELECT status, htg_received INTO v_status, v_due
  FROM public.business_customer_transactions
  WHERE id = p_customer_transaction_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer transaction not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status IN ('failed', 'cancelled', 'reversed') THEN
    RAISE EXCEPTION 'Payments cannot be added to a closed customer transaction'
      USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM public.business_accounts
  WHERE id = p_account_id AND user_id = v_user_id AND currency = p_currency
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an owned account in the payment currency' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(sum(amount), 0) INTO v_paid
  FROM public.business_customer_payments
  WHERE customer_transaction_id = p_customer_transaction_id AND user_id = v_user_id;
  IF v_paid + p_amount > v_due THEN
    RAISE EXCEPTION 'Payment exceeds the outstanding customer balance' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.business_customer_payments (
    user_id, customer_transaction_id, account_id, amount, currency, payment_method,
    payment_date, reference, notes, idempotency_key
  ) VALUES (
    v_user_id, p_customer_transaction_id, p_account_id, p_amount, p_currency, p_payment_method,
    COALESCE(p_payment_date, CURRENT_DATE), NULLIF(trim(p_reference), ''),
    NULLIF(trim(p_notes), ''), p_idempotency_key
  ) RETURNING id INTO v_payment_id;
  INSERT INTO public.business_account_ledger (
    user_id, account_id, event_type, source_type, source_id, amount, notes
  ) VALUES (
    v_user_id, p_account_id, 'customer_payment_received', 'customer_payment',
    v_payment_id, p_amount, 'Customer payment collected'
  );
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id, 'customer_payment', v_payment_id, 'created',
    jsonb_build_object('customer_transaction_id', p_customer_transaction_id, 'amount', p_amount, 'currency', p_currency)
  );
  RETURN v_payment_id;
END;
$$;

CREATE FUNCTION public.create_business_loan(
  p_idempotency_key UUID,
  p_customer_id UUID,
  p_account_id UUID,
  p_principal_amount NUMERIC,
  p_currency TEXT,
  p_issued_date DATE,
  p_due_date DATE,
  p_interest_amount NUMERIC,
  p_fee_amount NUMERIC,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_loan_id UUID;
  v_existing public.business_loans%ROWTYPE;
  v_balance NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_principal_amount <= 0 OR COALESCE(p_interest_amount, 0) < 0
    OR COALESCE(p_fee_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Loan principal must be positive and interest/fees non-negative'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_idempotency_key::text));
  SELECT * INTO v_existing FROM public.business_loans
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM p_customer_id
      OR v_existing.account_id IS DISTINCT FROM p_account_id
      OR v_existing.principal_amount IS DISTINCT FROM p_principal_amount
      OR v_existing.currency IS DISTINCT FROM p_currency
      OR v_existing.issued_date IS DISTINCT FROM COALESCE(p_issued_date, CURRENT_DATE)
      OR v_existing.due_date IS DISTINCT FROM p_due_date
      OR v_existing.interest_amount IS DISTINCT FROM COALESCE(p_interest_amount, 0)
      OR v_existing.fee_amount IS DISTINCT FROM COALESCE(p_fee_amount, 0)
      OR v_existing.notes IS DISTINCT FROM NULLIF(trim(p_notes), '') THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different loan'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.id;
  END IF;

  PERFORM 1
  FROM public.business_accounts
  WHERE id = p_account_id AND user_id = v_user_id AND currency = p_currency
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an owned disbursement account in the loan currency'
      USING ERRCODE = '23514';
  END IF;
  SELECT a.opening_balance + COALESCE(sum(l.amount), 0)
  INTO v_balance
  FROM public.business_accounts AS a
  LEFT JOIN public.business_account_ledger AS l
    ON l.account_id = a.id AND l.user_id = a.user_id
  WHERE a.id = p_account_id AND a.user_id = v_user_id AND a.currency = p_currency
  GROUP BY a.id;
  IF v_balance < p_principal_amount THEN
    RAISE EXCEPTION 'Insufficient account balance to issue this loan' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.business_loans (
    user_id, customer_id, account_id, principal_amount, currency, issued_date,
    due_date, interest_amount, fee_amount, status, notes, idempotency_key
  ) VALUES (
    v_user_id, p_customer_id, p_account_id, p_principal_amount, p_currency,
    COALESCE(p_issued_date, CURRENT_DATE), p_due_date,
    COALESCE(p_interest_amount, 0), COALESCE(p_fee_amount, 0),
    CASE WHEN p_due_date < CURRENT_DATE THEN 'overdue' ELSE 'active' END,
    NULLIF(trim(p_notes), ''), p_idempotency_key
  ) RETURNING id INTO v_loan_id;
  INSERT INTO public.business_account_ledger (
    user_id, account_id, event_type, source_type, source_id, amount, notes
  ) VALUES (
    v_user_id, p_account_id, 'loan_principal_disbursed', 'loan',
    v_loan_id, -p_principal_amount, 'Loan principal issued'
  );
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id, 'loan', v_loan_id, 'issued',
    jsonb_build_object('principal_amount', p_principal_amount, 'currency', p_currency)
  );
  RETURN v_loan_id;
END;
$$;

CREATE FUNCTION public.create_business_loan_repayment(
  p_idempotency_key UUID,
  p_loan_id UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_repayment_date DATE,
  p_reference TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_loan public.business_loans%ROWTYPE;
  v_existing public.business_loan_repayments%ROWTYPE;
  v_repayment_id UUID;
  v_principal_due NUMERIC;
  v_interest_due NUMERIC;
  v_fee_due NUMERIC;
  v_interest_paid NUMERIC;
  v_fee_paid NUMERIC;
  v_principal_paid NUMERIC;
  v_remaining NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Repayment amount must be positive' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_idempotency_key::text));
  SELECT * INTO v_existing FROM public.business_loan_repayments
  WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.loan_id IS DISTINCT FROM p_loan_id
      OR v_existing.account_id IS DISTINCT FROM p_account_id
      OR v_existing.amount IS DISTINCT FROM p_amount
      OR v_existing.currency IS DISTINCT FROM p_currency
      OR v_existing.repayment_date IS DISTINCT FROM COALESCE(p_repayment_date, CURRENT_DATE)
      OR v_existing.reference IS DISTINCT FROM NULLIF(trim(p_reference), '')
      OR v_existing.notes IS DISTINCT FROM NULLIF(trim(p_notes), '') THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different repayment'
        USING ERRCODE = '23505';
    END IF;
    RETURN v_existing.id;
  END IF;

  SELECT * INTO v_loan FROM public.business_loans
  WHERE id = p_loan_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_loan.status = 'repaid' THEN
    RAISE EXCEPTION 'This loan has already been repaid' USING ERRCODE = '23514';
  END IF;
  IF p_currency <> v_loan.currency THEN
    RAISE EXCEPTION 'Repayment currency must match the loan currency' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.business_accounts
  WHERE id = p_account_id AND user_id = v_user_id AND currency = p_currency
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose an owned repayment account in the loan currency'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    v_loan.principal_amount - COALESCE(sum(principal_paid), 0),
    v_loan.interest_amount - COALESCE(sum(interest_paid), 0),
    v_loan.fee_amount - COALESCE(sum(fee_paid), 0)
  INTO v_principal_due, v_interest_due, v_fee_due
  FROM public.business_loan_repayments
  WHERE loan_id = p_loan_id AND user_id = v_user_id;
  IF p_amount > v_principal_due + v_interest_due + v_fee_due THEN
    RAISE EXCEPTION 'Repayment exceeds the remaining principal, interest, and fees'
      USING ERRCODE = '23514';
  END IF;

  v_remaining := p_amount;
  v_interest_paid := LEAST(v_remaining, v_interest_due);
  v_remaining := v_remaining - v_interest_paid;
  v_fee_paid := LEAST(v_remaining, v_fee_due);
  v_remaining := v_remaining - v_fee_paid;
  v_principal_paid := v_remaining;

  INSERT INTO public.business_loan_repayments (
    user_id, loan_id, account_id, amount, principal_paid, interest_paid, fee_paid,
    currency, repayment_date, reference, notes, idempotency_key
  ) VALUES (
    v_user_id, p_loan_id, p_account_id, p_amount, v_principal_paid,
    v_interest_paid, v_fee_paid, p_currency, COALESCE(p_repayment_date, CURRENT_DATE),
    NULLIF(trim(p_reference), ''), NULLIF(trim(p_notes), ''), p_idempotency_key
  ) RETURNING id INTO v_repayment_id;

  IF v_principal_paid > 0 THEN
    INSERT INTO public.business_account_ledger (
      user_id, account_id, event_type, source_type, source_id, amount, notes
    ) VALUES (
      v_user_id, p_account_id, 'loan_principal_repayment', 'loan_repayment',
      v_repayment_id, v_principal_paid, 'Loan principal repaid'
    );
  END IF;
  IF v_interest_paid > 0 THEN
    INSERT INTO public.business_account_ledger (
      user_id, account_id, event_type, source_type, source_id, amount, notes
    ) VALUES (
      v_user_id, p_account_id, 'loan_interest_income', 'loan_repayment',
      v_repayment_id, v_interest_paid, 'Loan interest received'
    );
  END IF;
  IF v_fee_paid > 0 THEN
    INSERT INTO public.business_account_ledger (
      user_id, account_id, event_type, source_type, source_id, amount, notes
    ) VALUES (
      v_user_id, p_account_id, 'loan_fee_income', 'loan_repayment',
      v_repayment_id, v_fee_paid, 'Loan fee received'
    );
  END IF;

  SELECT
    v_loan.principal_amount - COALESCE(sum(principal_paid), 0),
    v_loan.interest_amount - COALESCE(sum(interest_paid), 0),
    v_loan.fee_amount - COALESCE(sum(fee_paid), 0)
  INTO v_principal_due, v_interest_due, v_fee_due
  FROM public.business_loan_repayments
  WHERE loan_id = p_loan_id AND user_id = v_user_id;
  UPDATE public.business_loans
  SET status = CASE
    WHEN v_principal_due <= 0 AND v_interest_due <= 0 AND v_fee_due <= 0 THEN 'repaid'
    WHEN due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'partially_repaid'
  END
  WHERE id = p_loan_id AND user_id = v_user_id;
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id, 'loan_repayment', v_repayment_id, 'created',
    jsonb_build_object(
      'loan_id', p_loan_id, 'principal_paid', v_principal_paid,
      'interest_paid', v_interest_paid, 'fee_paid', v_fee_paid, 'currency', p_currency
    )
  );
  RETURN v_repayment_id;
END;
$$;

CREATE FUNCTION public.complete_business_transfer(p_operation_id UUID)
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
  v_usd NUMERIC;
  v_transfer_fee NUMERIC;
  v_balance NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT status, receipt_account_id, payout_account_id, usd_sent, transfer_fee_usd
  INTO v_status, v_receipt_account, v_payout_account, v_usd, v_transfer_fee
  FROM public.business_customer_transactions
  WHERE id = p_operation_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer transaction not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status = 'completed' THEN RETURN; END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending customer transfers can be completed' USING ERRCODE = '23514';
  END IF;
  IF v_receipt_account = v_payout_account THEN
    RAISE EXCEPTION 'Receipt and payout accounts must differ' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.business_accounts
  WHERE id = v_payout_account AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout account not found or not owned' USING ERRCODE = '23514';
  END IF;
  SELECT opening_balance + COALESCE((
    SELECT sum(amount) FROM public.business_account_ledger
    WHERE account_id = v_payout_account AND user_id = v_user_id
  ), 0)
  INTO v_balance FROM public.business_accounts
  WHERE id = v_payout_account AND user_id = v_user_id;
  IF v_balance < v_usd + v_transfer_fee THEN
    RAISE EXCEPTION 'Insufficient payout account balance' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.business_account_ledger (
    user_id, account_id, event_type, source_type, source_id, amount, notes
  ) VALUES (
    v_user_id, v_payout_account, 'customer_transfer', 'customer_transaction',
    p_operation_id, -v_usd, 'USD sent to customer'
  );
  IF v_transfer_fee > 0 THEN
    INSERT INTO public.business_account_ledger (
      user_id, account_id, event_type, source_type, source_id, amount, notes
    ) VALUES (
      v_user_id, v_payout_account, 'transfer_fee', 'customer_transaction',
      p_operation_id, -v_transfer_fee, 'Customer transfer fee'
    );
  END IF;
  UPDATE public.business_customer_transactions
  SET status = 'completed', updated_at = now()
  WHERE id = p_operation_id AND user_id = v_user_id;
  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id, 'customer_transaction', p_operation_id, 'transfer_completed',
    jsonb_build_object('status', 'completed', 'usd_sent', v_usd)
  );
END;
$$;

CREATE FUNCTION public.complete_business_non_transfer_operation(
  p_operation_type TEXT,
  p_operation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_operation_type NOT IN ('funding', 'expense') THEN
    RAISE EXCEPTION 'Only funding and expense operations are supported here'
      USING ERRCODE = '22023';
  END IF;
  PERFORM public.complete_business_operation(p_operation_type, p_operation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_business_operation(TEXT, UUID) FROM authenticated, PUBLIC, anon;

REVOKE ALL ON public.business_customer_payments, public.business_loans,
  public.business_loan_repayments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_customer_payments, public.business_loans,
  public.business_loan_repayments TO authenticated;
GRANT ALL ON public.business_customer_payments, public.business_loans,
  public.business_loan_repayments TO service_role;

ALTER TABLE public.business_customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own customer payments" ON public.business_customer_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read their own business loans" ON public.business_loans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users read their own loan repayments" ON public.business_loan_repayments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON FUNCTION public.create_business_customer_transaction_with_due_date(
  UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, TEXT, DATE
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_business_customer_payment(
  UUID, UUID, UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_business_loan(
  UUID, UUID, UUID, NUMERIC, TEXT, DATE, DATE, NUMERIC, NUMERIC, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_business_loan_repayment(
  UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_business_transfer(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_business_non_transfer_operation(TEXT, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_business_customer_transaction_with_due_date(
  UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, TEXT, DATE
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_customer_payment(
  UUID, UUID, UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_loan(
  UUID, UUID, UUID, NUMERIC, TEXT, DATE, DATE, NUMERIC, NUMERIC, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_loan_repayment(
  UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_business_transfer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_business_non_transfer_operation(TEXT, UUID) TO authenticated;
