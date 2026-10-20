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
    FROM public.business_customer_payments AS payment
    WHERE payment.customer_transaction_id = p_operation_id
      AND payment.user_id = v_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_customer_payment_reversals AS payment_reversal
        WHERE payment_reversal.customer_payment_id = payment.id
          AND payment_reversal.user_id = v_user_id
      )
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

CREATE FUNCTION public.reverse_business_customer_transaction_with_payments(
  p_transaction_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.business_customer_transactions
    WHERE id = p_transaction_id AND user_id = v_user_id
  ) AND EXISTS (
    SELECT 1
    FROM public.business_customer_payments AS payment
    WHERE payment.customer_transaction_id = p_transaction_id
      AND payment.user_id = v_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_customer_payment_reversals AS payment_reversal
        WHERE payment_reversal.customer_payment_id = payment.id
          AND payment_reversal.user_id = v_user_id
      )
  ) THEN
    PERFORM public.reverse_business_customer_payments(p_transaction_id);
  END IF;

  PERFORM public.reverse_business_operation('customer_transaction', p_transaction_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_business_customer_transaction_with_payments(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_business_customer_transaction_with_payments(UUID)
  TO authenticated;
