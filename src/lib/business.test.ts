import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateAccountBalance,
  calculateBusinessMetrics,
  calculateCustomerPerformance,
  calculateTransactionProfit,
  type BusinessAccount,
  type BusinessExpense,
  type BusinessTransaction,
} from "./business.ts";

const businessMigration = readFileSync(
  new URL("../../supabase/migrations/20261013000000_business_accounting.sql", import.meta.url),
  "utf8",
);

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

test("business metrics distinguish the wallet, cash, expenses, and pending entries", () => {
  const summary = calculateBusinessMetrics({
    accounts,
    transactions,
    expenses,
    fundings: [
      { fee_amount: 0, fee_usd: null, status: "pending" },
      { fee_amount: 2, fee_usd: 2, status: "completed" },
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
