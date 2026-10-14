CREATE OR REPLACE FUNCTION public.unreverse_business_customer_transaction(p_transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status TEXT;
  v_reversal_at TIMESTAMPTZ;
  v_restore_id UUID := gen_random_uuid();
  v_account_id UUID;
  v_restore_amount NUMERIC;
  v_balance NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT status
  INTO v_status
  FROM public.business_customer_transactions
  WHERE id = p_transaction_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer transaction not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'reversed' THEN
    RAISE EXCEPTION 'Only reversed customer transactions can be restored for editing'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.business_customer_payments
    WHERE customer_transaction_id = p_transaction_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Reverse customer payments before restoring this transaction'
      USING ERRCODE = '23514';
  END IF;

  SELECT max(created_at)
  INTO v_reversal_at
  FROM public.business_audit_log
  WHERE user_id = v_user_id
    AND entity_type = 'customer_transaction'
    AND entity_id = p_transaction_id
    AND action = 'reversed';

  IF v_reversal_at IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.business_account_ledger
    WHERE user_id = v_user_id
      AND source_type = 'reversal'
      AND source_id = p_transaction_id
      AND created_at = v_reversal_at
  ) THEN
    RAISE EXCEPTION 'The transaction reversal ledger entries were not found'
      USING ERRCODE = '23514';
  END IF;

  FOR v_account_id IN
    SELECT DISTINCT account_id
    FROM public.business_account_ledger
    WHERE user_id = v_user_id
      AND source_type = 'reversal'
      AND source_id = p_transaction_id
      AND created_at = v_reversal_at
    ORDER BY account_id
  LOOP
    PERFORM 1
    FROM public.business_accounts
    WHERE id = v_account_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Transaction account not found or not owned' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  FOR v_account_id, v_restore_amount IN
    SELECT account_id, -sum(amount)
    FROM public.business_account_ledger
    WHERE user_id = v_user_id
      AND source_type = 'reversal'
      AND source_id = p_transaction_id
      AND created_at = v_reversal_at
    GROUP BY account_id
    HAVING sum(amount) <> 0
  LOOP
    IF v_restore_amount < 0 THEN
      SELECT account.opening_balance + COALESCE((
        SELECT sum(ledger.amount)
        FROM public.business_account_ledger AS ledger
        WHERE ledger.user_id = v_user_id AND ledger.account_id = v_account_id
      ), 0)
      INTO v_balance
      FROM public.business_accounts AS account
      WHERE account.id = v_account_id AND account.user_id = v_user_id;

      IF v_balance + v_restore_amount < 0 THEN
        RAISE EXCEPTION 'Restoring this transaction would make an account balance negative'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    INSERT INTO public.business_account_ledger (
      user_id, account_id, event_type, source_type, source_id, amount, notes
    )
    VALUES (
      v_user_id,
      v_account_id,
      'operation_unreversal_' || v_restore_id::TEXT,
      'reversal',
      p_transaction_id,
      v_restore_amount,
      'Ledger restoration to allow editing a reversed customer transaction'
    );
  END LOOP;

  UPDATE public.business_customer_transactions
  SET status = 'completed', updated_at = now()
  WHERE id = p_transaction_id AND user_id = v_user_id;

  INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'customer_transaction',
    p_transaction_id,
    'restored_for_editing',
    jsonb_build_object(
      'previous_status', 'reversed',
      'status', 'completed',
      'ledger_restored', true
    )
  );
END;
$$;
