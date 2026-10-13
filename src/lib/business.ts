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
  dueDate?: string | null;
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

export type BusinessPaymentStatus = "unpaid" | "partially_paid" | "fully_paid" | "overdue";
export type BusinessPaymentMethod = "cash" | "moncash" | "natcash" | "other";

export type BusinessPayment = {
  id: string;
  customerTransactionId: string;
  accountId: string;
  amount: number;
  currency: string;
  paymentMethod: BusinessPaymentMethod;
  paymentDate: string;
  reference?: string;
  notes?: string;
  createdAt: string;
};

export type BusinessLoanStatus = "active" | "partially_repaid" | "repaid" | "overdue";

export type BusinessLoan = {
  id: string;
  customerId: string;
  customerName: string;
  accountId: string;
  principalAmount: number;
  currency: string;
  issuedDate: string;
  dueDate: string | null;
  interestAmount: number;
  feeAmount: number;
  status: BusinessLoanStatus;
  notes?: string;
  createdAt: string;
};

export type BusinessLoanRepayment = {
  id: string;
  loanId: string;
  accountId: string;
  amount: number;
  principalPaid: number;
  interestPaid: number;
  feePaid: number;
  currency: string;
  repaymentDate: string;
  reference?: string;
  notes?: string;
  createdAt: string;
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
  outstandingCustomerPayments: number;
  partiallyPaidTransactions: number;
  overdueCustomerPayments: number;
  outstandingLoanPrincipal: number | null;
  outstandingLoanPrincipalByCurrency: Record<string, number>;
  upcomingLoanRepayments: number;
  overdueLoans: number;
  loanInterestAndFeesUsd: number;
  loanRevenueIncomplete: boolean;
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

function normalizeCurrencyCode(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized || undefined;
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
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const normalizedReportingCurrency = normalizeCurrencyCode(reportingCurrency);
  if (!normalizedCurrency || !normalizedReportingCurrency) return null;
  if (normalizedCurrency === normalizedReportingCurrency) return amount;

  const normalizedUsdPerUnit = Object.fromEntries(
    Object.entries(usdPerUnit).map(([code, value]) => [normalizeCurrencyCode(code), value]),
  ) as Partial<Record<string, number>>;

  const valueInUsd = normalizedCurrency === "USD" ? 1 : normalizedUsdPerUnit[normalizedCurrency];
  const reportingCurrencyInUsd =
    normalizedReportingCurrency === "USD" ? 1 : normalizedUsdPerUnit[normalizedReportingCurrency];

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
  if (transaction.exchangeRate !== null && transaction.exchangeRate !== undefined) {
    if (!Number.isFinite(transaction.exchangeRate) || transaction.exchangeRate <= 0) {
      throw new RangeError("Exchange rate must be a positive finite number.");
    }
  }
  if (transaction.cryptoCost !== null) ensureNonNegative(transaction.cryptoCost, "Crypto cost");
  ensureNonNegative(transaction.transferFee, "Transfer fee");
  if (transaction.otherExpenses !== null) {
    ensureNonNegative(transaction.otherExpenses, "Other expenses");
  }

  const customerUsdValue =
    transaction.exchangeRate !== null && transaction.exchangeRate !== undefined
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

export function calculateCustomerPaymentSummary(
  transaction: Pick<BusinessTransaction, "htgReceived" | "dueDate" | "transactionDate">,
  payments: Pick<BusinessPayment, "amount" | "paymentDate">[] = [],
): { totalPaid: number; outstanding: number; status: BusinessPaymentStatus } {
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = Math.max(0, transaction.htgReceived - totalPaid);
  const dueDate = transaction.dueDate ? new Date(transaction.dueDate) : null;
  const dueDateKey = transaction.dueDate?.slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const isOverdue =
    dueDate !== null &&
    !Number.isNaN(dueDate.getTime()) &&
    totalPaid < transaction.htgReceived &&
    Boolean(dueDateKey && dueDateKey < todayKey);

  let status: BusinessPaymentStatus = "unpaid";
  if (totalPaid >= transaction.htgReceived) {
    status = "fully_paid";
  } else if (totalPaid > 0) {
    status = isOverdue ? "overdue" : "partially_paid";
  } else if (isOverdue) {
    status = "overdue";
  }

  return {
    totalPaid: roundMoney(totalPaid),
    outstanding: roundMoney(outstanding),
    status,
  };
}

export function calculateLoanSummary(
  loan: Pick<BusinessLoan, "principalAmount" | "currency" | "dueDate" | "status" | "issuedDate"> &
    Partial<Pick<BusinessLoan, "interestAmount" | "feeAmount">>,
  repayments: (Pick<BusinessLoanRepayment, "amount" | "currency" | "repaymentDate"> &
    Partial<Pick<BusinessLoanRepayment, "principalPaid" | "interestPaid" | "feePaid">>)[] = [],
): {
  totalRepaid: number;
  outstandingPrincipal: number;
  isOverdue: boolean;
  nextRepayment: number;
  currency: string;
} {
  const currencyRepayments = repayments.filter((repayment) => repayment.currency === loan.currency);
  const totalRepaid = currencyRepayments.reduce((sum, repayment) => sum + repayment.amount, 0);
  const principalRepaid = currencyRepayments.reduce(
    (sum, repayment) => sum + (repayment.principalPaid ?? repayment.amount),
    0,
  );
  const outstandingPrincipal = Math.max(0, loan.principalAmount - principalRepaid);
  const dueDate = loan.dueDate ? new Date(loan.dueDate) : null;
  const dueDateKey = loan.dueDate?.slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const interestPaid = currencyRepayments.reduce(
    (sum, repayment) => sum + (repayment.interestPaid ?? 0),
    0,
  );
  const feePaid = currencyRepayments.reduce((sum, repayment) => sum + (repayment.feePaid ?? 0), 0);
  const totalOutstanding =
    outstandingPrincipal +
    Math.max(0, (loan.interestAmount ?? 0) - interestPaid) +
    Math.max(0, (loan.feeAmount ?? 0) - feePaid);
  const isOverdue =
    dueDate !== null &&
    !Number.isNaN(dueDate.getTime()) &&
    totalOutstanding > 0 &&
    Boolean(dueDateKey && dueDateKey < todayKey);

  return {
    totalRepaid: roundMoney(totalRepaid),
    outstandingPrincipal: roundMoney(outstandingPrincipal),
    isOverdue,
    nextRepayment: roundMoney(totalOutstanding),
    currency: loan.currency,
  };
}

export function calculateBusinessMetrics({
  accounts,
  transactions,
  expenses,
  fundings = [],
  customerPayments = [],
  loans = [],
  loanRepayments = [],
  reportingCurrency = "USD",
  exchangeRates = {},
}: {
  accounts: BusinessAccount[];
  transactions: BusinessTransaction[];
  expenses: BusinessExpense[];
  fundings?: { fee_amount: number; fee_usd: number | null; status: string }[];
  customerPayments?: Pick<
    BusinessPayment,
    "customerTransactionId" | "amount" | "currency" | "paymentDate"
  >[];
  loans?: Pick<
    BusinessLoan,
    | "id"
    | "customerId"
    | "customerName"
    | "principalAmount"
    | "currency"
    | "issuedDate"
    | "dueDate"
    | "interestAmount"
    | "feeAmount"
    | "status"
  >[];
  loanRepayments?: (Pick<
    BusinessLoanRepayment,
    "loanId" | "amount" | "currency" | "repaymentDate"
  > &
    Partial<Pick<BusinessLoanRepayment, "principalPaid" | "interestPaid" | "feePaid">>)[];
  reportingCurrency?: BusinessCurrency;
  exchangeRates?: Partial<Record<string, number>>;
}): BusinessMetrics {
  const meruBalance = accounts
    .filter(
      (account) => account.type === "meru" && normalizeCurrencyCode(account.currency) === "USD",
    )
    .reduce((sum, account) => sum + account.balance, 0);
  const cashOnHand = accounts
    .filter(
      (account) => account.type === "cash" && normalizeCurrencyCode(account.currency) === "HTG",
    )
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
  const totalCustomerReceipts = customerPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalUsdSentToCustomers = completedTransactions.reduce(
    (sum, transaction) => sum + transaction.usdSent,
    0,
  );
  let expensesIncomplete = false;
  const recordedExpensesUsd = expenses.reduce((sum, expense) => {
    if (expense.status !== "completed") return sum;
    const normalizedCurrency = normalizeCurrencyCode(expense.currency);
    const usdPerUnit = normalizedCurrency === "USD" ? 1 : expense.usdPerUnit;
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
  const customerPaymentSummaries = transactions.map((transaction) => {
    const payments = customerPayments.filter(
      (payment) => payment.customerTransactionId === transaction.id,
    );
    return {
      transaction,
      summary: calculateCustomerPaymentSummary(
        {
          htgReceived: transaction.htgReceived,
          dueDate: transaction.dueDate ?? null,
          transactionDate: transaction.transactionDate,
        },
        payments,
      ),
    };
  });

  const eligiblePaymentSummaries = customerPaymentSummaries.filter(
    (entry) =>
      entry.transaction.status !== "failed" &&
      entry.transaction.status !== "cancelled" &&
      entry.transaction.status !== "reversed",
  );
  const outstandingCustomerPayments = eligiblePaymentSummaries.reduce(
    (sum, entry) => sum + entry.summary.outstanding,
    0,
  );
  const partiallyPaidTransactions = eligiblePaymentSummaries.filter(
    (entry) => entry.summary.status === "partially_paid",
  ).length;
  const overdueCustomerPayments = eligiblePaymentSummaries.filter(
    (entry) => entry.summary.status === "overdue",
  ).length;

  const activeLoans = loans.filter((loan) =>
    ["active", "partially_repaid", "overdue"].includes(loan.status),
  );
  const outstandingLoanPrincipalByCurrency = activeLoans.reduce<Record<string, number>>(
    (result, loan) => {
      const repayments = loanRepayments.filter(
        (repayment) => repayment.loanId === loan.id && repayment.currency === loan.currency,
      );
      const principalRepaid = repayments.reduce(
        (sum, repayment) => sum + (repayment.principalPaid ?? repayment.amount),
        0,
      );
      const outstanding = Math.max(0, loan.principalAmount - principalRepaid);
      if (outstanding <= 0) return result;
      const key = normalizeCurrencyCode(loan.currency) ?? loan.currency;
      result[key] = (result[key] ?? 0) + outstanding;
      return result;
    },
    {},
  );
  let outstandingLoanPrincipal: number | null = 0;
  for (const [currency, amount] of Object.entries(outstandingLoanPrincipalByCurrency)) {
    const converted = convertToReportingCurrency(
      amount,
      currency,
      reportingCurrency,
      exchangeRates,
    );
    if (converted === null) {
      outstandingLoanPrincipal = null;
      break;
    }
    outstandingLoanPrincipal += converted;
  }
  const today = new Date().toISOString().slice(0, 10);
  const upcomingLimit = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upcomingLoanRepayments = activeLoans.filter((loan) => {
    const repayments = loanRepayments.filter(
      (repayment) => repayment.loanId === loan.id && repayment.currency === loan.currency,
    );
    const principalRepaid = repayments.reduce(
      (sum, repayment) => sum + (repayment.principalPaid ?? repayment.amount),
      0,
    );
    const interestRepaid = repayments.reduce(
      (sum, repayment) => sum + (repayment.interestPaid ?? 0),
      0,
    );
    const feesRepaid = repayments.reduce((sum, repayment) => sum + (repayment.feePaid ?? 0), 0);
    const outstanding =
      Math.max(0, loan.principalAmount - principalRepaid) +
      Math.max(0, loan.interestAmount - interestRepaid) +
      Math.max(0, loan.feeAmount - feesRepaid);
    if (outstanding <= 0) return false;
    if (!loan.dueDate) return false;
    return loan.dueDate >= today && loan.dueDate <= upcomingLimit;
  }).length;
  const overdueLoans = activeLoans.filter((loan) => {
    const repayments = loanRepayments.filter(
      (repayment) => repayment.loanId === loan.id && repayment.currency === loan.currency,
    );
    const principalRepaid = repayments.reduce(
      (sum, repayment) => sum + (repayment.principalPaid ?? repayment.amount),
      0,
    );
    const interestRepaid = repayments.reduce(
      (sum, repayment) => sum + (repayment.interestPaid ?? 0),
      0,
    );
    const feesRepaid = repayments.reduce((sum, repayment) => sum + (repayment.feePaid ?? 0), 0);
    const outstanding =
      Math.max(0, loan.principalAmount - principalRepaid) +
      Math.max(0, loan.interestAmount - interestRepaid) +
      Math.max(0, loan.feeAmount - feesRepaid);
    if (outstanding <= 0 || !loan.dueDate) return false;
    return loan.dueDate < today;
  }).length;
  let loanInterestAndFeesUsd = 0;
  let loanRevenueIncomplete = false;
  for (const repayment of loanRepayments) {
    const income = (repayment.interestPaid ?? 0) + (repayment.feePaid ?? 0);
    if (income === 0) continue;
    const converted = convertToReportingCurrency(income, repayment.currency, "USD", exchangeRates);
    if (converted === null) {
      loanRevenueIncomplete = true;
    } else {
      loanInterestAndFeesUsd += converted;
    }
  }
  const completeNetProfit = roundMoney(netProfit + loanInterestAndFeesUsd);
  const profitIncomplete =
    completedTransactions.some(
      (transaction) => calculateTransactionProfit(transaction).incomplete,
    ) ||
    expensesIncomplete ||
    loanRevenueIncomplete;

  return {
    meruWalletBalance: roundMoney(meruBalance),
    totalBusinessFunds:
      totalBusinessFunds === null || valuationIncomplete ? null : roundMoney(totalBusinessFunds),
    cashOnHand: roundMoney(cashOnHand),
    totalCustomerReceipts: roundMoney(totalCustomerReceipts),
    totalUsdSentToCustomers: roundMoney(totalUsdSentToCustomers),
    totalBusinessExpenses: roundMoney(totalBusinessExpenses),
    netProfit: completeNetProfit,
    pendingTransactions,
    completedTransactions: completedTransactions.length,
    totalAccounts: accounts.length,
    valuationIncomplete,
    expensesIncomplete,
    profitIncomplete,
    outstandingCustomerPayments: roundMoney(outstandingCustomerPayments),
    partiallyPaidTransactions,
    overdueCustomerPayments,
    outstandingLoanPrincipal:
      outstandingLoanPrincipal === null ? null : roundMoney(outstandingLoanPrincipal),
    outstandingLoanPrincipalByCurrency: Object.fromEntries(
      Object.entries(outstandingLoanPrincipalByCurrency).map(([currency, value]) => [
        currency,
        roundMoney(value),
      ]),
    ),
    upcomingLoanRepayments,
    overdueLoans,
    loanInterestAndFeesUsd: roundMoney(loanInterestAndFeesUsd),
    loanRevenueIncomplete,
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
