DROP FUNCTION public.update_pending_business_customer_transaction(
  UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE
);

CREATE FUNCTION public.update_business_customer_transaction(
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
  v_account_id UUID;
  v_net_amount NUMERIC;
  v_new_amount NUMERIC;
  v_balance NUMERIC;
  v_edit_id UUID := gen_random_uuid();
  v_completed BOOLEAN;
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
  IF v_transaction.status NOT IN ('pending', 'completed') THEN
    RAISE EXCEPTION 'Only pending or completed customer transactions can be edited'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.business_customer_payments
    WHERE customer_transaction_id = p_transaction_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Reverse customer payments before editing this transaction'
      USING ERRCODE = '23514';
  END IF;

  v_completed := v_transaction.status = 'completed';
  IF v_completed AND NOT EXISTS (
    SELECT 1
    FROM public.business_account_ledger
    WHERE source_type = 'customer_transaction'
      AND source_id = p_transaction_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Completed transaction has no ledger entries'
      USING ERRCODE = '23514';
  END IF;
  IF NOT v_completed AND EXISTS (
    SELECT 1
    FROM public.business_account_ledger
    WHERE source_type IN ('customer_transaction', 'reversal')
      AND source_id = p_transaction_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Pending transactions cannot have posted ledger entries'
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
  IF p_receipt_account_id = p_payout_account_id THEN
    RAISE EXCEPTION 'Receipt and payout accounts must differ' USING ERRCODE = '23514';
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

  FOR v_account_id IN
    SELECT account_ids.id
    FROM (
      SELECT account_id AS id
      FROM public.business_account_ledger
      WHERE user_id = v_user_id
        AND source_id = p_transaction_id
        AND source_type IN ('customer_transaction', 'reversal')
      UNION
      SELECT p_receipt_account_id
      UNION
      SELECT p_payout_account_id
    ) AS account_ids
    ORDER BY account_ids.id
  LOOP
    PERFORM 1
    FROM public.business_accounts
    WHERE id = v_account_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction account not found or not owned' USING ERRCODE = '23514';
    END IF;

    IF v_completed THEN
      SELECT COALESCE(sum(amount), 0)
      INTO v_net_amount
      FROM public.business_account_ledger
      WHERE user_id = v_user_id
        AND source_id = p_transaction_id
        AND source_type IN ('customer_transaction', 'reversal')
        AND account_id = v_account_id;

      v_new_amount := CASE
        WHEN v_account_id = p_receipt_account_id THEN p_htg_received
        WHEN v_account_id = p_payout_account_id THEN -(p_usd_sent + p_transfer_fee_usd)
        ELSE 0
      END;

      SELECT account.opening_balance + COALESCE((
        SELECT sum(ledger.amount)
        FROM public.business_account_ledger AS ledger
        WHERE ledger.user_id = v_user_id AND ledger.account_id = v_account_id
      ), 0)
      INTO v_balance
      FROM public.business_accounts AS account
      WHERE account.id = v_account_id AND account.user_id = v_user_id;

      IF v_balance - v_net_amount + v_new_amount < 0 THEN
        RAISE EXCEPTION 'Editing this transaction would make an account balance negative'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;

  IF v_completed THEN
    FOR v_account_id, v_net_amount IN
      SELECT account_id, sum(amount)
      FROM public.business_account_ledger
      WHERE user_id = v_user_id
        AND source_id = p_transaction_id
        AND source_type IN ('customer_transaction', 'reversal')
      GROUP BY account_id
      HAVING sum(amount) <> 0
    LOOP
      INSERT INTO public.business_account_ledger (
        user_id, account_id, event_type, source_type, source_id, amount, notes
      )
      VALUES (
        v_user_id,
        v_account_id,
        'transaction_edit_reversal_' || v_edit_id::TEXT,
        'reversal',
        p_transaction_id,
        -v_net_amount,
        'Ledger correction for edited completed customer transaction'
      );
    END LOOP;

    INSERT INTO public.business_account_ledger (
      user_id, account_id, event_type, source_type, source_id, amount, notes
    )
    VALUES
      (
        v_user_id, p_receipt_account_id, 'customer_receipt_edit_' || v_edit_id::TEXT,
        'customer_transaction', p_transaction_id, p_htg_received,
        'HTG receipt after customer transaction edit'
      ),
      (
        v_user_id, p_payout_account_id, 'customer_transfer_edit_' || v_edit_id::TEXT,
        'customer_transaction', p_transaction_id, -p_usd_sent,
        'USD transfer after customer transaction edit'
      );
    IF p_transfer_fee_usd > 0 THEN
      INSERT INTO public.business_account_ledger (
        user_id, account_id, event_type, source_type, source_id, amount, notes
      )
      VALUES (
        v_user_id, p_payout_account_id, 'transfer_fee_edit_' || v_edit_id::TEXT,
        'customer_transaction', p_transaction_id, -p_transfer_fee_usd,
        'Transfer fee after customer transaction edit'
      );
    END IF;
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
      'previous', to_jsonb(v_transaction),
      'new', jsonb_build_object(
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
      ),
      'ledger_corrected', v_completed
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_business_customer_transaction(
  UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_business_customer_transaction(
  UUID, UUID, UUID, UUID, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE
) TO authenticated;

CREATE OR REPLACE FUNCTION public.reverse_business_operation(p_operation_type TEXT, p_operation_id UUID)
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_operation_type = 'customer_transaction' THEN
    SELECT status INTO v_status
    FROM public.business_customer_transactions
    WHERE id = p_operation_id AND user_id = v_user_id
    FOR UPDATE;
  ELSIF p_operation_type = 'funding' THEN
    SELECT status INTO v_status
    FROM public.business_fundings
    WHERE id = p_operation_id AND user_id = v_user_id
    FOR UPDATE;
  ELSIF p_operation_type = 'expense' THEN
    SELECT status INTO v_status
    FROM public.business_expenses
    WHERE id = p_operation_id AND user_id = v_user_id
    FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unsupported business operation type' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'reversed' THEN
    RETURN;
  END IF;
  IF v_status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Only completed operations can be reversed';
  END IF;
  IF p_operation_type = 'customer_transaction' AND EXISTS (
    SELECT 1
    FROM public.business_customer_payments
    WHERE customer_transaction_id = p_operation_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Customer payments must be reversed before the transaction'
      USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(net.account_id ORDER BY net.account_id)
  INTO v_accounts
  FROM (
    SELECT account_id
    FROM public.business_account_ledger
    WHERE user_id = v_user_id
      AND source_id = p_operation_id
      AND (
        (p_operation_type = 'customer_transaction' AND source_type IN ('customer_transaction', 'reversal'))
        OR (p_operation_type <> 'customer_transaction' AND source_type = p_operation_type)
      )
    GROUP BY account_id
    HAVING sum(amount) <> 0
  ) AS net;
  IF v_accounts IS NULL THEN
    RAISE EXCEPTION 'Completed operation has no ledger entries';
  END IF;

  FOREACH v_account_id IN ARRAY v_accounts LOOP
    PERFORM 1
    FROM public.business_accounts
    WHERE id = v_account_id AND user_id = v_user_id
    FOR UPDATE;
  END LOOP;

  FOR v_entry IN
    SELECT account_id, sum(amount) AS amount
    FROM public.business_account_ledger
    WHERE user_id = v_user_id
      AND source_id = p_operation_id
      AND (
        (p_operation_type = 'customer_transaction' AND source_type IN ('customer_transaction', 'reversal'))
        OR (p_operation_type <> 'customer_transaction' AND source_type = p_operation_type)
      )
    GROUP BY account_id
    HAVING sum(amount) <> 0
  LOOP
    IF v_entry.amount > 0 THEN
      SELECT account.opening_balance + COALESCE((
        SELECT sum(ledger.amount)
        FROM public.business_account_ledger AS ledger
        WHERE ledger.account_id = v_entry.account_id AND ledger.user_id = v_user_id
      ), 0)
      INTO v_balance
      FROM public.business_accounts AS account
      WHERE account.id = v_entry.account_id AND account.user_id = v_user_id;
      IF v_balance < v_entry.amount THEN
        RAISE EXCEPTION 'Reversal would make an account balance negative';
      END IF;
    END IF;
    INSERT INTO public.business_account_ledger (
      user_id, account_id, event_type, source_type, source_id, amount, notes
    )
    VALUES (
      v_user_id,
      v_entry.account_id,
      'operation_reversal_' || gen_random_uuid()::TEXT,
      'reversal',
      p_operation_id,
      -v_entry.amount,
      'Reversal of ' || p_operation_type
    );
  END LOOP;

  IF p_operation_type = 'customer_transaction' THEN
    UPDATE public.business_customer_transactions
    SET status = 'reversed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  ELSIF p_operation_type = 'funding' THEN
    UPDATE public.business_fundings
    SET status = 'reversed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  ELSE
    UPDATE public.business_expenses
    SET status = 'reversed', updated_at = now()
    WHERE id = p_operation_id AND user_id = v_user_id;
  END IF;

  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id, p_operation_type, p_operation_id, 'reversed',
    jsonb_build_object('previous_status', 'completed', 'status', 'reversed')
  );
END;
$$;
