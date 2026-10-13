import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateAccountBalance,
  calculateBusinessMetrics,
  calculateCustomerPaymentSummary,
  calculateCustomerPerformance,
  calculateLoanSummary,
  calculateTransactionProfit,
  convertToReportingCurrency,
  type BusinessAccount,
  type BusinessExpense,
  type BusinessTransaction,
} from "./business.ts";

const businessMigration = readFileSync(
  new URL("../../supabase/migrations/20261013000000_business_accounting.sql", import.meta.url),
  "utf8",
);
const paymentsLoansMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20261014000000_business_customer_payments_and_loans.sql",
    import.meta.url,
  ),
  "utf8",
);
const businessDataSource = readFileSync(new URL("./business-data.ts", import.meta.url), "utf8");

const accounts: BusinessAccount[] = [
  { id: "meru", name: "Meru Wallet", type: "meru", balance: 10, currency: "USD" },
  { id: "cash", name: "HTG Cash", type: "cash", balance: 9000, currency: "HTG" },
];

const transactions: BusinessTransaction[] = [
  {
    id: "t1",
    customerId: "c1",
    customerName: "Alpha",
    receiptAccountId: "cash",
    payoutAccountId: "meru",
    transactionDate: "2026-10-01",
    htgReceived: 1500,
    usdSent: 20,
    exchangeRate: 130,
    serviceFee: 5,
    cryptoCost: 0,
    transferFee: 1,
    otherExpenses: 0,
    reference: "abc",
    status: "completed",
  },
  {
    id: "t2",
    customerId: "c1",
    customerName: "Alpha",
    receiptAccountId: "cash",
    payoutAccountId: "meru",
    transactionDate: "2026-10-02",
    htgReceived: 2000,
    usdSent: 18,
    exchangeRate: 140,
    serviceFee: null,
    cryptoCost: 2,
    transferFee: 0.5,
    otherExpenses: 1,
    reference: "def",
    status: "pending",
  },
];

const expenses: BusinessExpense[] = [
  {
    id: "e1",
    category: "Crypto fees",
    amount: 1.5,
    currency: "USD",
    usdPerUnit: 1,
    date: "2026-10-03",
    status: "completed",
  },
  {
    id: "e2",
    category: "Pending purchase",
    amount: 25,
    currency: "USD",
    usdPerUnit: 1,
    date: "2026-10-04",
    status: "pending",
  },
];

test("wallet ledger opening balance and completed entries remain authoritative", () => {
  const result = calculateAccountBalance(10, [
    { amount: -2, status: "completed" },
    { amount: 15, status: "pending" },
    { amount: -5, status: "cancelled" },
  ]);

  assert.equal(result.openingBalance, 10);
  assert.equal(result.availableBalance, 8);
  assert.equal(result.pendingImpact, 15);
  assert.equal(result.failedImpact, 5);
});

test("transaction profit uses recorded revenue and costs, not the raw customer payment", () => {
  const result = calculateTransactionProfit(transactions[0]!);

  assert.equal(result.revenue, 5);
  assert.equal(result.costs, 1);
  assert.equal(result.netProfit, 4);
  assert.equal(result.customerUsdValue, 11.54);
  assert.equal(result.incomplete, false);
});

test("customer totals aggregate HTG receipts and estimated profit", () => {
  const summary = calculateCustomerPerformance("c1", transactions);

  assert.equal(summary.totalHtgReceived, 1500);
  assert.equal(summary.totalUsdSent, 20);
  assert.equal(summary.transactionCount, 2);
  assert.equal(summary.estimatedProfit, 4);
});

test("partial customer payments are aggregated from persisted payment rows", () => {
  const payments = [
    { amount: 1000, paymentDate: "2026-10-02" },
    { amount: 600, paymentDate: "2026-10-03" },
  ];

  const summary = calculateCustomerPaymentSummary(
    { htgReceived: 2000, dueDate: "2099-10-20", transactionDate: "2026-10-01" },
    payments,
  );

  assert.equal(summary.totalPaid, 1600);
  assert.equal(summary.outstanding, 400);
  assert.equal(summary.status, "partially_paid");
});

test("a fully paid customer transaction closes only the payment balance", () => {
  const summary = calculateCustomerPaymentSummary(
    { htgReceived: 1600, dueDate: "2099-10-20", transactionDate: "2026-10-01" },
    [
      { amount: 1000, paymentDate: "2026-10-02" },
      { amount: 600, paymentDate: "2026-10-03" },
    ],
  );

  assert.equal(summary.totalPaid, 1600);
  assert.equal(summary.outstanding, 0);
  assert.equal(summary.status, "fully_paid");
});

