import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { isAuthorizedUserId } from "@/lib/single-user";
import type {
  BusinessAccount,
  BusinessCustomer,
  BusinessExpense,
  BusinessLoan,
  BusinessLoanRepayment,
  BusinessPayment,
  BusinessTransaction,
} from "@/lib/business";

type CustomerRow = Database["public"]["Tables"]["business_customers"]["Row"];
type TransactionRow = Database["public"]["Tables"]["business_customer_transactions"]["Row"];
type FundingRow = Database["public"]["Tables"]["business_fundings"]["Row"];
type ExpenseRow = Database["public"]["Tables"]["business_expenses"]["Row"];
type LedgerRow = Database["public"]["Tables"]["business_account_ledger"]["Row"];
type ExchangeRateRow = Database["public"]["Tables"]["business_exchange_rates"]["Row"];
type PaymentRow = Database["public"]["Tables"]["business_customer_payments"]["Row"];
type LoanRow = Database["public"]["Tables"]["business_loans"]["Row"];
type LoanRepaymentRow = Database["public"]["Tables"]["business_loan_repayments"]["Row"];

export type BusinessFunding = FundingRow;
export type BusinessLedgerEntry = LedgerRow;
export type BusinessExchangeRate = ExchangeRateRow;

export type BusinessRecords = {
  customers: BusinessCustomer[];
  accounts: BusinessAccount[];
  transactions: BusinessTransaction[];
  payments: BusinessPayment[];
  loans: BusinessLoan[];
  loanRepayments: BusinessLoanRepayment[];
  fundings: BusinessFunding[];
  expenses: BusinessExpense[];
  ledger: BusinessLedgerEntry[];
  exchangeRates: BusinessExchangeRate[];
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Supabase returned no data.");
  return data;
}

function throwIfError({ error }: { error: { message: string } | null }) {
  if (error) throw new Error(error.message);
}

async function currentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("Not signed in");
  if (!isAuthorizedUserId(user.id)) throw new Error("This Nexora instance is private.");
  return user.id;
}

function mapCustomer(row: CustomerRow): BusinessCustomer {
  return {
    id: row.id,
    name: row.display_name,
    createdAt: row.created_at,
    ...(row.nickname === null ? {} : { nickname: row.nickname }),
    ...(row.contact_info === null ? {} : { contact: row.contact_info }),
    ...(row.notes === null ? {} : { notes: row.notes }),
  };
}

function mapTransaction(
  row: TransactionRow,
  customersById: Map<string, string>,
): BusinessTransaction {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: customersById.get(row.customer_id) ?? "Unknown customer",
    receiptAccountId: row.receipt_account_id,
    payoutAccountId: row.payout_account_id,
    transactionDate: row.transaction_date,
    dueDate: row.due_date,
    htgReceived: Number(row.htg_received),
    usdSent: Number(row.usd_sent),
    exchangeRate: row.exchange_rate === null ? null : Number(row.exchange_rate),
    serviceFee: row.service_fee_usd === null ? null : Number(row.service_fee_usd),
    cryptoCost: row.crypto_cost_usd === null ? null : Number(row.crypto_cost_usd),
    transferFee: Number(row.transfer_fee_usd),
    otherExpenses: row.other_expenses_usd === null ? null : Number(row.other_expenses_usd),
    status: row.status as BusinessTransaction["status"],
    ...(row.reference_code === null ? {} : { reference: row.reference_code }),
    ...(row.notes === null ? {} : { notes: row.notes }),
  };
}

function mapPayment(row: PaymentRow): BusinessPayment {
  return {
    id: row.id,
    customerTransactionId: row.customer_transaction_id,
    accountId: row.account_id,
    amount: Number(row.amount),
    currency: row.currency,
    paymentMethod: row.payment_method as BusinessPayment["paymentMethod"],
    paymentDate: row.payment_date,
    ...(row.reference === null ? {} : { reference: row.reference }),
    ...(row.notes === null ? {} : { notes: row.notes }),
    createdAt: row.created_at,
  };
}

function mapLoan(row: LoanRow, customersById: Map<string, string>): BusinessLoan {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: customersById.get(row.customer_id) ?? "Unknown customer",
    accountId: row.account_id,
    principalAmount: Number(row.principal_amount),
    currency: row.currency,
    issuedDate: row.issued_date,
    dueDate: row.due_date,
    interestAmount: Number(row.interest_amount),
    feeAmount: Number(row.fee_amount),
    status: row.status as BusinessLoan["status"],
    ...(row.notes === null ? {} : { notes: row.notes }),
    createdAt: row.created_at,
  };
}

