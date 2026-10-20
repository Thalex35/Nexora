CREATE TABLE public.business_customer_payment_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_payment_id UUID NOT NULL,
  reversed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  CONSTRAINT business_customer_payment_reversals_payment_unique
    UNIQUE (customer_payment_id, user_id),
  CONSTRAINT business_customer_payment_reversals_payment_owner_fkey
    FOREIGN KEY (customer_payment_id, user_id)
    REFERENCES public.business_customer_payments (id, user_id)
);

ALTER TABLE public.business_customer_payment_reversals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own customer payment reversals"
  ON public.business_customer_payment_reversals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.business_customer_payment_reversals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_customer_payment_reversals TO authenticated;
GRANT ALL ON public.business_customer_payment_reversals TO service_role;

CREATE FUNCTION public.reverse_business_customer_payments(p_customer_transaction_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_transaction_status TEXT;
  v_account_id UUID;
  v_payment RECORD;
  v_reversed_count INTEGER := 0;
  v_balance NUMERIC;
  v_amount_to_reverse NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_transaction_status
  FROM public.business_customer_transactions
  WHERE id = p_customer_transaction_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer transaction not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_transaction_status IN ('failed', 'cancelled', 'reversed') THEN
    RAISE EXCEPTION 'Payments cannot be reversed for a closed customer transaction'
      USING ERRCODE = '23514';
  END IF;

  PERFORM payment.id
  FROM public.business_customer_payments AS payment
  WHERE payment.customer_transaction_id = p_customer_transaction_id
    AND payment.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.business_customer_payment_reversals AS reversal
      WHERE reversal.customer_payment_id = payment.id AND reversal.user_id = v_user_id
    )
  ORDER BY payment.id
  FOR UPDATE;

  FOR v_account_id IN
    SELECT DISTINCT payment.account_id
    FROM public.business_customer_payments AS payment
    WHERE payment.customer_transaction_id = p_customer_transaction_id
      AND payment.user_id = v_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_customer_payment_reversals AS reversal
        WHERE reversal.customer_payment_id = payment.id AND reversal.user_id = v_user_id
      )
    ORDER BY payment.account_id
  LOOP
    PERFORM 1
    FROM public.business_accounts
    WHERE id = v_account_id AND user_id = v_user_id
    FOR UPDATE;
  END LOOP;

  FOR v_account_id, v_amount_to_reverse IN
    SELECT payment.account_id, sum(payment.amount)
    FROM public.business_customer_payments AS payment
    WHERE payment.customer_transaction_id = p_customer_transaction_id
      AND payment.user_id = v_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_customer_payment_reversals AS reversal
        WHERE reversal.customer_payment_id = payment.id AND reversal.user_id = v_user_id
      )
    GROUP BY payment.account_id
  LOOP
    SELECT account.opening_balance + COALESCE(sum(ledger.amount), 0)
    INTO v_balance
    FROM public.business_accounts AS account
    LEFT JOIN public.business_account_ledger AS ledger
      ON ledger.account_id = account.id AND ledger.user_id = account.user_id
    WHERE account.id = v_account_id AND account.user_id = v_user_id
    GROUP BY account.id;
    IF v_balance < v_amount_to_reverse THEN
      RAISE EXCEPTION 'Reversal would make an account balance negative'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  FOR v_payment IN
    SELECT payment.id, payment.account_id, payment.amount
    FROM public.business_customer_payments AS payment
    WHERE payment.customer_transaction_id = p_customer_transaction_id
      AND payment.user_id = v_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.business_customer_payment_reversals AS reversal
        WHERE reversal.customer_payment_id = payment.id AND reversal.user_id = v_user_id
      )
    ORDER BY payment.id
  LOOP
    INSERT INTO public.business_customer_payment_reversals (user_id, customer_payment_id, notes)
    VALUES (v_user_id, v_payment.id, 'Payment reversed from customer payment status.');

    INSERT INTO public.business_account_ledger (
      user_id, account_id, event_type, source_type, source_id, amount, notes
    ) VALUES (
      v_user_id,
      v_payment.account_id,
      'customer_payment_reversal',
      'customer_payment',
      v_payment.id,
      -v_payment.amount,
      'Reversal of customer payment'
    );

    INSERT INTO public.business_audit_log (user_id, entity_type, entity_id, action, payload)
    VALUES (
      v_user_id,
      'customer_payment',
      v_payment.id,
      'reversed',
      jsonb_build_object(
        'customer_transaction_id', p_customer_transaction_id,
        'amount', v_payment.amount,
        'currency', 'HTG'
      )
    );
    v_reversed_count := v_reversed_count + 1;
  END LOOP;

  IF v_reversed_count = 0 THEN
    RAISE EXCEPTION 'No active customer payments to reverse' USING ERRCODE = '23514';
  END IF;

  RETURN v_reversed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_business_customer_payments(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_business_customer_payments(UUID) TO authenticated;