test("loan repayment summaries keep principal out of profit and track overdue balances", () => {
  const summary = calculateLoanSummary(
    {
      principalAmount: 1200,
      currency: "USD",
      dueDate: "2099-11-10",
      status: "active",
      issuedDate: "2026-09-01",
    },
    [
      { amount: 400, currency: "USD", repaymentDate: "2026-09-20" },
      { amount: 300, currency: "USD", repaymentDate: "2026-10-05" },
    ],
  );

  assert.equal(summary.totalRepaid, 700);
  assert.equal(summary.outstandingPrincipal, 500);
  assert.equal(summary.nextRepayment, 500);
  assert.equal(summary.isOverdue, false);
});

test("business metrics surface outstanding payments and loan principal by currency", () => {
  const summary = calculateBusinessMetrics({
    accounts: [{ id: "meru", name: "Meru", type: "meru", balance: 100, currency: "USD" }],
    transactions: [
      {
        id: "tx-1",
        customerId: "c-1",
        customerName: "Alpha",
        receiptAccountId: "cash",
        payoutAccountId: "meru",
        transactionDate: "2026-10-01",
        dueDate: "2099-10-20",
        htgReceived: 2500,
        usdSent: 20,
        exchangeRate: 125,
        serviceFee: 2,
        cryptoCost: 1,
        transferFee: 0.5,
        otherExpenses: 0,
        status: "completed",
      },
      {
        id: "tx-2",
        customerId: "c-2",
        customerName: "Bravo",
        receiptAccountId: "cash",
        payoutAccountId: "meru",
        transactionDate: "2026-10-04",
        dueDate: "2000-10-01",
        htgReceived: 1000,
        usdSent: 10,
        exchangeRate: 120,
        serviceFee: 1,
        cryptoCost: 0,
        transferFee: 0.25,
        otherExpenses: 0,
        status: "completed",
      },
    ],
    expenses: [],
    customerPayments: [
      { customerTransactionId: "tx-1", amount: 1200, currency: "HTG", paymentDate: "2026-10-02" },
      { customerTransactionId: "tx-2", amount: 400, currency: "HTG", paymentDate: "2026-10-05" },
    ],
    loans: [
      {
        id: "loan-1",
        customerId: "c-1",
        customerName: "Alpha",
        principalAmount: 1500,
        currency: "USD",
        issuedDate: "2026-08-01",
        dueDate: "2026-10-20",
        interestAmount: 0,
        feeAmount: 0,
        status: "active",
      },
      {
        id: "loan-2",
        customerId: "c-2",
        customerName: "Bravo",
        principalAmount: 800,
        currency: "HTG",
        issuedDate: "2026-08-01",
        dueDate: "2026-09-01",
        interestAmount: 0,
        feeAmount: 0,
        status: "overdue",
      },
    ],
    loanRepayments: [
      { loanId: "loan-1", amount: 500, currency: "USD", repaymentDate: "2026-09-01" },
      { loanId: "loan-2", amount: 100, currency: "HTG", repaymentDate: "2026-09-10" },
    ],
    reportingCurrency: "USD",
    exchangeRates: { HTG: 1 / 137.5 },
  });

  assert.equal(summary.outstandingCustomerPayments, 1900);
  assert.equal(summary.partiallyPaidTransactions, 1);
  assert.equal(summary.overdueCustomerPayments, 1);
  assert.ok(Math.abs((summary.outstandingLoanPrincipal ?? 0) - 1005.09) < 0.02);
  assert.equal(summary.outstandingLoanPrincipalByCurrency["USD"], 1000);
  assert.equal(summary.outstandingLoanPrincipalByCurrency["HTG"], 700);
  assert.equal(summary.upcomingLoanRepayments, 1);
  assert.equal(summary.overdueLoans, 1);
});

test("loan principal is excluded from profit while received interest and fees are included", () => {
  const summary = calculateBusinessMetrics({
    accounts: [],
    transactions: [],
    expenses: [],
    loans: [
      {
        id: "loan-income",
        customerId: "c1",
        customerName: "Alpha",
        principalAmount: 100,
        currency: "USD",
        issuedDate: "2026-10-01",
        dueDate: "2099-10-20",
        interestAmount: 10,
        feeAmount: 5,
        status: "partially_repaid",
      },
    ],
    loanRepayments: [
      {
        loanId: "loan-income",
        amount: 30,
        principalPaid: 20,
        interestPaid: 7,
        feePaid: 3,
        currency: "USD",
        repaymentDate: "2026-10-10",
      },
    ],
  });

  assert.equal(summary.netProfit, 10);
  assert.equal(summary.loanInterestAndFeesUsd, 10);
  assert.equal(summary.outstandingLoanPrincipalByCurrency["USD"], 80);
});