function mapLoanRepayment(row: LoanRepaymentRow): BusinessLoanRepayment {
  return {
    id: row.id,
    loanId: row.loan_id,
    accountId: row.account_id,
    amount: Number(row.amount),
    principalPaid: Number(row.principal_paid),
    interestPaid: Number(row.interest_paid),
    feePaid: Number(row.fee_paid),
    currency: row.currency,
    repaymentDate: row.repayment_date,
    ...(row.reference === null ? {} : { reference: row.reference }),
    ...(row.notes === null ? {} : { notes: row.notes }),
    createdAt: row.created_at,
  };
}

export function useBusinessRecords() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["business"],
    enabled: authorized,
    queryFn: async (): Promise<BusinessRecords> => {
      await currentUserId();
      const [
        customersResult,
        accountsResult,
        balancesResult,
        transactionsResult,
        fundingsResult,
        expensesResult,
        ledgerResult,
        ratesResult,
        paymentsResult,
        loansResult,
        repaymentsResult,
      ] = await Promise.all([
        supabase.from("business_customers").select("*").order("display_name"),
        supabase.from("business_accounts").select("*").order("name"),
        supabase.rpc("business_account_balances"),
        supabase
          .from("business_customer_transactions")
          .select("*")
          .order("transaction_date", { ascending: false }),
        supabase.from("business_fundings").select("*").order("funding_date", { ascending: false }),
        supabase.from("business_expenses").select("*").order("expense_date", { ascending: false }),
        supabase
          .from("business_account_ledger")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("business_exchange_rates")
          .select("*")
          .lte("effective_date", new Date().toISOString().slice(0, 10))
          .order("effective_date", { ascending: false }),
        supabase
          .from("business_customer_payments")
          .select("*")
          .order("payment_date", { ascending: false }),
        supabase.from("business_loans").select("*").order("issued_date", { ascending: false }),
        supabase
          .from("business_loan_repayments")
          .select("*")
          .order("repayment_date", { ascending: false }),
      ]);

      const customers = unwrap(customersResult).map(mapCustomer);
      const customerById = new Map(customers.map((customer) => [customer.id, customer.name]));
      const accounts = unwrap(accountsResult);
      const balances = unwrap(balancesResult);
      const accountBalances = new Map(balances.map((account) => [account.id, account.balance]));
      const transactions = unwrap(transactionsResult).map((row) =>
        mapTransaction(row, customerById),
      );
      const fundingRows = unwrap(fundingsResult);
      const expenseRows = unwrap(expensesResult);
      const ledger = unwrap(ledgerResult);
      const exchangeRates = unwrap(ratesResult);
      const payments = unwrap(paymentsResult).map(mapPayment);
      const loans = unwrap(loansResult).map((row) => mapLoan(row, customerById));
      const loanRepayments = unwrap(repaymentsResult).map(mapLoanRepayment);
      const latestRates = new Map<string, number>();
      for (const rate of exchangeRates) {
        if (!latestRates.has(rate.currency)) {
          latestRates.set(rate.currency, Number(rate.usd_per_unit));
        }
      }

      return {
        customers,
        accounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.account_type as BusinessAccount["type"],
          currency: account.currency as BusinessAccount["currency"],
          balance: Number(accountBalances.get(account.id) ?? account.opening_balance),
          openingBalance: Number(account.opening_balance),
        })),
        transactions,
        payments,
        loans,
        loanRepayments,
        fundings: fundingRows,
        expenses: expenseRows.map((expense: ExpenseRow) => ({
          id: expense.id,
          accountId: expense.paid_from_account_id,
          category: expense.category,
          amount: Number(expense.amount),
          currency: expense.currency as BusinessExpense["currency"],
          usdPerUnit:
            expense.currency === "USD"
              ? 1
              : expense.usd_exchange_rate !== null
                ? Number(expense.usd_exchange_rate)
                : null,
          date: expense.expense_date,
          status: expense.status as BusinessExpense["status"],
          ...(expense.notes === null ? {} : { notes: expense.notes }),
        })),
        ledger,
        exchangeRates,
      };
    },
  });
}

function useBusinessInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["business"] });
}

export function useCreateBusinessCustomer() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      nickname?: string;
      contact?: string;
      notes?: string;
    }) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("business_customers")
          .insert({
            user_id: userId,
            display_name: values.name.trim(),
            nickname: values.nickname?.trim() || null,
            contact_info: values.contact?.trim() || null,
            notes: values.notes?.trim() || null,
          })
          .select("*")
          .single(),
      );
    },
    onSuccess: invalidate,
  });
}

