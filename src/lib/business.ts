export type BusinessCurrency = "USD" | "HTG" | "EUR";
export type BusinessTransactionStatus =
  "pending" | "completed" | "failed" | "cancelled" | "reversed";

export type BusinessAccount = {
  id: string;
  name: string;
  type: "meru" | "cash" | "crypto" | "other";
  balance: number;
  currency: string;
};

export type BusinessCustomer = {
  id: string;
  name: string;
  nickname?: string;
  contact?: string;
  notes?: string;
  createdAt: string;
};

export type BusinessTransaction = {
  id: string;
  customerId: string;
  customerName: string;
  receiptAccountId: string;
  payoutAccountId: string;
  transactionDate: string;
  htgReceived: number;
  usdSent: number;
  exchangeRate: number | null;
  serviceFee: number | null;
  cryptoCost: number | null;
  transferFee: number;
  otherExpenses: number | null;
  reference?: string;
  notes?: string;
  status: BusinessTransactionStatus;
};

export type BusinessExpense = {
  id: string;
  category: string;
  amount: number;
  currency: string;
  usdPerUnit: number | null;
  date: string;
  status: BusinessTransactionStatus;
  notes?: string;
};

export type BusinessLedgerEntry = {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  status: BusinessTransactionStatus;
  recordedAt: string;
};

export type BusinessMetrics = {
  meruWalletBalance: number;
  totalBusinessFunds: number | null;
  cashOnHand: number;
  totalCustomerReceipts: number;
  totalUsdSentToCustomers: number;
  totalBusinessExpenses: number;
  netProfit: number;
  pendingTransactions: number;
  completedTransactions: number;
  totalAccounts: number;
  valuationIncomplete: boolean;
  expensesIncomplete: boolean;
  profitIncomplete: boolean;
};