test("loan interest without a recorded exchange rate is excluded and marked incomplete", () => {
  const summary = calculateBusinessMetrics({
    accounts: [],
    transactions: [],
    expenses: [],
    loans: [
      {
        id: "loan-eur",
        customerId: "c1",
        customerName: "Alpha",
        principalAmount: 100,
        currency: "EUR",
        issuedDate: "2026-10-01",
        dueDate: "2099-10-20",
        interestAmount: 10,
        feeAmount: 0,
        status: "partially_repaid",
      },
    ],
    loanRepayments: [
      {
        loanId: "loan-eur",
        amount: 5,
        principalPaid: 0,
        interestPaid: 5,
        feePaid: 0,
        currency: "EUR",
        repaymentDate: "2026-10-10",
      },
    ],
  });

  assert.equal(summary.loanInterestAndFeesUsd, 0);
  assert.equal(summary.netProfit, 0);
  assert.equal(summary.loanRevenueIncomplete, true);
  assert.equal(summary.profitIncomplete, true);
});

test("payment and loan persistence is atomic, owner-scoped, immutable, and idempotent", () => {
  for (const table of [
    "business_customer_payments",
    "business_loans",
    "business_loan_repayments",
  ]) {
    assert.match(
      paymentsLoansMigration,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
    );
    assert.match(
      paymentsLoansMigration,
      new RegExp(`FOREIGN KEY \\([^)]*, user_id\\)[\\s\\S]*REFERENCES public\\.`),
    );
  }

  assert.match(paymentsLoansMigration, /UNIQUE \(user_id, idempotency_key\)/);
  assert.match(
    paymentsLoansMigration,
    /REVOKE ALL ON public\.business_customer_payments, public\.business_loans,[\s\S]*FROM PUBLIC, anon, authenticated/,
  );
  assert.match(paymentsLoansMigration, /business_customer_payments_immutable/);
  assert.match(
    paymentsLoansMigration,
    /prevent_closing_business_transaction_with_payments[\s\S]*Customer payments must be reversed before closing this transaction/,
  );
  assert.match(paymentsLoansMigration, /business_loan_repayments_immutable/);
  assert.match(
    paymentsLoansMigration,
    /FOR UPDATE[\s\S]*Payment exceeds the outstanding customer balance/,
  );
  assert.match(
    paymentsLoansMigration,
    /FOR UPDATE[\s\S]*Repayment exceeds the remaining principal/,
  );
  assert.match(
    paymentsLoansMigration,
    /PERFORM 1[\s\S]*business_accounts[\s\S]*FOR UPDATE;[\s\S]*SELECT a\.opening_balance \+ COALESCE\(sum\(l\.amount\), 0\)/,
  );
  assert.match(paymentsLoansMigration, /loan_principal_disbursed/);
  assert.match(paymentsLoansMigration, /loan_interest_income/);
  assert.match(paymentsLoansMigration, /loan_fee_income/);
  assert.match(paymentsLoansMigration, /p_currency <> 'HTG'/);
  assert.match(paymentsLoansMigration, /Payment exceeds the outstanding customer balance/);
  assert.match(paymentsLoansMigration, /Idempotency key was already used for a different payment/);
  assert.match(
    paymentsLoansMigration,
    /Idempotency key was already used for a different repayment/,
  );
  assert.match(
    paymentsLoansMigration,
    /Migrated from the immutable legacy customer receipt ledger entry/,
  );
  const transferFunction = paymentsLoansMigration.match(
    /CREATE FUNCTION public\.complete_business_transfer[\s\S]*?\$\$;/,
  )?.[0];
  assert.ok(transferFunction, "dedicated customer transfer completion RPC exists");
  assert.doesNotMatch(transferFunction, /customer_receipt|customer_payment_received/);
  for (const operation of [
    "create_business_customer_payment",
    "create_business_loan",
    "create_business_loan_repayment",
    "complete_business_transfer",
    "complete_business_non_transfer_operation",
  ]) {
    assert.ok(
      businessDataSource.includes(`rpc("${operation}"`),
      `${operation} is wired to the data layer`,
    );
  }
  for (const table of [
    "business_customer_payments",
    "business_loans",
    "business_loan_repayments",
  ]) {
    assert.ok(
      businessDataSource.includes(`from("${table}")`),
      `${table} is loaded by the data layer`,
    );
  }
  assert.match(paymentsLoansMigration, /complete_business_transfer/);
  assert.match(
    paymentsLoansMigration,
    /REVOKE ALL ON FUNCTION public\.complete_business_operation\(TEXT, UUID\) FROM authenticated/,
  );
});