export function useUpdateBusinessCustomer() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      nickname,
      contact,
      notes,
    }: {
      id: string;
      name: string;
      nickname?: string;
      contact?: string;
      notes?: string;
    }) => {
      await currentUserId();
      return unwrap(
        await supabase
          .from("business_customers")
          .update({
            display_name: name.trim(),
            nickname: nickname?.trim() || null,
            contact_info: contact?.trim() || null,
            notes: notes?.trim() || null,
          })
          .eq("id", id)
          .select("*")
          .single(),
      );
    },
    onSuccess: invalidate,
  });
}

export function useCreateBusinessAccount() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      name: string;
      type: BusinessAccount["type"];
      currency: string;
      openingBalance: number;
    }) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("business_accounts")
          .insert({
            user_id: userId,
            name: values.name.trim(),
            account_type: values.type,
            currency: values.currency.trim().toUpperCase(),
            opening_balance: values.openingBalance,
          })
          .select("*")
          .single(),
      );
    },
    onSuccess: invalidate,
  });
}

export function useUpdateBusinessAccount() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("business_accounts")
          .update({ name: name.trim() })
          .eq("id", id)
          .eq("user_id", userId)
          .select("*")
          .single(),
      );
    },
    onSuccess: invalidate,
  });
}

export function useDeleteBusinessAccount() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (id: string) => {
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from("business_accounts")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (error?.code === "23503") {
        throw new Error("This account has recorded activity and can't be deleted.");
      }
      return unwrap({ data, error });
    },
    onSuccess: invalidate,
  });
}

export function useCreateBusinessTransaction() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      idempotencyKey: string;
      customerId: string;
      receiptAccountId: string;
      payoutAccountId: string;
      date: string;
      dueDate: string | null;
      htgReceived: number;
      usdSent: number;
      exchangeRate: number | null;
      serviceFee: number | null;
      cryptoCost: number | null;
      transferFee: number;
      otherExpenses: number | null;
      reference?: string;
      notes?: string;
    }) => {
      const result = unwrap(
        await supabase.rpc("create_business_customer_transaction_with_due_date", {
          p_idempotency_key: values.idempotencyKey,
          p_customer_id: values.customerId,
          p_receipt_account_id: values.receiptAccountId,
          p_payout_account_id: values.payoutAccountId,
          p_transaction_date: values.date,
          p_htg_received: values.htgReceived,
          p_usd_sent: values.usdSent,
          p_exchange_rate: values.exchangeRate,
          p_service_fee_usd: values.serviceFee,
          p_crypto_cost_usd: values.cryptoCost,
          p_transfer_fee_usd: values.transferFee,
          p_other_expenses_usd: values.otherExpenses,
          p_reference_code: values.reference?.trim() || null,
          p_notes: values.notes?.trim() || null,
          p_due_date: values.dueDate,
        }),
      );
      return result;
    },
    onSuccess: invalidate,
  });
}