export type TransactionProfitResult = {
  revenue: number;
  costs: number;
  netProfit: number;
  customerUsdValue: number | null;
  incomplete: boolean;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ensureNonNegative(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${fieldName} must be finite and non-negative.`);
  }
}

export function convertToReportingCurrency(
  amount: number,
  currency: string,
  reportingCurrency: BusinessCurrency,
  usdPerUnit: Partial<Record<string, number>>,
): number | null {
  if (currency === reportingCurrency) return amount;
  const valueInUsd = currency === "USD" ? 1 : usdPerUnit[currency];
  const reportingCurrencyInUsd = reportingCurrency === "USD" ? 1 : usdPerUnit[reportingCurrency];
  if (
    typeof valueInUsd !== "number" ||
    !Number.isFinite(valueInUsd) ||
    valueInUsd <= 0 ||
    typeof reportingCurrencyInUsd !== "number" ||
    !Number.isFinite(reportingCurrencyInUsd) ||
    reportingCurrencyInUsd <= 0
  ) {
    return null;
  }
  return (amount * valueInUsd) / reportingCurrencyInUsd;
}

export function calculateAccountBalance(
  openingBalance: number,
  ledgerEntries: Pick<BusinessLedgerEntry, "amount" | "status">[],
) {
  ensureNonNegative(openingBalance, "Opening balance");

  const completedEntries = ledgerEntries.filter((entry) => entry.status === "completed");
  const pendingEntries = ledgerEntries.filter((entry) => entry.status === "pending");
  const failedEntries = ledgerEntries.filter(
    (entry) => entry.status === "failed" || entry.status === "cancelled",
  );

  for (const entry of ledgerEntries) {
    if (!Number.isFinite(entry.amount)) {
      throw new RangeError(`Ledger entry amount (${entry.status}) must be finite.`);
    }
  }

  const availableBalance = completedEntries.reduce(
    (balance, entry) => balance + Number(entry.amount),
    openingBalance,
  );
  const pendingImpact = pendingEntries.reduce((total, entry) => total + Number(entry.amount), 0);
  const failedImpact = failedEntries.reduce(
    (total, entry) => total + Math.abs(Number(entry.amount)),
    0,
  );

  return {
    openingBalance: roundMoney(openingBalance),
    availableBalance: roundMoney(availableBalance),
    pendingImpact: roundMoney(pendingImpact),
    failedImpact: roundMoney(failedImpact),
  };
}

export function calculateTransactionProfit(
  transaction: Pick<
    BusinessTransaction,
    | "htgReceived"
    | "usdSent"
    | "exchangeRate"
    | "serviceFee"
    | "cryptoCost"
    | "transferFee"
    | "otherExpenses"
    | "status"
  >,
): TransactionProfitResult {
  ensureNonNegative(transaction.htgReceived, "HTG received");
  ensureNonNegative(transaction.usdSent, "USD sent");
  if (transaction.cryptoCost !== null) ensureNonNegative(transaction.cryptoCost, "Crypto cost");
  ensureNonNegative(transaction.transferFee, "Transfer fee");
  if (transaction.otherExpenses !== null) {
    ensureNonNegative(transaction.otherExpenses, "Other expenses");
  }

  const customerUsdValue =
    transaction.exchangeRate && transaction.exchangeRate > 0
      ? roundMoney(transaction.htgReceived / transaction.exchangeRate)
      : null;

  const revenue =
    transaction.serviceFee !== null && typeof transaction.serviceFee === "number"
      ? roundMoney(transaction.serviceFee)
      : customerUsdValue !== null
        ? roundMoney(Math.max(0, customerUsdValue - transaction.usdSent))
        : 0;

  const costs = roundMoney(
    (transaction.cryptoCost ?? 0) + transaction.transferFee + (transaction.otherExpenses ?? 0),
  );

  const netProfit = roundMoney(revenue - costs);
  const incomplete =
    transaction.status === "completed"
      ? transaction.exchangeRate === null ||
        transaction.serviceFee === null ||
        transaction.cryptoCost === null ||
        transaction.otherExpenses === null
      : false;

  return {
    revenue: roundMoney(revenue),
    costs,
    netProfit,
    customerUsdValue,
    incomplete,
  };
}

export function calculateCustomerPerformance(
  customerId: string,
  transactions: BusinessTransaction[],
) {
  const matches = transactions.filter((transaction) => transaction.customerId === customerId);

  const completedMatches = matches.filter((transaction) => transaction.status === "completed");
  const totalHtgReceived = completedMatches.reduce(
    (sum, transaction) => sum + transaction.htgReceived,
    0,
  );
  const totalUsdSent = completedMatches.reduce((sum, transaction) => sum + transaction.usdSent, 0);
  const totalFees = completedMatches.reduce(
    (sum, transaction) =>
      sum +
      (transaction.cryptoCost ?? 0) +
      transaction.transferFee +
      (transaction.otherExpenses ?? 0),
    0,
  );
  const estimatedProfit = completedMatches.reduce(
    (sum, transaction) => sum + calculateTransactionProfit(transaction).netProfit,
    0,
  );

  return {
    customerId,
    totalHtgReceived: roundMoney(totalHtgReceived),
    totalUsdSent: roundMoney(totalUsdSent),
    totalFees: roundMoney(totalFees),
    estimatedProfit: roundMoney(estimatedProfit),
    transactionCount: matches.length,
  };
}

export function calculateBusinessMetrics({
  accounts,
  transactions,
  expenses,
  fundings = [],
  reportingCurrency = "USD",
  exchangeRates = {},
}: {
  accounts: BusinessAccount[];
  transactions: BusinessTransaction[];
  expenses: BusinessExpense[];
  fundings?: { fee_amount: number; fee_usd: number | null; status: string }[];
  reportingCurrency?: BusinessCurrency;
  exchangeRates?: Partial<Record<string, number>>;
}): BusinessMetrics {
  const meruBalance = accounts
    .filter((account) => account.type === "meru" && account.currency === "USD")
    .reduce((sum, account) => sum + account.balance, 0);
  const cashOnHand = accounts
    .filter((account) => account.type === "cash" && account.currency === "HTG")
    .reduce((sum, account) => sum + account.balance, 0);

  let valuationIncomplete = false;
  const totalBusinessFunds = accounts.reduce<number | null>((total, account) => {
    const value = convertToReportingCurrency(
      account.balance,
      account.currency,
      reportingCurrency,
      exchangeRates,
    );
    if (value === null) {
      valuationIncomplete = true;
      return total;
    }
    return total === null ? value : total + value;
  }, null);

  const completedTransactions = transactions.filter(
    (transaction) => transaction.status === "completed",
  );
  const pendingTransactions =
    transactions.filter((transaction) => transaction.status === "pending").length +
    fundings.filter((funding) => funding.status === "pending").length +
    expenses.filter((expense) => expense.status === "pending").length;
  const totalCustomerReceipts = completedTransactions.reduce(
    (sum, transaction) => sum + transaction.htgReceived,
    0,
  );
  const totalUsdSentToCustomers = completedTransactions.reduce(
    (sum, transaction) => sum + transaction.usdSent,
    0,
  );
  let expensesIncomplete = false;
  const recordedExpensesUsd = expenses.reduce((sum, expense) => {
    if (expense.status !== "completed") return sum;
    const usdPerUnit = expense.currency === "USD" ? 1 : expense.usdPerUnit;
    if (usdPerUnit === null || !Number.isFinite(usdPerUnit) || usdPerUnit <= 0) {
      expensesIncomplete = true;
      return sum;
    }
    return sum + expense.amount * usdPerUnit;
  }, 0);
  const completedFundings = fundings.filter((funding) => funding.status === "completed");
  const fundingFeesUsd = completedFundings.reduce((sum, funding) => {
    if (funding.fee_amount === 0) return sum;
    if (funding.fee_usd === null || !Number.isFinite(funding.fee_usd)) {
      expensesIncomplete = true;
      return sum;
    }
    return sum + funding.fee_usd;
  }, 0);
  const totalBusinessExpenses =
    recordedExpensesUsd +
    fundingFeesUsd +
    completedTransactions.reduce(
      (sum, transaction) =>
        sum +
        (transaction.cryptoCost ?? 0) +
        transaction.transferFee +
        (transaction.otherExpenses ?? 0),
      0,
    );
  const netProfit =
    completedTransactions.reduce(
      (sum, transaction) => sum + calculateTransactionProfit(transaction).netProfit,
      0,
    ) -
    recordedExpensesUsd -
    fundingFeesUsd;
  const profitIncomplete =
    completedTransactions.some(
      (transaction) => calculateTransactionProfit(transaction).incomplete,
    ) || expensesIncomplete;

  return {
    meruWalletBalance: roundMoney(meruBalance),
    totalBusinessFunds:
      totalBusinessFunds === null || valuationIncomplete ? null : roundMoney(totalBusinessFunds),
    cashOnHand: roundMoney(cashOnHand),
    totalCustomerReceipts: roundMoney(totalCustomerReceipts),
    totalUsdSentToCustomers: roundMoney(totalUsdSentToCustomers),
    totalBusinessExpenses: roundMoney(totalBusinessExpenses),
    netProfit: roundMoney(netProfit),
    pendingTransactions,
    completedTransactions: completedTransactions.length,
    totalAccounts: accounts.length,
    valuationIncomplete,
    expensesIncomplete,
    profitIncomplete,
  };
}

export function formatBusinessMoney(value: number, currency: string = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return `${value.toFixed(2)} ${currency}`;
  }
}