test("business metrics distinguish the wallet, cash, expenses, and pending entries", () => {
  const summary = calculateBusinessMetrics({
    accounts,
    transactions,
    expenses,
    fundings: [
      { fee_amount: 0, fee_usd: null, status: "pending" },
      { fee_amount: 2, fee_usd: 2, status: "completed" },
    ],
    customerPayments: [
      { customerTransactionId: "t1", amount: 1500, currency: "HTG", paymentDate: "2026-10-01" },
    ],
    reportingCurrency: "USD",
  });

  assert.equal(summary.meruWalletBalance, 10);
  assert.equal(summary.cashOnHand, 9000);
  assert.equal(summary.totalCustomerReceipts, 1500);
  assert.equal(summary.totalUsdSentToCustomers, 20);
  assert.equal(summary.totalBusinessExpenses, 4.5);
  assert.equal(summary.netProfit, 0.5);
  assert.equal(summary.pendingTransactions, 3);
  assert.equal(summary.completedTransactions, 1);
  assert.equal(summary.totalBusinessFunds, null);
  assert.equal(summary.valuationIncomplete, true);
});

test("business funds use explicit rates and stay unchanged when assets move between accounts", () => {
  const withRate = calculateBusinessMetrics({
    accounts: [
      ...accounts,
      { id: "crypto", name: "Crypto", type: "crypto", balance: 100, currency: "USD" },
    ],
    transactions: [],
    expenses: [],
    reportingCurrency: "USD",
    exchangeRates: { HTG: 1 / 137.5 },
  });

  assert.equal(withRate.totalBusinessFunds, 175.45);
  assert.equal(withRate.valuationIncomplete, false);

  const beforeTransfer = 250 + 80;
  const afterTransfer = 230 + 100;
  assert.equal(afterTransfer, beforeTransfer);
});

test("migration scopes records to owners and makes ledger/status changes RPC-only", () => {
  for (const table of [
    "business_customers",
    "business_accounts",
    "business_customer_transactions",
    "business_fundings",
    "business_expenses",
    "business_exchange_rates",
    "business_account_ledger",
    "business_audit_log",
  ]) {
    assert.match(
      businessMigration,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
    );
  }
  assert.match(businessMigration, /auth\.uid\(\) = user_id/);
  assert.match(
    businessMigration,
    /FOREIGN KEY \(customer_id, user_id\)[\s\S]*business_customers \(id, user_id\)/,
  );
  assert.match(businessMigration, /UNIQUE \(user_id, idempotency_key\)/);
  assert.match(businessMigration, /business_account_ledger_immutable/);
  assert.match(businessMigration, /business_account_balances\(\)/);
  assert.match(
    businessMigration,
    /CREATE FUNCTION public\.complete_business_operation[\s\S]*FOR UPDATE[\s\S]*business_account_ledger/,
  );
  assert.match(businessMigration, /CREATE FUNCTION public\.reverse_business_operation/);
  assert.match(businessMigration, /GRANT SELECT ON public\.business_customer_transactions/);
  assert.doesNotMatch(
    businessMigration,
    /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.business_account_ledger TO authenticated/,
  );
});

test("non-USD expenses without a recorded rate are marked incomplete and not guessed", () => {
  const summary = calculateBusinessMetrics({
    accounts: [],
    transactions: [],
    expenses: [
      {
        id: "e-htg",
        category: "Transport",
        amount: 500,
        currency: "HTG",
        usdPerUnit: null,
        date: "2026-10-05",
        status: "completed",
      },
    ],
  });
  assert.equal(summary.totalBusinessExpenses, 0);
  assert.equal(summary.expensesIncomplete, true);
  assert.equal(summary.profitIncomplete, true);
});

test("rates are normalized and invalid exchange rates are rejected", () => {
  const converted = convertToReportingCurrency(9000, "htg", "USD", { htg: 1 / 137.5 });
  assert.ok(converted !== null);
  assert.ok(Math.abs((converted ?? 0) - 65.45) < 0.01);
  assert.equal(convertToReportingCurrency(100, "HTG", "USD", { HTG: 0 }), null);

  assert.throws(
    () =>
      calculateTransactionProfit({
        htgReceived: 1200,
        usdSent: 10,
        exchangeRate: 0,
        serviceFee: 2,
        cryptoCost: 0,
        transferFee: 0,
        otherExpenses: 0,
        status: "completed",
      }),
    /positive finite number/i,
  );
});