export function useCreateBusinessCustomerPayment() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      idempotencyKey: string;
      transactionId: string;
      accountId: string;
      amount: number;
      currency: string;
      paymentMethod: string;
      date: string;
      reference?: string;
      notes?: string;
    }) =>
      unwrap(
        await supabase.rpc("create_business_customer_payment", {
          p_idempotency_key: values.idempotencyKey,
          p_customer_transaction_id: values.transactionId,
          p_account_id: values.accountId,
          p_amount: values.amount,
          p_currency: values.currency,
          p_payment_method: values.paymentMethod,
          p_payment_date: values.date,
          p_reference: values.reference?.trim() || null,
          p_notes: values.notes?.trim() || null,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCreateBusinessLoan() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      idempotencyKey: string;
      customerId: string;
      accountId: string;
      principalAmount: number;
      currency: string;
      issuedDate: string;
      dueDate: string | null;
      interestAmount: number;
      feeAmount: number;
      notes?: string;
    }) =>
      unwrap(
        await supabase.rpc("create_business_loan", {
          p_idempotency_key: values.idempotencyKey,
          p_customer_id: values.customerId,
          p_account_id: values.accountId,
          p_principal_amount: values.principalAmount,
          p_currency: values.currency,
          p_issued_date: values.issuedDate,
          p_due_date: values.dueDate,
          p_interest_amount: values.interestAmount,
          p_fee_amount: values.feeAmount,
          p_notes: values.notes?.trim() || null,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCreateBusinessLoanRepayment() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      idempotencyKey: string;
      loanId: string;
      accountId: string;
      amount: number;
      currency: string;
      date: string;
      reference?: string;
      notes?: string;
    }) =>
      unwrap(
        await supabase.rpc("create_business_loan_repayment", {
          p_idempotency_key: values.idempotencyKey,
          p_loan_id: values.loanId,
          p_account_id: values.accountId,
          p_amount: values.amount,
          p_currency: values.currency,
          p_repayment_date: values.date,
          p_reference: values.reference?.trim() || null,
          p_notes: values.notes?.trim() || null,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCreateBusinessFunding() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      idempotencyKey: string;
      type: string;
      sourceAccountId: string | null;
      destinationAccountId: string;
      sourceAmount: number | null;
      creditedAmount: number;
      feeAmount: number;
      feeUsd: number | null;
      cryptoQuantity: number | null;
      cryptoUnitPriceUsd: number | null;
      date: string;
      reference?: string;
      notes?: string;
    }) =>
      unwrap(
        await supabase.rpc("create_business_funding", {
          p_idempotency_key: values.idempotencyKey,
          p_funding_type: values.type,
          p_source_account_id: values.sourceAccountId,
          p_destination_account_id: values.destinationAccountId,
          p_source_amount: values.sourceAmount,
          p_credited_amount: values.creditedAmount,
          p_fee_amount: values.feeAmount,
          p_fee_usd: values.feeUsd,
          p_crypto_quantity: values.cryptoQuantity,
          p_crypto_unit_price_usd: values.cryptoUnitPriceUsd,
          p_funding_date: values.date,
          p_reference_code: values.reference?.trim() || null,
          p_notes: values.notes?.trim() || null,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCreateBusinessExpense() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      idempotencyKey: string;
      accountId: string;
      category: string;
      amount: number;
      currency: string;
      usdRate: number | null;
      date: string;
      notes?: string;
    }) =>
      unwrap(
        await supabase.rpc("create_business_expense", {
          p_idempotency_key: values.idempotencyKey,
          p_paid_from_account_id: values.accountId,
          p_category: values.category.trim(),
          p_amount: values.amount,
          p_currency: values.currency,
          p_usd_exchange_rate: values.usdRate,
          p_expense_date: values.date,
          p_notes: values.notes?.trim() || null,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCreateBusinessAdjustment() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      idempotencyKey: string;
      accountId: string;
      amount: number;
      reason: string;
    }) =>
      unwrap(
        await supabase.rpc("create_business_adjustment", {
          p_idempotency_key: values.idempotencyKey,
          p_account_id: values.accountId,
          p_amount: values.amount,
          p_reason: values.reason.trim(),
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useCompleteBusinessOperation() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      await currentUserId();
      if (type === "customer_transaction") {
        throwIfError(await supabase.rpc("complete_business_transfer", { p_operation_id: id }));
      } else {
        throwIfError(
          await supabase.rpc("complete_business_non_transfer_operation", {
            p_operation_type: type,
            p_operation_id: id,
          }),
        );
      }
    },
    onSuccess: invalidate,
  });
}

export function useCloseBusinessOperation() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async ({
      type,
      id,
      status,
    }: {
      type: string;
      id: string;
      status: "failed" | "cancelled";
    }) => {
      await currentUserId();
      throwIfError(
        await supabase.rpc("close_business_operation", {
          p_operation_type: type,
          p_operation_id: id,
          p_status: status,
        }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useReverseBusinessOperation() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      await currentUserId();
      throwIfError(
        await supabase.rpc("reverse_business_operation", {
          p_operation_type: type,
          p_operation_id: id,
        }),
      );
    },
    onSuccess: invalidate,
  });
}

export function useSaveBusinessExchangeRate() {
  const invalidate = useBusinessInvalidation();
  return useMutation({
    mutationFn: async (values: {
      currency: string;
      usdPerUnit: number;
      date: string;
      notes?: string;
    }) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("business_exchange_rates")
          .upsert(
            {
              user_id: userId,
              currency: values.currency.toUpperCase(),
              usd_per_unit: values.usdPerUnit,
              effective_date: values.date,
              notes: values.notes?.trim() || null,
            },
            { onConflict: "user_id,currency,effective_date" },
          )
          .select("*")
          .single(),
      );
    },
    onSuccess: invalidate,
  });
}
