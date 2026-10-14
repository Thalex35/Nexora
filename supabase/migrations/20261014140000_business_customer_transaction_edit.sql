CREATE FUNCTION public.update_pending_business_customer_transaction(
  p_transaction_id UUID,
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
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_transaction public.business_customer_transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_transaction
  FROM public.business_customer_transactions
  WHERE id = p_transaction_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer transaction not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_transaction.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending customer transactions can be edited'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.business_customer_payments
    WHERE customer_transaction_id = p_transaction_id AND user_id = v_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.business_account_ledger
    WHERE source_type = 'customer_transaction'
      AND source_id = p_transaction_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Transactions with payments or ledger entries cannot be edited'
      USING ERRCODE = '23514';
  END IF;

  IF p_transaction_date IS NULL
    OR p_htg_received IS NULL OR p_htg_received <= 0
    OR p_usd_sent IS NULL OR p_usd_sent <= 0
    OR p_transfer_fee_usd IS NULL OR p_transfer_fee_usd < 0
    OR (p_exchange_rate IS NOT NULL AND p_exchange_rate <= 0)
    OR (p_service_fee_usd IS NOT NULL AND p_service_fee_usd < 0)
    OR (p_crypto_cost_usd IS NOT NULL AND p_crypto_cost_usd < 0)
    OR (p_other_expenses_usd IS NOT NULL AND p_other_expenses_usd < 0) THEN
    RAISE EXCEPTION 'Transaction amounts must be positive and fees non-negative'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.business_customers
    WHERE id = p_customer_id AND user_id = v_user_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE id = p_receipt_account_id AND user_id = v_user_id AND currency = 'HTG'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.business_accounts
    WHERE id = p_payout_account_id AND user_id = v_user_id AND currency = 'USD'
  ) THEN
    RAISE EXCEPTION 'Choose an owned customer and valid HTG and USD accounts'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.business_customer_transactions
  SET customer_id = p_customer_id,
      receipt_account_id = p_receipt_account_id,
      payout_account_id = p_payout_account_id,
      transaction_date = p_transaction_date,
      due_date = p_due_date,
      htg_received = p_htg_received,
      usd_sent = p_usd_sent,
      exchange_rate = p_exchange_rate,
      service_fee_usd = p_service_fee_usd,
      crypto_cost_usd = p_crypto_cost_usd,
      transfer_fee_usd = p_transfer_fee_usd,
      other_expenses_usd = p_other_expenses_usd,
      reference_code = NULLIF(trim(p_reference_code), ''),
      notes = NULLIF(trim(p_notes), ''),
      updated_at = now()
  WHERE id = p_transaction_id AND user_id = v_user_id;

  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'customer_transaction',
    p_transaction_id,
    'updated',
    jsonb_build_object(
      'customer_id', p_customer_id,
      'receipt_account_id', p_receipt_account_id,
      'payout_account_id', p_payout_account_id,
      'transaction_date', p_transaction_date,
      'due_date', p_due_date,
      'htg_received', p_htg_received,
      'usd_sent', p_usd_sent,
      'exchange_rate', p_exchange_rate,
      'service_fee_usd', p_service_fee_usd,
      'crypto_cost_usd', p_crypto_cost_usd,
      'transfer_fee_usd', p_transfer_fee_usd,
      'other_expenses_usd', p_other_expenses_usd,
      'reference_code', NULLIF(trim(p_reference_code), ''),
      'notes', NULLIF(trim(p_notes), '')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_pending_business_customer_transaction(
  UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_pending_business_customer_transaction(
  UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE
) TO authenticated;