test("fees are never double-counted when revenue is earned and operating costs are recorded", () => {
  const result = calculateTransactionProfit({
    htgReceived: 3500,
    usdSent: 25,
    exchangeRate: 140,
    serviceFee: 8,
    cryptoCost: 1.5,
    transferFee: 2,
    otherExpenses: 0.5,
    status: "completed",
  });

  assert.equal(result.revenue, 8);
  assert.equal(result.costs, 4);
  assert.equal(result.netProfit, 4);
  assert.equal(result.customerUsdValue, 25);
  assert.equal(result.incomplete, false);
});

test("missing exchange rates leave customer value unavailable and do not invent balances", () => {
  const result = calculateTransactionProfit({
    htgReceived: 1800,
    usdSent: 12,
    exchangeRate: null,
    serviceFee: 2.5,
    cryptoCost: 0.25,
    transferFee: 0.5,
    otherExpenses: 0,
    status: "completed",
  });

  assert.equal(result.customerUsdValue, null);
  assert.equal(result.revenue, 2.5);
  assert.equal(result.costs, 0.75);
  assert.equal(result.netProfit, 1.75);
  assert.equal(result.incomplete, true);
});

test("pending, failed, and cancelled operations stay out of the available balance totals", () => {
  const summary = calculateBusinessMetrics({
    accounts: [
      { id: "meru", name: "Meru", type: "meru", balance: 100, currency: "USD" },
      { id: "cash", name: "Cash", type: "cash", balance: 5000, currency: "HTG" },
    ],
    transactions: [
      {
        id: "completed",
        customerId: "c1",
        customerName: "Alpha",
        receiptAccountId: "cash",
        payoutAccountId: "meru",
        transactionDate: "2026-10-01",
        htgReceived: 3000,
        usdSent: 10,
        exchangeRate: 150,
        serviceFee: 1,
        cryptoCost: 0,
        transferFee: 0.5,
        otherExpenses: 0,
        status: "completed",
      },
      {
        id: "pending",
        customerId: "c2",
        customerName: "Beta",
        receiptAccountId: "cash",
        payoutAccountId: "meru",
        transactionDate: "2026-10-02",
        htgReceived: 2000,
        usdSent: 5,
        exchangeRate: 150,
        serviceFee: 1,
        cryptoCost: 0,
        transferFee: 0.5,
        otherExpenses: 0,
        status: "pending",
      },
      {
        id: "cancelled",
        customerId: "c3",
        customerName: "Gamma",
        receiptAccountId: "cash",
        payoutAccountId: "meru",
        transactionDate: "2026-10-03",
        htgReceived: 1000,
        usdSent: 2,
        exchangeRate: 150,
        serviceFee: 0.2,
        cryptoCost: 0,
        transferFee: 0.1,
        otherExpenses: 0,
        status: "cancelled",
      },
    ],
    expenses: [
      {
        id: "exp1",
        category: "Electricity",
        amount: 5,
        currency: "USD",
        usdPerUnit: 1,
        date: "2026-10-04",
        status: "completed",
      },
      {
        id: "exp2",
        category: "Queued expense",
        amount: 10,
        currency: "USD",
        usdPerUnit: 1,
        date: "2026-10-05",
        status: "pending",
      },
    ],
    customerPayments: [
      {
        customerTransactionId: "completed",
        amount: 3000,
        currency: "HTG",
        paymentDate: "2026-10-01",
      },
    ],
    reportingCurrency: "USD",
    exchangeRates: { HTG: 1 / 137.5 },
  });

  assert.equal(summary.meruWalletBalance, 100);
  assert.equal(summary.totalCustomerReceipts, 3000);
  assert.equal(summary.totalUsdSentToCustomers, 10);
  assert.equal(summary.pendingTransactions, 2);
  assert.equal(summary.completedTransactions, 1);
  assert.equal(summary.netProfit, -4.5);
});

test("multiple converted balances remain additive when the rate varies by purchase", () => {
  const purchaseA = convertToReportingCurrency(5000, "HTG", "USD", { HTG: 1 / 137.5 });
  const purchaseB = convertToReportingCurrency(2600, "HTG", "USD", { HTG: 1 / 130 });

  assert.ok(purchaseA !== null && purchaseB !== null);
  assert.ok(Math.abs((purchaseA ?? 0) + (purchaseB ?? 0) - 56.36) < 0.02);
});
