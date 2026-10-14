CREATE OR REPLACE FUNCTION public.prevent_business_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND NULLIF(current_setting('app.business_account_delete', true), '') IS NOT NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Business ledger entries are immutable; use a reversal or adjustment'
    USING ERRCODE = '23514';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_business_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND NULLIF(current_setting('app.business_account_delete', true), '') IS NOT NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Business payments and repayments are immutable'
    USING ERRCODE = '23514';
END;
$$;

CREATE FUNCTION public.delete_business_account(p_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_transaction_ids UUID[] := ARRAY[]::UUID[];
  v_funding_ids UUID[] := ARRAY[]::UUID[];
  v_expense_ids UUID[] := ARRAY[]::UUID[];
  v_adjustment_ids UUID[] := ARRAY[]::UUID[];
  v_loan_ids UUID[] := ARRAY[]::UUID[];
  v_repayment_ids UUID[] := ARRAY[]::UUID[];
  v_payment_ids UUID[] := ARRAY[]::UUID[];
  v_related_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.business_accounts
  WHERE id = p_account_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business account not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.business_account_delete', p_account_id::TEXT, true);

  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO v_transaction_ids
  FROM public.business_customer_transactions
  WHERE user_id = v_user_id
    AND (receipt_account_id = p_account_id OR payout_account_id = p_account_id);

  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO v_funding_ids
  FROM public.business_fundings
  WHERE user_id = v_user_id
    AND (source_account_id = p_account_id OR destination_account_id = p_account_id);

  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO v_expense_ids
  FROM public.business_expenses
  WHERE user_id = v_user_id AND paid_from_account_id = p_account_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO v_adjustment_ids
  FROM public.business_adjustments
  WHERE user_id = v_user_id AND account_id = p_account_id;

  SELECT COALESCE(array_agg(loan.id), ARRAY[]::UUID[])
  INTO v_loan_ids
  FROM public.business_loans AS loan
  WHERE loan.user_id = v_user_id
    AND (
      loan.account_id = p_account_id
      OR EXISTS (
        SELECT 1
        FROM public.business_loan_repayments AS repayment
        WHERE repayment.loan_id = loan.id
          AND repayment.user_id = v_user_id
          AND repayment.account_id = p_account_id
      )
    );

  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO v_repayment_ids
  FROM public.business_loan_repayments
  WHERE user_id = v_user_id
    AND (account_id = p_account_id OR loan_id = ANY(v_loan_ids));

  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO v_payment_ids
  FROM public.business_customer_payments
  WHERE user_id = v_user_id
    AND (account_id = p_account_id OR customer_transaction_id = ANY(v_transaction_ids));

  v_related_ids := v_transaction_ids
    || v_funding_ids
    || v_expense_ids
    || v_adjustment_ids
    || v_loan_ids
    || v_repayment_ids
    || v_payment_ids;

  DELETE FROM public.business_audit_log
  WHERE user_id = v_user_id
    AND (entity_id = ANY(v_related_ids)
      OR (entity_type = 'business_account' AND entity_id = p_account_id));

  DELETE FROM public.business_account_ledger
  WHERE user_id = v_user_id
    AND (
      account_id = p_account_id
      OR (source_type = 'customer_transaction' AND source_id = ANY(v_transaction_ids))
      OR (source_type = 'customer_payment' AND source_id = ANY(v_payment_ids))
      OR (source_type = 'funding' AND source_id = ANY(v_funding_ids))
      OR (source_type = 'expense' AND source_id = ANY(v_expense_ids))
      OR (source_type = 'adjustment' AND source_id = ANY(v_adjustment_ids))
      OR (source_type = 'loan' AND source_id = ANY(v_loan_ids))
      OR (source_type = 'loan_repayment' AND source_id = ANY(v_repayment_ids))
      OR (source_type = 'reversal' AND source_id = ANY(v_related_ids))
    );

  DELETE FROM public.business_customer_payments
  WHERE user_id = v_user_id AND id = ANY(v_payment_ids);
  DELETE FROM public.business_loan_repayments
  WHERE user_id = v_user_id AND id = ANY(v_repayment_ids);
  DELETE FROM public.business_loans
  WHERE user_id = v_user_id AND id = ANY(v_loan_ids);
  DELETE FROM public.business_customer_transactions
  WHERE user_id = v_user_id AND id = ANY(v_transaction_ids);
  DELETE FROM public.business_fundings
  WHERE user_id = v_user_id AND id = ANY(v_funding_ids);
  DELETE FROM public.business_expenses
  WHERE user_id = v_user_id AND id = ANY(v_expense_ids);
  DELETE FROM public.business_adjustments
  WHERE user_id = v_user_id AND id = ANY(v_adjustment_ids);
  DELETE FROM public.business_accounts
  WHERE id = p_account_id AND user_id = v_user_id;
END;
$$;

REVOKE DELETE ON public.business_accounts FROM authenticated;
REVOKE ALL ON FUNCTION public.delete_business_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_business_account(UUID) TO authenticated;
