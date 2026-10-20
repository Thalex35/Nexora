CREATE OR REPLACE FUNCTION public.create_business_customer_payment(
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
  SELECT COALESCE(sum(payment.amount), 0) INTO v_paid
  FROM public.business_customer_payments AS payment
  WHERE payment.customer_transaction_id = p_customer_transaction_id
    AND payment.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.business_customer_payment_reversals AS reversal
      WHERE reversal.customer_payment_id = payment.id
        AND reversal.user_id = v_user_id
    );
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
    jsonb_build_object(
      'customer_transaction_id', p_customer_transaction_id,
      'amount', p_amount,
      'currency', p_currency
    )
  );
  RETURN v_payment_id;
END;
$$;
