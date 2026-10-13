import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  ChevronRight,
  CalendarDays,
  CircleDollarSign,
  Eye,
  EyeOff,
  HandCoins,
  Info,
  PiggyBank,
  Plus,
  Quote,
  Receipt,
  Search,
  TrendingUp,
  UsersRound,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calculateBusinessMetrics,
  calculateCustomerPaymentSummary,
  calculateCustomerPerformance,
  convertToReportingCurrency,
  calculateLoanSummary,
  calculateTransactionProfit,
  formatBusinessMoney,
  type BusinessCurrency,
  type BusinessTransaction,
} from "@/lib/business";
import {
  type BusinessRecords,
  useBusinessRecords,
  useCloseBusinessOperation,
  useCompleteBusinessOperation,
  useCreateBusinessAdjustment,
  useCreateBusinessAccount,
  useCreateBusinessCustomer,
  useCreateBusinessCustomerPayment,
  useCreateBusinessExpense,
  useCreateBusinessFunding,
  useCreateBusinessLoan,
  useCreateBusinessLoanRepayment,
  useCreateBusinessTransaction,
  useReverseBusinessOperation,
  useSaveBusinessExchangeRate,
  useUpdateBusinessCustomer,
} from "@/lib/business-data";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Business — Nexora" },
      {
        name: "description",
        content: "Track customer receipts, wallet funding, expenses, and profit in one place.",
      },
      { property: "og:title", content: "Business — Nexora" },
      {
        property: "og:description",
        content:
          "Manual business accounting and reporting for cash, Meru, and customer operations.",
      },
    ],
  }),
  component: BusinessPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${today().slice(0, 7)}-01`;
const EMPTY_TRANSACTIONS: BusinessRecords["transactions"] = [];
const EMPTY_PAYMENTS: BusinessRecords["payments"] = [];
const EMPTY_LOANS: BusinessRecords["loans"] = [];
const EMPTY_LOAN_REPAYMENTS: BusinessRecords["loanRepayments"] = [];
const EMPTY_FUNDINGS: BusinessRecords["fundings"] = [];
const EMPTY_EXPENSES: BusinessRecords["expenses"] = [];
const REPORT_CHART_COLORS = ["#10c6bd", "#398df7", "#9361f4", "#f29f3d", "#8ca7c7", "#ed5267"];

type DashboardActivity = {
  id: string;
  title: string;
  detail: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  direction: "in" | "out";
};

function readText(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function readNumber(data: FormData, key: string, optional = false): number | null {
  const value = readText(data, key);
  if (optional && value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RangeError("Enter a valid non-negative amount.");
  }
  return parsed;
}

function readSignedNumber(data: FormData, key: string) {
  const value = Number(readText(data, key));
  if (!Number.isFinite(value) || value === 0) {
    throw new RangeError("Enter a non-zero finite adjustment amount.");
  }
  return value;
}

function dateTimeValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Choose a valid transaction date.");
  return date.toISOString();
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const statusClass = ["completed", "fully_paid", "repaid", "received"].includes(normalizedStatus)
    ? "border-emerald-500/20 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
    : ["failed", "cancelled", "reversed", "overdue"].includes(normalizedStatus)
      ? "border-rose-500/20 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
      : ["pending", "partially_paid", "partially_repaid", "upcoming", "active"].includes(
            normalizedStatus,
          )
        ? "border-amber-500/20 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        : "border-blue-500/20 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";

  return (
    <Badge variant="outline" className={`whitespace-nowrap capitalize ${statusClass}`}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function loanAmountsDue(
  loan: BusinessRecords["loans"][number],
  repayments: BusinessRecords["loanRepayments"],
) {
  const entries = repayments.filter((repayment) => repayment.loanId === loan.id);
  return {
    principal: Math.max(
      0,
      loan.principalAmount - entries.reduce((sum, repayment) => sum + repayment.principalPaid, 0),
    ),
    interest: Math.max(
      0,
      loan.interestAmount - entries.reduce((sum, repayment) => sum + repayment.interestPaid, 0),
    ),
    fee: Math.max(
      0,
      loan.feeAmount - entries.reduce((sum, repayment) => sum + repayment.feePaid, 0),
    ),
  };
}

function BusinessPage() {
  const recordsQuery = useBusinessRecords();
  const createCustomer = useCreateBusinessCustomer();
  const createAccount = useCreateBusinessAccount();
  const createTransaction = useCreateBusinessTransaction();
  const createPayment = useCreateBusinessCustomerPayment();
  const createLoan = useCreateBusinessLoan();
  const createLoanRepayment = useCreateBusinessLoanRepayment();
  const createFunding = useCreateBusinessFunding();
  const createExpense = useCreateBusinessExpense();
  const createAdjustment = useCreateBusinessAdjustment();
  const updateCustomer = useUpdateBusinessCustomer();
  const completeOperation = useCompleteBusinessOperation();
  const closeOperation = useCloseBusinessOperation();
  const reverseOperation = useReverseBusinessOperation();
  const saveRate = useSaveBusinessExchangeRate();
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPaymentFilter, setCustomerPaymentFilter] = useState("all");
  const [customerActivityFilter, setCustomerActivityFilter] = useState("all");
  const [customerPage, setCustomerPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [transactionAccountFilter, setTransactionAccountFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [reportingCurrency, setReportingCurrency] = useState<BusinessCurrency>("USD");
  const [activeTab, setActiveTab] = useState("overview");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [meruBalanceVisible, setMeruBalanceVisible] = useState(true);
  const [entryType, setEntryType] = useState<"transfer" | "deposit" | "loan">("transfer");
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [selectedTransactionCustomerId, setSelectedTransactionCustomerId] = useState("");
  const [selectedFundingAccountId, setSelectedFundingAccountId] = useState("");
  const [selectedLoanAccountId, setSelectedLoanAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFee, setTransferFee] = useState("0");
  const [transferHtgDue, setTransferHtgDue] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [fundingCreditedAmount, setFundingCreditedAmount] = useState("");
  const [fundingFee, setFundingFee] = useState("0");
  const [loanPrincipalAmount, setLoanPrincipalAmount] = useState("");
  const [loanInterestAmount, setLoanInterestAmount] = useState("0");
  const [loanFeeAmount, setLoanFeeAmount] = useState("0");
  const idempotencyKeys = useRef(new WeakMap<HTMLFormElement, string>());

  function idempotencyKey(form: HTMLFormElement) {
    let key = idempotencyKeys.current.get(form);
    if (!key) {
      key = crypto.randomUUID();
      idempotencyKeys.current.set(form, key);
    }
    return key;
  }

  function clearIdempotencyKey(form: HTMLFormElement) {
    idempotencyKeys.current.delete(form);
  }

  function openEntryForm(type: "transfer" | "deposit" | "loan") {
    setEntryType(type);
    setSelectedTransactionCustomerId(customers[0]?.id ?? "");
    setSelectedFundingAccountId(accounts[0]?.id ?? "");
    setSelectedLoanAccountId(accounts[0]?.id ?? "");
    setTransferAmount("");
    setTransferFee("0");
    setTransferHtgDue("");
    setTransferNotes("");
    setFundingCreditedAmount("");
    setFundingFee("0");
    setLoanPrincipalAmount("");
    setLoanInterestAmount("0");
    setLoanFeeAmount("0");
    setEntryDialogOpen(true);
  }

  const records = recordsQuery.data;
  const accounts = records?.accounts ?? [];
  const customers = records?.customers ?? [];
  const transactions = records?.transactions ?? EMPTY_TRANSACTIONS;
  const payments = records?.payments ?? EMPTY_PAYMENTS;
  const loans = records?.loans ?? EMPTY_LOANS;
  const loanRepayments = records?.loanRepayments ?? EMPTY_LOAN_REPAYMENTS;
  const fundings = records?.fundings ?? EMPTY_FUNDINGS;
  const expenses = records?.expenses ?? EMPTY_EXPENSES;
  const ledger = records?.ledger ?? [];

  const rates = useMemo(() => {
    const result: Record<string, number> = {};
    for (const rate of records?.exchangeRates ?? []) {
      if (!(rate.currency in result)) result[rate.currency] = Number(rate.usd_per_unit);
    }
    return result;
  }, [records?.exchangeRates]);

  const periodTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const date = transaction.transactionDate.slice(0, 10);
        return date >= startDate && date <= endDate;
      }),
    [endDate, startDate, transactions],
  );
  const periodExpenses = useMemo(
    () => expenses.filter((expense) => expense.date >= startDate && expense.date <= endDate),
    [endDate, expenses, startDate],
  );
  const periodFundings = useMemo(
    () =>
      fundings.filter((funding) => {
        const date = funding.funding_date.slice(0, 10);
        return date >= startDate && date <= endDate;
      }),
    [endDate, fundings, startDate],
  );
  const periodPayments = useMemo(
    () =>
      payments.filter(
        (payment) => payment.paymentDate >= startDate && payment.paymentDate <= endDate,
      ),
    [endDate, payments, startDate],
  );
  const periodLoanRepayments = useMemo(
    () =>
      loanRepayments.filter(
        (repayment) => repayment.repaymentDate >= startDate && repayment.repaymentDate <= endDate,
      ),
    [endDate, loanRepayments, startDate],
  );
  const metrics = calculateBusinessMetrics({
    accounts,
    transactions: periodTransactions,
    expenses: periodExpenses,
    fundings: periodFundings,
    customerPayments: periodPayments,
    loans,
    loanRepayments: periodLoanRepayments,
    reportingCurrency,
    exchangeRates: rates,
  });
  const completedHtgTransactionTotal = periodTransactions
    .filter((transaction) => transaction.status === "completed")
    .reduce((total, transaction) => total + transaction.htgReceived, 0);
  const paymentLoanMetrics = calculateBusinessMetrics({
    accounts,
    transactions,
    expenses: [],
    customerPayments: payments,
    loans,
    loanRepayments,
    reportingCurrency,
    exchangeRates: rates,
  });
  const completedPeriodTransactions = periodTransactions.filter(
    (transaction) => transaction.status === "completed",
  );
  const reportIncomeUsd = completedPeriodTransactions.reduce(
    (total, transaction) => total + calculateTransactionProfit(transaction).revenue,
    0,
  );
  const completedPeriodFundings = periodFundings.filter(
    (funding) => funding.status === "completed",
  );
  const fundingCreditSummary = completedPeriodFundings.reduce(
    (summary, funding) => {
      const account = accounts.find((item) => item.id === funding.destination_account_id);
      const amountUsd = account
        ? convertToReportingCurrency(
            Number(funding.credited_amount),
            account.currency,
            "USD",
            rates,
          )
        : null;
      if (amountUsd === null) {
        summary.incomplete = true;
      } else {
        summary.usd += amountUsd;
      }
      if (Number(funding.fee_amount) > 0) {
        if (funding.fee_usd === null) {
          summary.feesIncomplete = true;
        } else {
          summary.feesUsd += Number(funding.fee_usd);
        }
      }
      return summary;
    },
    { usd: 0, feesUsd: 0, incomplete: false, feesIncomplete: false },
  );
  const accountValueUsdSummary = accounts.reduce(
    (summary, account) => {
      const valueUsd = convertToReportingCurrency(account.balance, account.currency, "USD", rates);
      if (valueUsd === null) {
        summary.incomplete = true;
      } else {
        summary.usd += valueUsd;
      }
      return summary;
    },
    { usd: 0, incomplete: false },
  );
  const fundingCreditedByAccount = completedPeriodFundings.reduce<Record<string, number>>(
    (totals, funding) => {
      totals[funding.destination_account_id] =
        (totals[funding.destination_account_id] ?? 0) + Number(funding.credited_amount);
      return totals;
    },
    {},
  );
  const reportMonthRows = (() => {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const monthCount = Math.max(
      0,
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        end.getUTCMonth() -
        start.getUTCMonth() +
        1,
    );
    return Array.from({ length: monthCount }, (_, index) => {
      const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
      const key = month.toISOString().slice(0, 7);
      const monthStartDate = `${key}-01`;
      const monthEndDate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);
      const isInRange = monthEndDate >= startDate && monthStartDate <= endDate;
      const transactionsInMonth = isInRange
        ? completedPeriodTransactions.filter((transaction) => {
            const date = transaction.transactionDate.slice(0, 10);
            return date.startsWith(key) && date >= startDate && date <= endDate;
          })
        : [];
      const expensesInMonth = isInRange
        ? periodExpenses.filter(
            (expense) =>
              expense.status === "completed" &&
              expense.date.startsWith(key) &&
              expense.date >= startDate &&
              expense.date <= endDate,
          )
        : [];
      const fundingsInMonth = isInRange
        ? completedPeriodFundings.filter((funding) => {
            const date = funding.funding_date.slice(0, 10);
            return date.startsWith(key) && date >= startDate && date <= endDate;
          })
        : [];
      const income = transactionsInMonth.reduce(
        (sum, transaction) => sum + calculateTransactionProfit(transaction).revenue,
        0,
      );
      const transactionCosts = transactionsInMonth.reduce(
        (sum, transaction) => sum + calculateTransactionProfit(transaction).costs,
        0,
      );
      const expensesUsd = expensesInMonth.reduce(
        (sum, expense) =>
          expense.usdPerUnit === null ? sum : sum + expense.amount * expense.usdPerUnit,
        0,
      );
      const fundingFees = fundingsInMonth.reduce(
        (sum, funding) => sum + (funding.fee_usd === null ? 0 : Number(funding.fee_usd)),
        0,
      );
      return {
        month: key,
        label: month.toLocaleDateString(undefined, {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        }),
        income,
        expenses: transactionCosts + expensesUsd + fundingFees,
      };
    }).filter((row) => {
      const monthEnd = `${row.month}-${new Date(
        Date.UTC(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7)), 0),
      )
        .toISOString()
        .slice(8, 10)}`;
      return monthEnd >= startDate && `${row.month}-01` <= endDate;
    });
  })();
  const reportExpenseGroups = (() => {
    const groups = new Map<string, number>();
    for (const expense of periodExpenses) {
      if (expense.status !== "completed" || expense.usdPerUnit === null) continue;
      groups.set(
        expense.category,
        (groups.get(expense.category) ?? 0) + expense.amount * expense.usdPerUnit,
      );
    }
    const transactionCosts = completedPeriodTransactions.reduce(
      (total, transaction) => total + calculateTransactionProfit(transaction).costs,
      0,
    );
    const fundingFees = completedPeriodFundings.reduce(
      (total, funding) => total + (funding.fee_usd === null ? 0 : Number(funding.fee_usd)),
      0,
    );
    if (transactionCosts > 0) groups.set("Coûts de transfert", transactionCosts);
    if (fundingFees > 0) groups.set("Frais de financement", fundingFees);
    return [...groups.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5);
  })();
  const reportCustomerRows = (() => {
    const totals = new Map<string, { name: string; count: number; amount: number }>();
    for (const transaction of completedPeriodTransactions) {
      const current = totals.get(transaction.customerId) ?? {
        name: transaction.customerName,
        count: 0,
        amount: 0,
      };
      current.count += 1;
      current.amount += transaction.usdSent;
      totals.set(transaction.customerId, current);
    }
    return [...totals.entries()]
      .map(([id, values]) => ({ id, ...values }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5);
  })();
  const reportOperationMix = [
    { name: "Transferts", value: periodTransactions.length },
    { name: "Financements", value: periodFundings.length },
    {
      name: "Prêts",
      value: loans.filter((loan) => loan.issuedDate >= startDate && loan.issuedDate <= endDate)
        .length,
    },
  ].filter((item) => item.value > 0);

  const visibleTransactions = periodTransactions.filter(
    (transaction) =>
      (customerFilter === "all" || transaction.customerId === customerFilter) &&
      (transactionAccountFilter === "all" ||
        transactionAccountFilter === transaction.receiptAccountId ||
        transactionAccountFilter === transaction.payoutAccountId) &&
      (statusFilter === "all" || transaction.status === statusFilter),
  );

  async function onCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createCustomer.mutateAsync({
        name: readText(form, "name"),
        nickname: readText(form, "nickname"),
        contact: readText(form, "contact"),
        notes: readText(form, "notes"),
      });
      event.currentTarget.reset();
      toast.success("Customer saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the customer.");
    }
  }

  async function onUpdateCustomer(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await updateCustomer.mutateAsync({
        id,
        name: readText(form, "name"),
        nickname: readText(form, "nickname"),
        contact: readText(form, "contact"),
        notes: readText(form, "notes"),
      });
      toast.success("Customer details updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update customer details.");
    }
  }

  async function onCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createAccount.mutateAsync({
        name: readText(form, "name"),
        type: readText(form, "type") as "meru" | "cash" | "crypto" | "other",
        currency: readText(form, "currency").toUpperCase(),
        openingBalance: readNumber(form, "openingBalance") ?? 0,
      });
      event.currentTarget.reset();
      setAccountDialogOpen(false);
      toast.success("Account saved with its opening balance.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the account.");
    }
  }

  async function onCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createTransaction.mutateAsync({
        idempotencyKey: idempotencyKey(event.currentTarget),
        customerId: readText(form, "customerId"),
        receiptAccountId: readText(form, "receiptAccountId"),
        payoutAccountId: readText(form, "payoutAccountId"),
        date: dateTimeValue(readText(form, "transactionDate")),
        dueDate: readText(form, "dueDate") || null,
        htgReceived: readNumber(form, "htgReceived") ?? 0,
        usdSent: readNumber(form, "usdSent") ?? 0,
        exchangeRate: readNumber(form, "exchangeRate", true),
        serviceFee: readNumber(form, "serviceFee", true),
        cryptoCost: readNumber(form, "cryptoCost", true),
        transferFee: readNumber(form, "transferFee") ?? 0,
        otherExpenses: readNumber(form, "otherExpenses", true),
        reference: readText(form, "reference"),
        notes: readText(form, "notes"),
      });
      clearIdempotencyKey(event.currentTarget);
      event.currentTarget.reset();
      setTransferNotes("");
      setEntryDialogOpen(false);
      toast.success("Customer operation recorded as pending. Confirm it to post ledger movements.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't record the customer operation.",
      );
    }
  }

  async function onCreatePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await createPayment.mutateAsync({
        idempotencyKey: idempotencyKey(form),
        transactionId: readText(values, "paymentTransactionId"),
        accountId: readText(values, "paymentAccountId"),
        amount: readNumber(values, "paymentAmount") ?? 0,
        currency: "HTG",
        paymentMethod: readText(values, "paymentMethod"),
        date: readText(values, "paymentDate"),
        reference: readText(values, "paymentReference"),
        notes: readText(values, "paymentNotes"),
      });
      clearIdempotencyKey(form);
      form.reset();
      toast.success("Customer payment recorded and added to the selected HTG account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record the customer payment.");
    }
  }

  async function onCreateLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const accountId = readText(values, "loanAccountId");
    const account = accounts.find((item) => item.id === accountId);
    try {
      if (!account) throw new Error("Choose a valid disbursement account.");
      await createLoan.mutateAsync({
        idempotencyKey: idempotencyKey(form),
        customerId: readText(values, "loanCustomerId"),
        accountId,
        principalAmount: readNumber(values, "loanPrincipal") ?? 0,
        currency: account.currency,
        issuedDate: readText(values, "loanIssuedDate"),
        dueDate: readText(values, "loanDueDate") || null,
        interestAmount: readNumber(values, "loanInterest") ?? 0,
        feeAmount: readNumber(values, "loanFee") ?? 0,
        notes: readText(values, "loanNotes"),
      });
      clearIdempotencyKey(form);
      form.reset();
      setEntryDialogOpen(false);
      toast.success("Loan issued; the principal disbursement was posted to the selected account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't issue the loan.");
    }
  }

  async function onCreateLoanRepayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const loanId = readText(values, "repaymentLoanId");
    const loan = loans.find((item) => item.id === loanId);
    try {
      if (!loan) throw new Error("Choose a valid outstanding loan.");
      await createLoanRepayment.mutateAsync({
        idempotencyKey: idempotencyKey(form),
        loanId,
        accountId: readText(values, "repaymentAccountId"),
        amount: readNumber(values, "repaymentAmount") ?? 0,
        currency: loan.currency,
        date: readText(values, "repaymentDate"),
        reference: readText(values, "repaymentReference"),
        notes: readText(values, "repaymentNotes"),
      });
      clearIdempotencyKey(form);
      form.reset();
      toast.success("Loan repayment recorded; principal and interest/fees were posted separately.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record the loan repayment.");
    }
  }

  async function onCreateFunding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const sourceId = readText(form, "sourceAccountId");
      const isCrypto = readText(form, "fundingType").startsWith("crypto");
      await createFunding.mutateAsync({
        idempotencyKey: idempotencyKey(event.currentTarget),
        type: readText(form, "fundingType"),
        sourceAccountId: sourceId || null,
        destinationAccountId: readText(form, "destinationAccountId"),
        sourceAmount: readNumber(form, "sourceAmount", true),
        creditedAmount: readNumber(form, "creditedAmount") ?? 0,
        feeAmount: readNumber(form, "feeAmount") ?? 0,
        feeUsd: readNumber(form, "feeUsd", true),
        cryptoQuantity: isCrypto ? readNumber(form, "cryptoQuantity", true) : null,
        cryptoUnitPriceUsd: isCrypto ? readNumber(form, "cryptoUnitPriceUsd", true) : null,
        date: dateTimeValue(readText(form, "fundingDate")),
        reference: readText(form, "reference"),
        notes: readText(form, "notes"),
      });
      clearIdempotencyKey(event.currentTarget);
      event.currentTarget.reset();
      toast.success("Funding recorded as pending. Confirm it after the credit is verified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record funding.");
    }
  }

  async function onCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createExpense.mutateAsync({
        idempotencyKey: idempotencyKey(event.currentTarget),
        accountId: readText(form, "accountId"),
        category: readText(form, "category"),
        amount: readNumber(form, "amount") ?? 0,
        currency: readText(form, "currency"),
        usdRate: readNumber(form, "usdRate", true),
        date: readText(form, "expenseDate"),
        notes: readText(form, "notes"),
      });
      clearIdempotencyKey(event.currentTarget);
      event.currentTarget.reset();
      toast.success("Expense recorded as pending.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record the expense.");
    }
  }

  async function onCreateAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await createAdjustment.mutateAsync({
        idempotencyKey: idempotencyKey(form),
        accountId: readText(values, "accountId"),
        amount: readSignedNumber(values, "amount"),
        reason: readText(values, "reason"),
      });
      clearIdempotencyKey(form);
      form.reset();
      toast.success("Adjustment saved to the immutable ledger.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record the adjustment.");
    }
  }

  async function onSaveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await saveRate.mutateAsync({
        currency: readText(form, "currency"),
        usdPerUnit: readNumber(form, "usdPerUnit") ?? 0,
        date: readText(form, "effectiveDate"),
        notes: readText(form, "notes"),
      });
      event.currentTarget.reset();
      toast.success("Exchange rate saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the exchange rate.");
    }
  }

  async function changeStatus(
    type: string,
    id: string,
    action: "complete" | "failed" | "cancelled" | "reverse",
  ) {
    try {
      if (action === "complete") {
        await completeOperation.mutateAsync({ type, id });
      } else if (action === "reverse") {
        if (
          !window.confirm(
            "Create a reversal entry for this completed operation? This does not delete history.",
          )
        ) {
          return;
        }
        await reverseOperation.mutateAsync({ type, id });
      } else {
        await closeOperation.mutateAsync({ type, id, status: action });
      }
      toast.success(
        action === "complete" ? "Operation confirmed and ledger updated." : `Operation ${action}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update the operation.");
    }
  }

  function exportReport() {
    const rows = [
      ["Type", "Date", "Customer or description", "Status", "HTG", "USD", "Reference"],
      ...periodTransactions.map((transaction) => [
        "Customer transaction",
        transaction.transactionDate,
        transaction.customerName,
        transaction.status,
        String(transaction.htgReceived),
        String(transaction.usdSent),
        transaction.reference ?? "",
      ]),
      ...periodPayments.map((payment) => {
        const transaction = transactions.find((item) => item.id === payment.customerTransactionId);
        return [
          "Customer payment",
          payment.paymentDate,
          `${transaction?.customerName ?? "Unknown customer"} · ${payment.paymentMethod}`,
          "received",
          payment.currency === "HTG" ? String(payment.amount) : "",
          payment.currency === "USD" ? String(payment.amount) : "",
          payment.reference ?? "",
        ];
      }),
      ...loans
        .filter((loan) => loan.issuedDate >= startDate && loan.issuedDate <= endDate)
        .map((loan) => [
          "Loan issued",
          loan.issuedDate,
          `${loan.customerName} · ${loan.currency} principal`,
          loan.status,
          loan.currency === "HTG" ? String(loan.principalAmount) : "",
          loan.currency === "USD" ? String(loan.principalAmount) : "",
          "",
        ]),
      ...periodLoanRepayments.map((repayment) => {
        const loan = loans.find((item) => item.id === repayment.loanId);
        return [
          "Loan repayment",
          repayment.repaymentDate,
          `${loan?.customerName ?? "Unknown borrower"} · principal ${repayment.principalPaid}, interest ${repayment.interestPaid}, fee ${repayment.feePaid} ${repayment.currency}`,
          "received",
          repayment.currency === "HTG" ? String(repayment.amount) : "",
          repayment.currency === "USD" ? String(repayment.amount) : "",
          repayment.reference ?? "",
        ];
      }),
      ...periodFundings.map((funding) => [
        `Funding: ${funding.funding_type}`,
        funding.funding_date,
        `${funding.credited_amount} credited`,
        funding.status,
        "",
        "",
        funding.reference_code ?? "",
      ]),
      ...periodExpenses.map((expense) => [
        `Expense: ${expense.category}`,
        expense.date,
        formatBusinessMoney(expense.amount, expense.currency),
        "recorded",
        "",
        "",
        "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const safeCell = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
            return `"${safeCell.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nexora-business-${startDate}-to-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (recordsQuery.isLoading)
    return (
      <AppShell>
        <LoadingState rows={4} />
      </AppShell>
    );
  if (recordsQuery.isError) {
    return (
      <AppShell>
        <PageHeader title="Business" description="Your records couldn't be loaded." />
        <ErrorState onRetry={() => void recordsQuery.refetch()} />
      </AppShell>
    );
  }

  const hasMeruAccount = accounts.some(
    (account) => account.type === "meru" && account.currency === "USD",
  );
  const htgAccounts = accounts.filter((account) => account.currency === "HTG");
  const usdAccounts = accounts.filter((account) => account.currency === "USD");
  const activeLoans = loans.filter((loan) => loan.status !== "repaid");
  const repaymentLoans = activeLoans.filter((loan) => {
    const due = loanAmountsDue(loan, loanRepayments);
    return due.principal + due.interest + due.fee > 0;
  });
  const dueSoonLimit = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const loansDueSoon = repaymentLoans
    .filter((loan) => loan.dueDate !== null && loan.dueDate <= dueSoonLimit)
    .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""));
  const openTransactions = transactions.filter(
    (transaction) =>
      transaction.status !== "failed" &&
      transaction.status !== "cancelled" &&
      transaction.status !== "reversed",
  );
  const customerRows = customers.map((customer) => {
    const history = periodTransactions.filter(
      (transaction) => transaction.customerId === customer.id,
    );
    const outstanding = openTransactions
      .filter((transaction) => transaction.customerId === customer.id)
      .reduce(
        (sum, transaction) =>
          sum +
          calculateCustomerPaymentSummary(
            transaction,
            payments.filter((payment) => payment.customerTransactionId === transaction.id),
          ).outstanding,
        0,
      );
    return {
      customer,
      history,
      outstanding,
      transactionCount: transactions.filter((transaction) => transaction.customerId === customer.id)
        .length,
      performance: calculateCustomerPerformance(customer.id, periodTransactions),
    };
  });
  const visibleCustomers = customerRows
    .filter(({ customer }) =>
      `${customer.name} ${customer.nickname ?? ""} ${customer.contact ?? ""}`
        .toLocaleLowerCase()
        .includes(customerSearch.trim().toLocaleLowerCase()),
    )
    .filter(
      ({ outstanding, transactionCount }) =>
        (customerPaymentFilter === "all" ||
          (customerPaymentFilter === "pending" && outstanding > 0) ||
          (customerPaymentFilter === "clear" && outstanding === 0)) &&
        (customerActivityFilter === "all" ||
          (customerActivityFilter === "active" && transactionCount > 0) ||
          (customerActivityFilter === "new" && transactionCount === 0)),
    );
  const customerPageSize = 10;
  const customerPageCount = Math.max(1, Math.ceil(visibleCustomers.length / customerPageSize));
  const currentCustomerPage = Math.min(customerPage, customerPageCount);
  const paginatedCustomers = visibleCustomers.slice(
    (currentCustomerPage - 1) * customerPageSize,
    currentCustomerPage * customerPageSize,
  );
  const topCustomerRows = customers
    .map((customer) => {
      const customerTransactions = openTransactions.filter(
        (transaction) => transaction.customerId === customer.id,
      );
      const transactionIds = new Set(customerTransactions.map((transaction) => transaction.id));
      const paid = payments
        .filter((payment) => transactionIds.has(payment.customerTransactionId))
        .reduce((sum, payment) => sum + payment.amount, 0);
      return {
        id: customer.id,
        name: customer.name,
        paid,
        transactions: customerTransactions.length,
      };
    })
    .filter((customer) => customer.paid > 0 || customer.transactions > 0)
    .sort((left, right) => right.paid - left.paid)
    .slice(0, 5);
  const recentActivity: DashboardActivity[] = [
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      title: "Customer payment",
      detail:
        transactions.find((transaction) => transaction.id === payment.customerTransactionId)
          ?.customerName ?? "Customer transaction",
      date: payment.paymentDate,
      amount: payment.amount,
      currency: payment.currency,
      status: "completed",
      direction: "in" as const,
    })),
    ...transactions.map((transaction) => ({
      id: `transaction-${transaction.id}`,
      title: "Customer transfer",
      detail: transaction.customerName,
      date: transaction.transactionDate,
      amount: transaction.usdSent,
      currency: "USD",
      status: transaction.status,
      direction: "out" as const,
    })),
    ...loanRepayments.map((repayment) => ({
      id: `repayment-${repayment.id}`,
      title: "Loan repayment",
      detail: loans.find((loan) => loan.id === repayment.loanId)?.customerName ?? "Loan",
      date: repayment.repaymentDate,
      amount: repayment.amount,
      currency: repayment.currency,
      status: "completed",
      direction: "in" as const,
    })),
    ...loans.map((loan) => ({
      id: `loan-${loan.id}`,
      title: "Loan issued",
      detail: loan.customerName,
      date: loan.issuedDate,
      amount: loan.principalAmount,
      currency: loan.currency,
      status: loan.status,
      direction: "out" as const,
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      title: "Business expense",
      detail: expense.category,
      date: expense.date,
      amount: expense.amount,
      currency: expense.currency,
      status: expense.status,
      direction: "out" as const,
    })),
  ]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 5);
  const allOutstandingPaymentRows = openTransactions
    .map((transaction) => ({
      transaction,
      summary: calculateCustomerPaymentSummary(
        transaction,
        payments.filter((payment) => payment.customerTransactionId === transaction.id),
      ),
    }))
    .filter(({ summary }) => summary.outstanding > 0)
    .sort((left, right) => {
      const leftDate = left.transaction.dueDate ?? left.transaction.transactionDate;
      const rightDate = right.transaction.dueDate ?? right.transaction.transactionDate;
      return leftDate.localeCompare(rightDate);
    });
  const outstandingPaymentRows = allOutstandingPaymentRows.slice(0, 5);
  const upcomingLoanRows = repaymentLoans
    .filter(
      (loan) => loan.dueDate !== null && loan.dueDate >= today() && loan.dueDate <= dueSoonLimit,
    )
    .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""))
    .slice(0, 5);
  const overdueLoanRows = repaymentLoans
    .filter((loan) => loan.dueDate !== null && loan.dueDate < today())
    .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""))
    .slice(0, 5);
  const recentTransactions = [...transactions]
    .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
    .slice(0, 7);
  const dashboardLoanRows = [...repaymentLoans]
    .sort((left, right) =>
      (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31"),
    )
    .slice(0, 5);
  const outstandingCustomerCount = new Set(
    allOutstandingPaymentRows.map(({ transaction }) => transaction.customerId),
  ).size;
  const recordedFeeRevenueUsd =
    periodTransactions
      .filter((transaction) => transaction.status === "completed")
      .reduce((sum, transaction) => sum + (transaction.serviceFee ?? 0), 0) +
    metrics.loanInterestAndFeesUsd;
  const collectionTotalsByCurrency = periodPayments.reduce<Record<string, number>>(
    (totals, payment) => {
      totals[payment.currency] = (totals[payment.currency] ?? 0) + payment.amount;
      return totals;
    },
    {},
  );
  const allOperations = [
    ...transactions.map((item) => ({
      id: item.id,
      type: "customer_transaction",
      status: item.status,
    })),
    ...fundings.map((item) => ({ id: item.id, type: "funding", status: item.status })),
    ...expenses.map((item) => ({ id: item.id, type: "expense", status: item.status })),
  ];
  const isMutating =
    createCustomer.isPending ||
    updateCustomer.isPending ||
    createAccount.isPending ||
    createTransaction.isPending ||
    createPayment.isPending ||
    createLoan.isPending ||
    createLoanRepayment.isPending ||
    createFunding.isPending ||
    createExpense.isPending ||
    createAdjustment.isPending ||
    completeOperation.isPending ||
    closeOperation.isPending ||
    reverseOperation.isPending ||
    saveRate.isPending;

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-[#0b2540] dark:text-cyan-300">
              <BriefcaseBusiness className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-foreground">Business</h1>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                Gérez vos transferts Meru, suivez vos clients, prêts et revenus.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={exportReport}>
            <ArrowDownToLine aria-hidden="true" /> Export CSV
          </Button>
        </header>

        <details className="group rounded-xl border bg-card px-4 py-3 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            Reporting period and currency
            <span className="ml-auto text-xs text-muted-foreground">
              {startDate} — {endDate} · {reportingCurrency}
            </span>
          </summary>
          <section className="flex flex-wrap items-end gap-3 pt-4 sm:gap-4">
            <Field label="From">
              <Input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
            <Field label="Reporting currency">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={reportingCurrency}
                onChange={(event) => setReportingCurrency(event.target.value as BusinessCurrency)}
              >
                <option value="USD">USD</option>
                <option value="HTG">HTG</option>
                <option value="EUR">EUR</option>
              </select>
            </Field>
          </section>
        </details>

        {isMutating && (
          <p className="text-sm text-muted-foreground" role="status">
            Saving business record…
          </p>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList
            className={`flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 shadow-sm ${
              activeTab === "overview" ? "sr-only" : ""
            }`}
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="payments-loans">Payments & loans</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="funding">Funding & accounts</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(290px,0.95fr)]">
              <section aria-label="Aperçu Business" className="min-w-0 space-y-4">
                <Card className="relative isolate overflow-hidden border-cyan-900/70 bg-gradient-to-br from-[#061527] via-[#052b3a] to-[#073d43] text-white shadow-lg dark:from-[#061323] dark:via-[#06232f] dark:to-[#063b3e]">
                  <div
                    className="pointer-events-none absolute -right-5 -top-20 size-64 rounded-full border-[28px] border-cyan-400/10"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute -right-16 -top-28 size-72 rounded-full border-[18px] border-teal-300/10"
                    aria-hidden="true"
                  />
                  <CardContent className="relative flex min-h-36 items-center justify-between gap-5 p-5 sm:p-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200">Solde global Meru</p>
                        <span
                          title="Solde disponible du compte Meru USD, calculé à partir du grand livre et des mouvements confirmés."
                          aria-label="À propos du solde Meru"
                          role="img"
                        >
                          <Info className="size-4 text-cyan-200" aria-hidden="true" />
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <p className="text-4xl font-bold tracking-tight text-teal-300 sm:text-5xl">
                          {!hasMeruAccount
                            ? "Non configuré"
                            : meruBalanceVisible
                              ? formatBusinessMoney(metrics.meruWalletBalance, "USD")
                              : "••••••"}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={meruBalanceVisible ? "Masquer le solde" : "Afficher le solde"}
                          className="size-8 rounded-full border-slate-500/50 bg-slate-950/30 text-white hover:bg-slate-800/70 hover:text-white"
                          onClick={() => setMeruBalanceVisible((visible) => !visible)}
                        >
                          {meruBalanceVisible ? (
                            <Eye className="size-4" aria-hidden="true" />
                          ) : (
                            <EyeOff className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                      <p className="mt-2 max-w-xl text-xs text-cyan-100/80">
                        {hasMeruAccount
                          ? "Montant disponible après les transferts confirmés et frais enregistrés. Les opérations en attente ne sont pas incluses."
                          : "Créez un compte Meru USD dans Financement & comptes pour afficher son solde."}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block" aria-hidden="true">
                      <span className="text-3xl font-bold tracking-tight text-white/90">meru</span>
                      <p className="text-[10px] text-cyan-100/70">USD · ledger</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  {[
                    {
                      label: "Transferts effectués",
                      value: String(metrics.completedTransactions),
                      note: "Confirmés sur la période",
                      icon: ArrowUpRight,
                      color:
                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                    },
                    {
                      label: "Revenus (frais)",
                      value: formatBusinessMoney(recordedFeeRevenueUsd, "USD"),
                      note: metrics.loanRevenueIncomplete
                        ? "Frais reçus · conversion incomplète"
                        : "Frais enregistrés et encaissés",
                      icon: Banknote,
                      color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                    },
                    {
                      label: "Prêts en cours",
                      value: String(repaymentLoans.length),
                      note:
                        Object.entries(paymentLoanMetrics.outstandingLoanPrincipalByCurrency)
                          .map(
                            ([currency, amount]) =>
                              `${formatBusinessMoney(amount, currency)} ${currency}`,
                          )
                          .join(" · ") || "Aucun principal restant",
                      icon: PiggyBank,
                      color:
                        "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
                    },
                    {
                      label: "Clients en attente",
                      value: String(outstandingCustomerCount),
                      note: `${formatBusinessMoney(paymentLoanMetrics.outstandingCustomerPayments, "HTG")} à recevoir`,
                      icon: UsersRound,
                      color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
                    },
                  ].map(({ label, value, note, icon: Icon, color }) => (
                    <Card
                      key={label}
                      className="border-slate-200 bg-white shadow-sm dark:border-[#173451] dark:bg-[#091a2e]"
                    >
                      <CardContent className="flex min-h-24 items-center gap-3 p-3.5">
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-xl ${color}`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs text-muted-foreground">{label}</p>
                          <p className="truncate text-xl font-bold text-foreground">{value}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{note}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="min-w-0 border-slate-200 bg-white shadow-sm dark:border-[#173451] dark:bg-[#091a2e]">
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-slate-100 pb-3 dark:border-[#142d47]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 dark:bg-[#102f50] dark:text-blue-300">
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">Transactions récentes</CardTitle>
                        <CardDescription className="truncate text-xs">
                          Transferts client · montants collectés depuis le registre de paiements
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-cyan-600 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-950"
                      onClick={() => openEntryForm("transfer")}
                    >
                      <Plus className="size-4" aria-hidden="true" /> Nouvelle transaction
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {recentTransactions.length === 0 ? (
                      <p className="p-5 text-sm text-muted-foreground">
                        Aucune transaction enregistrée pour le moment.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-[#071426] dark:text-slate-400">
                            <tr>
                              <th className="px-3 py-2.5 font-medium">Date</th>
                              <th className="px-3 py-2.5 font-medium">Type</th>
                              <th className="px-3 py-2.5 font-medium">Client</th>
                              <th className="px-3 py-2.5 text-right font-medium">USD envoyé</th>
                              <th className="px-3 py-2.5 text-right font-medium">Frais/coûts</th>
                              <th className="px-3 py-2.5 text-right font-medium">HTG reçu</th>
                              <th className="px-3 py-2.5 font-medium">Statut</th>
                              <th className="px-3 py-2.5 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-[#142d47]">
                            {recentTransactions.map((transaction) => {
                              const paymentSummary = calculateCustomerPaymentSummary(
                                transaction,
                                payments.filter(
                                  (payment) => payment.customerTransactionId === transaction.id,
                                ),
                              );
                              const transactionCosts =
                                calculateTransactionProfit(transaction).costs;
                              return (
                                <tr
                                  key={transaction.id}
                                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-[#0c2037]"
                                >
                                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                                    {new Date(transaction.transactionDate).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge className="border-0 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                      Transfert
                                    </Badge>
                                  </td>
                                  <td className="max-w-32 truncate px-3 py-2.5 font-medium">
                                    {transaction.customerName}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                    {formatBusinessMoney(transaction.usdSent, "USD")}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground">
                                    {formatBusinessMoney(transactionCosts, "USD")}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-emerald-700 dark:text-emerald-300">
                                    {formatBusinessMoney(paymentSummary.totalPaid, "HTG")}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <StatusBadge status={transaction.status} />
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <OperationActions
                                      type="customer_transaction"
                                      id={transaction.id}
                                      status={transaction.status}
                                      disabled={isMutating}
                                      onAction={(action) =>
                                        void changeStatus(
                                          "customer_transaction",
                                          transaction.id,
                                          action,
                                        )
                                      }
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex justify-end border-t border-slate-100 p-2.5 dark:border-[#142d47]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-cyan-700 dark:text-cyan-300"
                        onClick={() => setActiveTab("transactions")}
                      >
                        Voir tout <ChevronRight className="ml-1 size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border-slate-200 bg-white shadow-sm dark:border-[#173451] dark:bg-[#091a2e]">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
                      <div>
                        <CardTitle className="text-sm">Clients en attente de paiement</CardTitle>
                        <CardDescription className="text-xs">
                          Soldes réels en HTG · transfert et collecte indépendants
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-cyan-700 dark:text-cyan-300"
                        onClick={() => setActiveTab("payments-loans")}
                      >
                        Voir tout <ChevronRight className="size-3.5" aria-hidden="true" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      {outstandingPaymentRows.length === 0 ? (
                        <p className="px-4 pb-4 text-sm text-muted-foreground">
                          Aucun paiement client en attente.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[390px] text-xs">
                            <thead className="border-y border-slate-100 bg-slate-50 text-[10px] text-muted-foreground dark:border-[#142d47] dark:bg-[#071426]">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Nom</th>
                                <th className="px-3 py-2 text-right font-medium">Reste (HTG)</th>
                                <th className="px-3 py-2 text-left font-medium">Statut</th>
                                <th className="px-3 py-2 text-right font-medium">Échéance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#142d47]">
                              {outstandingPaymentRows.map(({ transaction, summary }) => (
                                <tr key={transaction.id}>
                                  <td className="max-w-28 truncate px-3 py-2.5 font-medium">
                                    {transaction.customerName}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                    {formatBusinessMoney(summary.outstanding, "HTG")}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <StatusBadge status={summary.status} />
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground">
                                    {transaction.dueDate ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 bg-white shadow-sm dark:border-[#173451] dark:bg-[#091a2e]">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
                      <div>
                        <CardTitle className="text-sm">Prêts en cours</CardTitle>
                        <CardDescription className="text-xs">
                          Principal restant · par devise
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-cyan-700 dark:text-cyan-300"
                        onClick={() => setActiveTab("payments-loans")}
                      >
                        Voir tout <ChevronRight className="size-3.5" aria-hidden="true" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      {dashboardLoanRows.length === 0 ? (
                        <p className="px-4 pb-4 text-sm text-muted-foreground">
                          Aucun prêt avec un solde restant.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[390px] text-xs">
                            <thead className="border-y border-slate-100 bg-slate-50 text-[10px] text-muted-foreground dark:border-[#142d47] dark:bg-[#071426]">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Nom</th>
                                <th className="px-3 py-2 text-right font-medium">Principal</th>
                                <th className="px-3 py-2 text-left font-medium">Échéance</th>
                                <th className="px-3 py-2 text-right font-medium">Statut</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#142d47]">
                              {dashboardLoanRows.map((loan) => {
                                const summary = calculateLoanSummary(
                                  loan,
                                  loanRepayments.filter(
                                    (repayment) => repayment.loanId === loan.id,
                                  ),
                                );
                                const overdue =
                                  loan.dueDate !== null &&
                                  loan.dueDate < today() &&
                                  summary.outstandingPrincipal > 0;
                                return (
                                  <tr key={loan.id}>
                                    <td className="max-w-28 truncate px-3 py-2.5 font-medium">
                                      {loan.customerName}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                      {formatBusinessMoney(
                                        summary.outstandingPrincipal,
                                        loan.currency,
                                      )}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                                      {loan.dueDate ?? loan.issuedDate}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                      <StatusBadge status={overdue ? "overdue" : loan.status} />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </section>

              <aside className="min-w-0 space-y-4">
                <Card className="border-slate-200 bg-white shadow-sm dark:border-[#173451] dark:bg-[#091a2e]">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Zap className="size-4 text-amber-500" aria-hidden="true" />
                      Actions rapides
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      {
                        title: "Nouvelle transaction",
                        description: "Transfert, dépôt ou prêt",
                        icon: BriefcaseBusiness,
                        action: () => openEntryForm("transfer"),
                        style:
                          "border-teal-500/60 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-500 hover:to-cyan-500",
                      },
                      {
                        title: "Voir tous les clients",
                        description: "Gérer les profils et soldes",
                        icon: UsersRound,
                        action: () => setActiveTab("customers"),
                        style:
                          "border-blue-900/20 bg-blue-50 text-blue-950 hover:bg-blue-100 dark:border-blue-900 dark:bg-[#102b4b] dark:text-blue-100 dark:hover:bg-[#16365b]",
                      },
                      {
                        title: "Voir les rapports",
                        description: "Statistiques et historique",
                        icon: ChartNoAxesCombined,
                        action: () => setActiveTab("reports"),
                        style:
                          "border-violet-900/20 bg-violet-50 text-violet-950 hover:bg-violet-100 dark:border-violet-900 dark:bg-[#241f49] dark:text-violet-100 dark:hover:bg-[#30295d]",
                      },
                    ].map(({ title, description, icon: Icon, action, style }) => (
                      <Button
                        key={title}
                        variant="outline"
                        className={`h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-left ${style}`}
                        onClick={action}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-black/5 dark:bg-black/15">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">{title}</span>
                          <span className="mt-0.5 block truncate text-[10px] opacity-75">
                            {description}
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 opacity-75" aria-hidden="true" />
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
                  <DialogContent className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-[850px] overflow-y-auto border-cyan-900/60 bg-background p-0 shadow-2xl sm:w-[84vw] sm:rounded-xl">
                    <div className="grid min-w-0 items-start lg:grid-cols-[minmax(0,1.7fr)_minmax(245px,0.85fr)]">
                      <section className="min-w-0 p-4 sm:p-5">
                        <DialogHeader className="mb-4 pr-8 text-left">
                          <DialogTitle className="flex items-center gap-3 text-lg">
                            <span className="grid size-10 place-items-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-teal-500/20 dark:text-teal-300">
                              <Plus className="size-5" aria-hidden="true" />
                            </span>
                            Nouvelle transaction
                          </DialogTitle>
                          <DialogDescription className="pl-[52px] text-xs">
                            Effectuez un transfert, un dépôt ou un prêt avec les règles comptables
                            existantes.
                          </DialogDescription>
                        </DialogHeader>
                        <Card
                          id="business-entry-form"
                          className="border-cyan-900/50 bg-card shadow-sm"
                        >
                          <CardContent className="p-4 [&_input]:h-8 [&_input]:text-xs [&_label]:text-[11px] [&_select]:h-8 [&_select]:text-xs [&_textarea]:text-xs">
                            <div className="mb-4 grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-50/70 p-1 dark:border-[#1a3653] dark:bg-[#061527]">
                              {(
                                [
                                  ["transfer", "Transfert", ArrowRight],
                                  ["deposit", "Dépôt", ArrowDownToLine],
                                  ["loan", "Prêt", HandCoins],
                                ] as const
                              ).map(([type, label, Icon]) => (
                                <button
                                  key={type}
                                  type="button"
                                  className={`flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    entryType === type
                                      ? "bg-cyan-600 text-white shadow-sm dark:bg-teal-400 dark:text-[#041521]"
                                      : "text-muted-foreground hover:bg-slate-100 dark:hover:bg-[#10243b]"
                                  }`}
                                  aria-pressed={entryType === type}
                                  onClick={() => setEntryType(type)}
                                >
                                  <Icon className="size-3.5" aria-hidden="true" />
                                  {label}
                                </button>
                              ))}
                            </div>

                            {entryType === "transfer" &&
                              (customers.length === 0 ||
                              htgAccounts.length === 0 ||
                              usdAccounts.length === 0 ? (
                                <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-50/80 p-4 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                                  <div className="flex items-start gap-2">
                                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                    <div>
                                      <p className="font-semibold">Configuration nécessaire</p>
                                      <p className="mt-1 leading-relaxed">
                                        Un client et des comptes HTG et USD doivent être configurés
                                        avant d’enregistrer un transfert.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {customers.length === 0 && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEntryDialogOpen(false);
                                          setActiveTab("customers");
                                        }}
                                      >
                                        <UsersRound aria-hidden="true" /> Ajouter un client
                                      </Button>
                                    )}
                                    {(htgAccounts.length === 0 || usdAccounts.length === 0) && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEntryDialogOpen(false);
                                          setActiveTab("funding");
                                        }}
                                      >
                                        <Wallet aria-hidden="true" /> Configurer les comptes
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <form
                                  key="quick-transfer"
                                  className="space-y-4"
                                  onSubmit={(event) => void onCreateTransaction(event)}
                                >
                                  <div>
                                    <p className="mb-2 text-xs font-semibold text-foreground">
                                      1. Informations du bénéficiaire
                                    </p>
                                    <Field label="Client *">
                                      <select
                                        name="customerId"
                                        value={
                                          selectedTransactionCustomerId || customers[0]?.id || ""
                                        }
                                        onChange={(event) =>
                                          setSelectedTransactionCustomerId(event.target.value)
                                        }
                                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#1a3653] dark:bg-[#061527] dark:text-slate-100"
                                        required
                                      >
                                        {customers.map((customer) => (
                                          <option key={customer.id} value={customer.id}>
                                            {customer.name}
                                          </option>
                                        ))}
                                      </select>
                                    </Field>
                                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                                      Sélectionnez le client bénéficiaire du transfert.
                                    </p>
                                  </div>
                                  <div className="border-t border-slate-200 pt-3 dark:border-[#173451]">
                                    <p className="mb-2 text-xs font-semibold text-foreground">
                                      2. Montants
                                    </p>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                      <Field label="Montant envoyé (USD) *">
                                        <Input
                                          name="usdSent"
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          placeholder="Ex. 10.00"
                                          value={transferAmount}
                                          onChange={(event) =>
                                            setTransferAmount(event.target.value)
                                          }
                                          required
                                          className="h-9 dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                      <Field label="Frais (USD) *">
                                        <Input
                                          name="transferFee"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="Ex. 0.50"
                                          value={transferFee}
                                          onChange={(event) => setTransferFee(event.target.value)}
                                          required
                                          className="h-9 dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                      <Field label="Montant dû (HTG) *">
                                        <Input
                                          name="htgReceived"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="0.00"
                                          value={transferHtgDue}
                                          onChange={(event) =>
                                            setTransferHtgDue(event.target.value)
                                          }
                                          required
                                          className="h-9 dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                    </div>
                                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                                      Le montant en HTG est saisi séparément ; aucun taux n’est
                                      supposé automatiquement.
                                    </p>
                                  </div>
                                  <details className="rounded-lg border border-slate-200 px-3 py-2 dark:border-[#1a3653]">
                                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                      Comptes et détails facultatifs
                                    </summary>
                                    <div className="mt-3 space-y-3">
                                      <Field label="Compte de réception HTG *">
                                        <select
                                          name="receiptAccountId"
                                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#1a3653] dark:bg-[#061527] dark:text-slate-100"
                                          required
                                        >
                                          {htgAccounts.map((account) => (
                                            <option key={account.id} value={account.id}>
                                              {account.name}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                      <Field label="Compte Meru / sortie USD *">
                                        <select
                                          name="payoutAccountId"
                                          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#1a3653] dark:bg-[#061527] dark:text-slate-100"
                                          required
                                        >
                                          {usdAccounts.map((account) => (
                                            <option key={account.id} value={account.id}>
                                              {account.name}
                                            </option>
                                          ))}
                                        </select>
                                      </Field>
                                      <Field label="Date et heure">
                                        <Input
                                          name="transactionDate"
                                          type="datetime-local"
                                          defaultValue={new Date().toISOString().slice(0, 16)}
                                          required
                                          className="dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                      <Field label="Date limite (facultatif)">
                                        <Input
                                          name="dueDate"
                                          type="date"
                                          className="dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                      <Field label="Taux HTG par USD (facultatif)">
                                        <Input
                                          name="exchangeRate"
                                          type="number"
                                          min="0.000001"
                                          step="0.000001"
                                          className="dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                      <Field label="Frais de service / marge (USD)">
                                        <Input
                                          name="serviceFee"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className="dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                      <Field label="Coût d’acquisition crypto (USD)">
                                        <Input
                                          name="cryptoCost"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className="dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                      <Field label="Autres frais (USD)">
                                        <Input
                                          name="otherExpenses"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          className="dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                      <Field label="Référence">
                                        <Input
                                          name="reference"
                                          className="dark:border-[#1a3653] dark:bg-[#061527]"
                                        />
                                      </Field>
                                    </div>
                                  </details>
                                  <div>
                                    <Field label="Note (facultative)">
                                      <textarea
                                        name="notes"
                                        rows={2}
                                        maxLength={200}
                                        value={transferNotes}
                                        onChange={(event) => setTransferNotes(event.target.value)}
                                        placeholder="Ajouter une note sur cette transaction…"
                                        className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:border-[#1a3653] dark:bg-[#061527]"
                                      />
                                    </Field>
                                    <p className="mt-1 text-right text-[10px] text-muted-foreground">
                                      {transferNotes.length}/200
                                    </p>
                                  </div>
                                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                                    L’opération sera créée en attente. Les paiements HTG se
                                    saisissent séparément.
                                  </p>
                                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-[#173451]">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setEntryDialogOpen(false)}
                                    >
                                      Annuler
                                    </Button>
                                    <Button
                                      type="submit"
                                      disabled={isMutating}
                                      className="bg-teal-500 text-[#041521] hover:bg-teal-400"
                                    >
                                      <ArrowUpRight className="size-4" aria-hidden="true" />
                                      Enregistrer la transaction
                                    </Button>
                                  </div>
                                </form>
                              ))}

                            {entryType === "deposit" &&
                              (accounts.length === 0 ? (
                                <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-50/80 p-4 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                                  <p>Créez un compte avant de pouvoir enregistrer un dépôt.</p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEntryDialogOpen(false);
                                      setActiveTab("funding");
                                    }}
                                  >
                                    <Wallet aria-hidden="true" /> Configurer les comptes
                                  </Button>
                                </div>
                              ) : (
                                <form
                                  key="quick-deposit"
                                  className="space-y-3"
                                  onSubmit={(event) => void onCreateFunding(event)}
                                >
                                  <input type="hidden" name="fundingType" value="replenishment" />
                                  <p className="text-xs font-semibold text-foreground">
                                    1. Informations du dépôt
                                  </p>
                                  <Field label="Compte crédité *">
                                    <select
                                      name="destinationAccountId"
                                      value={selectedFundingAccountId || accounts[0]?.id || ""}
                                      onChange={(event) =>
                                        setSelectedFundingAccountId(event.target.value)
                                      }
                                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#1a3653] dark:bg-[#061527] dark:text-slate-100"
                                      required
                                    >
                                      {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                          {account.name} · {account.currency}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                  <Field label="Compte source (facultatif)">
                                    <select
                                      name="sourceAccountId"
                                      defaultValue=""
                                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#1a3653] dark:bg-[#061527] dark:text-slate-100"
                                    >
                                      <option value="">Fonds externes / non suivis</option>
                                      {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                          {account.name} · {account.currency}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                  <Field label="Montant réellement crédité *">
                                    <Input
                                      name="creditedAmount"
                                      type="number"
                                      min="0.00000001"
                                      step="0.00000001"
                                      value={fundingCreditedAmount}
                                      onChange={(event) =>
                                        setFundingCreditedAmount(event.target.value)
                                      }
                                      required
                                      className="dark:border-[#1a3653] dark:bg-[#061527]"
                                    />
                                  </Field>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Frais (devise source)">
                                      <Input
                                        name="feeAmount"
                                        type="number"
                                        min="0"
                                        step="0.00000001"
                                        value={fundingFee}
                                        onChange={(event) => setFundingFee(event.target.value)}
                                        required
                                        className="dark:border-[#1a3653] dark:bg-[#061527]"
                                      />
                                    </Field>
                                    <Field label="Frais (USD)">
                                      <Input
                                        name="feeUsd"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="dark:border-[#1a3653] dark:bg-[#061527]"
                                      />
                                    </Field>
                                  </div>
                                  <Field label="Date et heure">
                                    <Input
                                      name="fundingDate"
                                      type="datetime-local"
                                      defaultValue={new Date().toISOString().slice(0, 16)}
                                      required
                                      className="dark:border-[#1a3653] dark:bg-[#061527]"
                                    />
                                  </Field>
                                  <Field label="Référence ou notes">
                                    <Input
                                      name="reference"
                                      maxLength={200}
                                      className="dark:border-[#1a3653] dark:bg-[#061527]"
                                    />
                                  </Field>
                                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                                    Dépôt enregistré en attente. Confirmez le crédit réel dans
                                    Financement & comptes. Un dépôt n’est pas un revenu.
                                  </p>
                                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-[#173451]">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setEntryDialogOpen(false)}
                                    >
                                      Annuler
                                    </Button>
                                    <Button
                                      type="submit"
                                      disabled={isMutating}
                                      className="bg-teal-500 text-[#041521] hover:bg-teal-400"
                                    >
                                      <ArrowUpRight className="size-4" aria-hidden="true" />
                                      Enregistrer le dépôt
                                    </Button>
                                  </div>
                                </form>
                              ))}

                            {entryType === "loan" &&
                              (customers.length === 0 || accounts.length === 0 ? (
                                <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-50/80 p-4 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                                  <p>
                                    {customers.length === 0
                                      ? "Ajoutez un client avant d’émettre un prêt."
                                      : "Configurez un compte de décaissement avant d’émettre un prêt."}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {customers.length === 0 && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEntryDialogOpen(false);
                                          setActiveTab("customers");
                                        }}
                                      >
                                        <UsersRound aria-hidden="true" /> Ajouter un client
                                      </Button>
                                    )}
                                    {accounts.length === 0 && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEntryDialogOpen(false);
                                          setActiveTab("funding");
                                        }}
                                      >
                                        <Wallet aria-hidden="true" /> Configurer les comptes
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <form
                                  key="quick-loan"
                                  className="space-y-3"
                                  onSubmit={(event) => void onCreateLoan(event)}
                                >
                                  <p className="text-xs font-semibold text-foreground">
                                    1. Informations du prêt
                                  </p>
                                  <Field label="Nom de l’emprunteur *">
                                    <select
                                      name="loanCustomerId"
                                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#1a3653] dark:bg-[#061527] dark:text-slate-100"
                                      required
                                    >
                                      {customers.map((customer) => (
                                        <option key={customer.id} value={customer.id}>
                                          {customer.name}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                  <Field label="Compte de décaissement *">
                                    <select
                                      name="loanAccountId"
                                      value={selectedLoanAccountId || accounts[0]?.id || ""}
                                      onChange={(event) =>
                                        setSelectedLoanAccountId(event.target.value)
                                      }
                                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-[#1a3653] dark:bg-[#061527] dark:text-slate-100"
                                      required
                                    >
                                      {accounts.map((account) => (
                                        <option key={account.id} value={account.id}>
                                          {account.name} · {account.currency}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                  <Field label="Principal prêté *">
                                    <Input
                                      name="loanPrincipal"
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={loanPrincipalAmount}
                                      onChange={(event) =>
                                        setLoanPrincipalAmount(event.target.value)
                                      }
                                      required
                                      className="dark:border-[#1a3653] dark:bg-[#061527]"
                                    />
                                  </Field>
                                  <div className="grid grid-cols-2 gap-3">
                                    <Field label="Date d’émission">
                                      <Input
                                        name="loanIssuedDate"
                                        type="date"
                                        defaultValue={today()}
                                        required
                                        className="dark:border-[#1a3653] dark:bg-[#061527]"
                                      />
                                    </Field>
                                    <Field label="Date d’échéance">
                                      <Input
                                        name="loanDueDate"
                                        type="date"
                                        className="dark:border-[#1a3653] dark:bg-[#061527]"
                                      />
                                    </Field>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <Field label="Intérêts convenus">
                                      <Input
                                        name="loanInterest"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={loanInterestAmount}
                                        onChange={(event) =>
                                          setLoanInterestAmount(event.target.value)
                                        }
                                        className="dark:border-[#1a3653] dark:bg-[#061527]"
                                      />
                                    </Field>
                                    <Field label="Frais convenus">
                                      <Input
                                        name="loanFee"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={loanFeeAmount}
                                        onChange={(event) => setLoanFeeAmount(event.target.value)}
                                        className="dark:border-[#1a3653] dark:bg-[#061527]"
                                      />
                                    </Field>
                                  </div>
                                  <Field label="Notes (facultatif)">
                                    <Input
                                      name="loanNotes"
                                      maxLength={1000}
                                      className="dark:border-[#1a3653] dark:bg-[#061527]"
                                    />
                                  </Field>
                                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                                    Le principal est un actif et non un revenu. Le décaissement est
                                    comptabilisé dans la devise du compte sélectionné.
                                  </p>
                                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-[#173451]">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setEntryDialogOpen(false)}
                                    >
                                      Annuler
                                    </Button>
                                    <Button
                                      type="submit"
                                      disabled={isMutating}
                                      className="bg-teal-500 text-[#041521] hover:bg-teal-400"
                                    >
                                      <ArrowUpRight className="size-4" aria-hidden="true" />
                                      Enregistrer le prêt
                                    </Button>
                                  </div>
                                </form>
                              ))}
                          </CardContent>
                        </Card>
                      </section>

                      <aside className="min-w-0 space-y-3 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-[#173451] dark:bg-[#071426] sm:p-5 lg:border-l lg:border-t-0">
                        <Card className="border-cyan-900/60 bg-white shadow-sm dark:bg-[#091a2e]">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <span className="grid size-7 place-items-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-teal-500/15 dark:text-teal-300">
                                <CircleDollarSign className="size-4" aria-hidden="true" />
                              </span>
                              Aperçu de la transaction
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2.5 text-xs">
                            {entryType === "transfer" && (
                              <>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">Client</span>
                                  <span className="max-w-36 truncate text-right font-medium">
                                    {customers.find(
                                      (customer) => customer.id === selectedTransactionCustomerId,
                                    )?.name ??
                                      customers[0]?.name ??
                                      "—"}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">Montant (USD)</span>
                                  <span className="font-medium">
                                    {formatBusinessMoney(
                                      Math.max(0, Number(transferAmount) || 0),
                                      "USD",
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">Frais (USD)</span>
                                  <span className="font-medium">
                                    {formatBusinessMoney(
                                      Math.max(0, Number(transferFee) || 0),
                                      "USD",
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">Montant dû (HTG)</span>
                                  <span className="font-medium">
                                    {formatBusinessMoney(
                                      Math.max(0, Number(transferHtgDue) || 0),
                                      "HTG",
                                    )}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-3 border-t pt-3 font-semibold">
                                  <span>Total débité (USD)</span>
                                  <span>
                                    {formatBusinessMoney(
                                      Math.max(0, Number(transferAmount) || 0) +
                                        Math.max(0, Number(transferFee) || 0),
                                      "USD",
                                    )}
                                  </span>
                                </div>
                              </>
                            )}
                            {entryType === "deposit" && (
                              <>
                                <p className="text-muted-foreground">Crédit réel à confirmer</p>
                                <p className="text-lg font-semibold text-foreground">
                                  {formatBusinessMoney(
                                    Math.max(0, Number(fundingCreditedAmount) || 0),
                                    accounts.find(
                                      (account) => account.id === selectedFundingAccountId,
                                    )?.currency ??
                                      accounts[0]?.currency ??
                                      "USD",
                                  )}
                                </p>
                                <p className="leading-relaxed text-muted-foreground">
                                  Le dépôt reste en attente jusqu’à confirmation du montant crédité.
                                  Un dépôt n’est pas un revenu.
                                </p>
                              </>
                            )}
                            {entryType === "loan" && (
                              <>
                                <p className="text-muted-foreground">Principal décaissé</p>
                                <p className="text-lg font-semibold text-foreground">
                                  {formatBusinessMoney(
                                    Math.max(0, Number(loanPrincipalAmount) || 0),
                                    accounts.find((account) => account.id === selectedLoanAccountId)
                                      ?.currency ??
                                      accounts[0]?.currency ??
                                      "USD",
                                  )}
                                </p>
                                <p className="leading-relaxed text-muted-foreground">
                                  Le principal constitue un actif et n’est pas comptabilisé comme un
                                  revenu.
                                </p>
                              </>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="border-cyan-900/60 bg-white shadow-sm dark:bg-[#091a2e]">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <Info className="size-4 text-cyan-600 dark:text-cyan-300" />
                              Informations importantes
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-xs leading-relaxed text-muted-foreground">
                            <ul className="list-disc space-y-1.5 pl-4">
                              <li>Les opérations sont enregistrées en attente.</li>
                              <li>Les paiements HTG sont saisis séparément.</li>
                              <li>Les dépôts utilisent le crédit réel.</li>
                            </ul>
                          </CardContent>
                        </Card>
                        <Card className="relative isolate overflow-hidden border-cyan-900/60 bg-gradient-to-br from-slate-50 to-cyan-50 shadow-sm dark:from-[#08182a] dark:to-[#09283a]">
                          <div
                            className="pointer-events-none absolute -bottom-10 -right-2 size-24 rounded-full border-[12px] border-cyan-500/10"
                            aria-hidden="true"
                          />
                          <CardContent className="relative p-3.5">
                            <Quote
                              className="absolute right-3 top-3 size-6 text-cyan-300 dark:text-cyan-900"
                              aria-hidden="true"
                            />
                            <p className="pr-7 text-xs italic leading-relaxed text-foreground">
                              « Chaque transaction compte. Gérez votre activité avec discipline. »
                            </p>
                            <p className="mt-2 text-[10px] text-muted-foreground">— Nexora</p>
                          </CardContent>
                        </Card>
                      </aside>
                    </div>
                  </DialogContent>
                </Dialog>

                <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-slate-50 to-cyan-50 shadow-sm dark:border-[#173451] dark:from-[#08182a] dark:to-[#09283a]">
                  <CardContent className="relative p-4">
                    <Quote
                      className="absolute right-4 top-4 size-8 text-cyan-200 dark:text-cyan-900"
                      aria-hidden="true"
                    />
                    <p className="pr-8 text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                      « Chaque transaction compte. Gérez votre activité avec méthode et discipline.
                      »
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">— Nexora</p>
                  </CardContent>
                </Card>
              </aside>
            </div>

            <details className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#173451] dark:bg-[#091a2e]">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Ouvrir la vue comptable détaillée
              </summary>
              <div className="space-y-5 pt-5">
                <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
                  <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-700 via-emerald-700 to-teal-700 text-white shadow-lg dark:border-emerald-900 dark:from-[#07110e] dark:via-[#101b17] dark:to-[#101c1a]">
                    <CardContent className="flex min-h-52 flex-col justify-between gap-8 p-6 sm:p-8">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-emerald-50/80">
                            Available Meru balance
                          </p>
                          <p className="mt-1 text-xs text-emerald-50/70">
                            Confirmed USD funds · ledger balance
                          </p>
                        </div>
                        <span className="grid size-11 place-items-center rounded-xl border border-white/15 bg-white/10 text-emerald-50">
                          <Wallet className="size-5" aria-hidden="true" />
                        </span>
                      </div>
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <p className="text-3xl font-bold tracking-tight sm:text-4xl">
                            {!hasMeruAccount
                              ? "Not set up"
                              : meruBalanceVisible
                                ? formatBusinessMoney(metrics.meruWalletBalance, "USD")
                                : "••••••"}
                          </p>
                          <p className="mt-2 text-sm text-emerald-50/75">
                            {hasMeruAccount
                              ? "Pending operations are not included"
                              : "Add a Meru USD account to show its balance"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={meruBalanceVisible ? "Hide balance" : "Show balance"}
                          className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                          onClick={() => setMeruBalanceVisible((visible) => !visible)}
                        >
                          {meruBalanceVisible ? (
                            <Eye className="size-4" aria-hidden="true" />
                          ) : (
                            <EyeOff className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Quick actions</CardTitle>
                      <CardDescription>Go directly to an existing workflow</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <Button
                        className="justify-start bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#07110e] dark:hover:bg-emerald-400"
                        onClick={() => setActiveTab("transactions")}
                      >
                        <Plus className="size-4" /> Record customer transfer
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => setActiveTab("payments-loans")}
                      >
                        <Plus className="size-4" /> Collect payment or manage loan
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => setActiveTab("funding")}
                      >
                        <Plus className="size-4" /> Add funding or account
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => setActiveTab("expenses")}
                      >
                        <Plus className="size-4" /> Record expense
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  {[
                    {
                      label: "Customer transfers",
                      value: formatBusinessMoney(completedHtgTransactionTotal, "HTG"),
                      note: `${metrics.completedTransactions} completed this period`,
                      icon: ArrowUpRight,
                    },
                    {
                      label: "USD sent to customers",
                      value: formatBusinessMoney(metrics.totalUsdSentToCustomers, "USD"),
                      note: "Confirmed transfers this period",
                      icon: CircleDollarSign,
                    },
                    {
                      label: "Realized net profit",
                      value: formatBusinessMoney(metrics.netProfit, "USD"),
                      note: metrics.profitIncomplete
                        ? "Incomplete: missing recorded inputs"
                        : "USD estimate",
                      icon: TrendingUp,
                    },
                    {
                      label: "Customer payments outstanding",
                      value: formatBusinessMoney(
                        paymentLoanMetrics.outstandingCustomerPayments,
                        "HTG",
                      ),
                      note: `${paymentLoanMetrics.overdueCustomerPayments} overdue · HTG`,
                      icon: HandCoins,
                    },
                  ].map(({ label, value, note, icon: Icon }) => (
                    <Card key={label} className="border-border bg-card">
                      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-muted-foreground">{label}</p>
                          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground">
                            {value}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
                        </div>
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.5fr_0.8fr]">
                  <Card className="min-w-0 border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                      <div>
                        <CardTitle className="text-base">Recent transactions</CardTitle>
                        <CardDescription>Latest saved business activity</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("transactions")}
                      >
                        View all <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {recentActivity.length === 0 ? (
                        <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                          Your saved business activity will appear here.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[540px] text-left text-sm">
                            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="pb-3 font-medium">Date</th>
                                <th className="pb-3 font-medium">Activity</th>
                                <th className="pb-3 font-medium">Customer / detail</th>
                                <th className="pb-3 text-right font-medium">Amount</th>
                                <th className="pb-3 text-right font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {recentActivity.map((activity) => (
                                <tr key={activity.id}>
                                  <td className="whitespace-nowrap py-3 text-xs text-muted-foreground">
                                    {activity.date.slice(0, 10)}
                                  </td>
                                  <td className="whitespace-nowrap py-3 font-medium">
                                    {activity.title}
                                  </td>
                                  <td className="max-w-40 truncate py-3 text-muted-foreground">
                                    {activity.detail}
                                  </td>
                                  <td
                                    className={`whitespace-nowrap py-3 text-right font-semibold ${
                                      activity.direction === "in"
                                        ? "text-emerald-700 dark:text-emerald-300"
                                        : "text-foreground"
                                    }`}
                                  >
                                    {activity.direction === "in" ? "+" : "−"}
                                    {formatBusinessMoney(activity.amount, activity.currency)}
                                  </td>
                                  <td className="py-3 text-right">
                                    <Badge
                                      variant={
                                        activity.status === "completed"
                                          ? "default"
                                          : activity.status === "failed" ||
                                              activity.status === "cancelled"
                                            ? "destructive"
                                            : "secondary"
                                      }
                                      className="capitalize"
                                    >
                                      {activity.status.replaceAll("_", " ")}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card">
                    <CardHeader>
                      <CardTitle className="text-base">Loan principal outstanding</CardTitle>
                      <CardDescription>
                        Principal is not revenue; balances stay grouped by currency.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(paymentLoanMetrics.outstandingLoanPrincipalByCurrency)
                        .length === 0 ? (
                        <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                          No outstanding loan principal.
                        </p>
                      ) : (
                        Object.entries(paymentLoanMetrics.outstandingLoanPrincipalByCurrency)
                          .sort(([left], [right]) => left.localeCompare(right))
                          .map(([currency, amount]) => (
                            <div
                              key={currency}
                              className="flex items-center justify-between rounded-lg bg-muted/60 p-3"
                            >
                              <span className="text-sm font-medium">{currency}</span>
                              <span className="font-semibold">
                                {formatBusinessMoney(amount, currency)}
                              </span>
                            </div>
                          ))
                      )}
                      <p className="pt-2 text-xs text-muted-foreground">
                        {paymentLoanMetrics.overdueLoans} overdue loan
                        {paymentLoanMetrics.overdueLoans === 1 ? "" : "s"} · principal repayments do
                        not count as profit
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                      <div>
                        <CardTitle className="text-base">Customer payment status</CardTitle>
                        <CardDescription>
                          {paymentLoanMetrics.partiallyPaidTransactions} partially paid ·{" "}
                          {paymentLoanMetrics.overdueCustomerPayments} overdue
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("payments-loans")}
                      >
                        Manage <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {outstandingPaymentRows.length === 0 ? (
                        <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                          No customer payments are outstanding.
                        </p>
                      ) : (
                        outstandingPaymentRows.map(({ transaction, summary }) => (
                          <div
                            key={transaction.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {transaction.customerName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {summary.status.replaceAll("_", " ")}
                                {transaction.dueDate ? ` · Due ${transaction.dueDate}` : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">
                                {formatBusinessMoney(summary.outstanding, "HTG")}
                              </p>
                              <p className="text-xs text-muted-foreground">remaining</p>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                      <div>
                        <CardTitle className="text-base">Upcoming loan repayments</CardTitle>
                        <CardDescription>
                          Due in the next 30 days · overdue shown first
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("payments-loans")}
                      >
                        Manage <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {[...overdueLoanRows, ...upcomingLoanRows].length === 0 ? (
                        <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                          No loan repayments are due soon.
                        </p>
                      ) : (
                        [...overdueLoanRows, ...upcomingLoanRows].slice(0, 5).map((loan) => {
                          const summary = calculateLoanSummary(
                            loan,
                            loanRepayments.filter((repayment) => repayment.loanId === loan.id),
                          );
                          const isOverdue = loan.dueDate !== null && loan.dueDate < today();
                          return (
                            <div
                              key={loan.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{loan.customerName}</p>
                                <p
                                  className={`text-xs ${
                                    isOverdue
                                      ? "font-medium text-rose-700 dark:text-rose-300"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {isOverdue ? "Overdue" : "Due"} · {loan.dueDate}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">
                                  {formatBusinessMoney(summary.nextRepayment, loan.currency)}
                                </p>
                                <p className="text-xs text-muted-foreground">principal + charges</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>

                <details className="group rounded-xl border bg-card p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    Detailed accounting overview and balances
                  </summary>
                  <div className="space-y-5 pt-5">
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                      {[
                        {
                          label: "Available Meru balance",
                          value: hasMeruAccount
                            ? formatBusinessMoney(metrics.meruWalletBalance, "USD")
                            : "Not set up",
                          currency: "USD",
                          icon: Wallet,
                          cardClass:
                            "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/35",
                          iconClass:
                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200",
                        },
                        {
                          label: "Available cash balance",
                          value: formatBusinessMoney(metrics.cashOnHand, "HTG"),
                          currency: "HTG",
                          icon: PiggyBank,
                          cardClass:
                            "border-violet-200/80 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/35",
                          iconClass:
                            "bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-200",
                        },
                        {
                          label: "Customer payments received",
                          value: formatBusinessMoney(metrics.totalCustomerReceipts, "HTG"),
                          currency: "HTG",
                          icon: CircleDollarSign,
                          cardClass:
                            "border-blue-200/80 bg-blue-50/70 dark:border-blue-900/70 dark:bg-blue-950/35",
                          iconClass:
                            "bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-200",
                        },
                        {
                          label: "Operating costs",
                          value: formatBusinessMoney(metrics.totalBusinessExpenses, "USD"),
                          currency: "USD estimate",
                          icon: HandCoins,
                          cardClass:
                            "border-rose-200/80 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/35",
                          iconClass:
                            "bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-200",
                        },
                      ].map(({ label, value, currency, icon: Icon, cardClass, iconClass }) => (
                        <Card key={label} className={`overflow-hidden ${cardClass}`}>
                          <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                {label}
                              </p>
                              <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {value}
                              </p>
                              <span className="mt-2 inline-flex rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                {currency}
                              </span>
                            </div>
                            <span
                              className={`grid size-10 shrink-0 place-items-center rounded-full ${iconClass}`}
                            >
                              <Icon className="size-5" aria-hidden="true" />
                            </span>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr_1.1fr]">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">Profit &amp; loss</CardTitle>
                              <CardDescription className="mt-1">
                                Current reporting period · USD estimate
                              </CardDescription>
                            </div>
                            <span className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                              <TrendingUp className="size-4" aria-hidden="true" />
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                            {formatBusinessMoney(metrics.netProfit, "USD")}
                          </p>
                          <p className="text-xs text-muted-foreground">Net profit</p>
                          <div className="mt-5 space-y-4">
                            {[
                              {
                                label: "Net profit",
                                value: Math.abs(metrics.netProfit),
                                display: formatBusinessMoney(metrics.netProfit, "USD"),
                                color: "bg-emerald-500",
                              },
                              {
                                label: "Operating costs",
                                value: metrics.totalBusinessExpenses,
                                display: formatBusinessMoney(metrics.totalBusinessExpenses, "USD"),
                                color: "bg-blue-500",
                              },
                            ].map((item) => {
                              const maxValue = Math.max(
                                Math.abs(metrics.netProfit),
                                metrics.totalBusinessExpenses,
                                1,
                              );
                              return (
                                <div key={item.label}>
                                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                                    <span className="text-muted-foreground">{item.label}</span>
                                    <span className="font-semibold text-foreground">
                                      {item.display}
                                    </span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                      className={`h-full rounded-full ${item.color}`}
                                      style={{
                                        width: `${Math.min(100, (item.value / maxValue) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {metrics.profitIncomplete && (
                            <p className="mt-4 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                              Some costs or income lack a recorded exchange rate, so profit is
                              incomplete.
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">Collections by currency</CardTitle>
                              <CardDescription className="mt-1">
                                Persisted customer payments in this period
                              </CardDescription>
                            </div>
                            <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
                              <Receipt className="size-4" aria-hidden="true" />
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {Object.keys(collectionTotalsByCurrency).length === 0 ? (
                            <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                              No customer payments recorded in this period.
                            </p>
                          ) : (
                            Object.entries(collectionTotalsByCurrency)
                              .sort(([left], [right]) => left.localeCompare(right))
                              .map(([currency, amount]) => (
                                <div
                                  key={currency}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3"
                                >
                                  <span className="flex items-center gap-2 text-sm font-medium">
                                    <span className="size-2 rounded-full bg-violet-500 dark:bg-violet-300" />
                                    {currency} collected
                                  </span>
                                  <span className="font-semibold">
                                    {formatBusinessMoney(amount, currency)}
                                  </span>
                                </div>
                              ))
                          )}
                          <p className="pt-2 text-xs text-muted-foreground">
                            Amounts in different currencies are kept separate.
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">Recent activity</CardTitle>
                              <CardDescription className="mt-1">
                                Latest saved business records
                              </CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveTab("transactions")}
                            >
                              View all <ArrowRight className="ml-1 size-3.5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {recentActivity.length === 0 ? (
                            <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                              Your saved business activity will appear here.
                            </p>
                          ) : (
                            <ul className="divide-y divide-border">
                              {recentActivity.map((activity) => (
                                <li
                                  key={activity.id}
                                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span
                                      className={`grid size-8 shrink-0 place-items-center rounded-full ${
                                        activity.direction === "in"
                                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                          : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                      }`}
                                    >
                                      {activity.direction === "in" ? (
                                        <ArrowDownToLine className="size-4" aria-hidden="true" />
                                      ) : (
                                        <ArrowUpRight className="size-4" aria-hidden="true" />
                                      )}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">
                                        {activity.title}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {activity.detail} · {activity.date.slice(0, 10)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p
                                      className={`text-sm font-semibold ${
                                        activity.direction === "in"
                                          ? "text-emerald-700 dark:text-emerald-300"
                                          : "text-foreground"
                                      }`}
                                    >
                                      {activity.direction === "in" ? "+" : "−"}
                                      {formatBusinessMoney(activity.amount, activity.currency)}
                                    </p>
                                    <p className="text-[10px] capitalize text-muted-foreground">
                                      {activity.status.replaceAll("_", " ")}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">Top customers</CardTitle>
                              <CardDescription className="mt-1">
                                Recorded payments · HTG
                              </CardDescription>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveTab("customers")}
                            >
                              View all <ArrowRight className="ml-1 size-3.5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {topCustomerRows.length === 0 ? (
                            <p className="rounded-lg bg-muted/60 p-4 text-sm text-muted-foreground">
                              Customer activity will appear when records are saved.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="text-muted-foreground">
                                  <tr>
                                    <th className="pb-2 font-medium">Customer</th>
                                    <th className="pb-2 text-right font-medium">Payments</th>
                                    <th className="pb-2 text-right font-medium">Operations</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {topCustomerRows.map((customer) => (
                                    <tr key={customer.id}>
                                      <td className="max-w-32 truncate py-2.5 font-medium">
                                        {customer.name}
                                      </td>
                                      <td className="py-2.5 text-right font-semibold">
                                        {formatBusinessMoney(customer.paid, "HTG")}
                                      </td>
                                      <td className="py-2.5 text-right text-muted-foreground">
                                        {customer.transactions}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Outstanding balances</CardTitle>
                          <CardDescription className="mt-1">
                            By currency · no mixed totals
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3">
                            <span className="text-sm">Customer payments · HTG</span>
                            <span className="font-semibold">
                              {formatBusinessMoney(
                                paymentLoanMetrics.outstandingCustomerPayments,
                                "HTG",
                              )}
                            </span>
                          </div>
                          {Object.entries(
                            paymentLoanMetrics.outstandingLoanPrincipalByCurrency,
                          ).map(([currency, amount]) => (
                            <div
                              key={currency}
                              className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3"
                            >
                              <span className="text-sm">Loan principal · {currency}</span>
                              <span className="font-semibold">
                                {formatBusinessMoney(amount, currency)}
                              </span>
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground">
                            {paymentLoanMetrics.partiallyPaidTransactions} partially paid ·{" "}
                            {paymentLoanMetrics.overdueCustomerPayments} overdue payments ·{" "}
                            {paymentLoanMetrics.overdueLoans} overdue loans
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Quick actions</CardTitle>
                          <CardDescription className="mt-1">
                            Jump to an existing workflow
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                          <Button
                            className="justify-start bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => setActiveTab("payments-loans")}
                          >
                            <Plus className="size-4" /> Record customer payment
                          </Button>
                          <Button
                            className="justify-start"
                            onClick={() => setActiveTab("payments-loans")}
                          >
                            <Plus className="size-4" /> Issue a loan or record repayment
                          </Button>
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => setActiveTab("expenses")}
                          >
                            <Plus className="size-4" /> Add expense
                          </Button>
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => setActiveTab("funding")}
                          >
                            <Plus className="size-4" /> Add funding
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Outstanding loan principal by currency</CardTitle>
                        <CardDescription>
                          Principal is not revenue. Currency totals stay separate unless recorded
                          rates support a reporting-currency conversion.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-3">
                        {Object.entries(paymentLoanMetrics.outstandingLoanPrincipalByCurrency)
                          .length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No outstanding loan principal.
                          </p>
                        ) : (
                          Object.entries(paymentLoanMetrics.outstandingLoanPrincipalByCurrency).map(
                            ([currency, amount]) => (
                              <div key={currency} className="rounded-md border px-3 py-2">
                                <p className="text-xs text-muted-foreground">{currency}</p>
                                <p className="font-semibold">
                                  {formatBusinessMoney(amount, currency)}
                                </p>
                              </div>
                            ),
                          )
                        )}
                      </CardContent>
                    </Card>
                    {(metrics.valuationIncomplete ||
                      metrics.expensesIncomplete ||
                      metrics.profitIncomplete) && (
                      <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        One or more totals are incomplete estimates because a required operation
                        cost or recorded exchange rate is missing.
                      </p>
                    )}
                    <Card>
                      <CardHeader>
                        <CardTitle>Business accounts</CardTitle>
                        <CardDescription>
                          Balances come from immutable ledger entries plus each account’s opening
                          balance. Pending operations do not affect available balances. Internal
                          transfers move value between accounts and are not revenue.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {accounts.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No accounts yet. Create the accounts you actually use in Funding &
                            accounts.
                          </p>
                        ) : (
                          accounts.map((account) => (
                            <div key={account.id} className="rounded-md border p-3">
                              <p className="font-medium">{account.name}</p>
                              <p className="text-xs capitalize text-muted-foreground">
                                {account.type} · {account.currency}
                              </p>
                              <p className="mt-2 text-lg font-semibold">
                                {formatBusinessMoney(account.balance, account.currency)}
                              </p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                    {accounts.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Record balance adjustment</CardTitle>
                          <CardDescription>
                            Corrections are append-only, require a reason, and cannot reduce an
                            account below zero.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <form
                            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                            onSubmit={(event) => void onCreateAdjustment(event)}
                          >
                            <Field label="Account">
                              <select
                                name="accountId"
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                required
                              >
                                {accounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.name} · {account.currency}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field
                              label="Signed amount"
                              hint="Positive adds to balance; negative reduces it."
                            >
                              <Input name="amount" type="number" step="0.00000001" required />
                            </Field>
                            <Field label="Reason">
                              <Input name="reason" required maxLength={500} />
                            </Field>
                            <Button type="submit" disabled={isMutating}>
                              Record adjustment
                            </Button>
                          </form>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </details>
              </div>
            </details>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Record customer operation</CardTitle>
                <CardDescription>
                  HTG amount due and USD sent are separate. Confirming a transfer only posts the USD
                  movement; actual customer collections are recorded separately under Payments &
                  loans.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {customers.length === 0 || htgAccounts.length === 0 || usdAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Create a customer and an HTG receipt account and USD payout account before
                    recording operations.
                  </p>
                ) : (
                  <form
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                    onSubmit={(event) => void onCreateTransaction(event)}
                  >
                    <Field label="Customer">
                      <select
                        name="customerId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="HTG receipt account">
                      <select
                        name="receiptAccountId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {htgAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="USD payout account">
                      <select
                        name="payoutAccountId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {usdAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date and time">
                      <Input
                        name="transactionDate"
                        type="datetime-local"
                        defaultValue={new Date().toISOString().slice(0, 16)}
                        required
                      />
                    </Field>
                    <Field label="Payment due date (optional)">
                      <Input name="dueDate" type="date" />
                    </Field>
                    <Field label="HTG amount due">
                      <Input name="htgReceived" type="number" min="0" step="0.01" required />
                    </Field>
                    <Field label="USD sent">
                      <Input name="usdSent" type="number" min="0" step="0.01" required />
                    </Field>
                    <Field label="Exchange rate (HTG per USD)">
                      <Input name="exchangeRate" type="number" min="0.000001" step="0.000001" />
                    </Field>
                    <Field label="Service fee / markup (USD)">
                      <Input name="serviceFee" type="number" min="0" step="0.01" />
                    </Field>
                    <Field label="Crypto acquisition cost (USD)">
                      <Input name="cryptoCost" type="number" min="0" step="0.01" />
                    </Field>
                    <Field label="Transfer fee (USD)">
                      <Input
                        name="transferFee"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue="0"
                        required
                      />
                    </Field>
                    <Field label="Other operation expenses (USD)">
                      <Input name="otherExpenses" type="number" min="0" step="0.01" />
                    </Field>
                    <Field label="Reference">
                      <Input name="reference" />
                    </Field>
                    <Field label="Notes">
                      <Input name="notes" />
                    </Field>
                    <div className="sm:col-span-2 xl:col-span-3">
                      <Button type="submit" disabled={isMutating}>
                        Record pending operation
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer transactions</CardTitle>
                <CardDescription>
                  {startDate} through {endDate}. Customer and status filters apply to this period.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <Field label="Customer">
                    <select
                      value={customerFilter}
                      onChange={(event) => setCustomerFilter(event.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All customers</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Account">
                    <select
                      value={transactionAccountFilter}
                      onChange={(event) => setTransactionAccountFilter(event.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All accounts</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {["all", "pending", "completed", "failed", "cancelled", "reversed"].map(
                        (status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                </div>
                {visibleTransactions.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">
                    No saved customer transactions match these filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-4">Customer / reference</th>
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">HTG amount due</th>
                          <th className="py-2 pr-4">USD sent</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Profit estimate</th>
                          <th className="py-2 pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTransactions.map((transaction) => (
                          <tr key={transaction.id} className="border-b align-top last:border-0">
                            <td className="py-3 pr-4">
                              {transaction.customerName}
                              <span className="block text-xs text-muted-foreground">
                                {transaction.reference ?? "No reference"}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              {new Date(transaction.transactionDate).toLocaleString()}
                            </td>
                            <td className="py-3 pr-4">
                              {formatBusinessMoney(transaction.htgReceived, "HTG")}
                            </td>
                            <td className="py-3 pr-4">
                              {formatBusinessMoney(transaction.usdSent, "USD")}
                            </td>
                            <td className="py-3 pr-4">
                              <StatusBadge status={transaction.status} />
                            </td>
                            <td className="py-3 pr-4">{renderProfit(transaction)}</td>
                            <td className="py-3 pr-4">
                              <OperationActions
                                type="customer_transaction"
                                id={transaction.id}
                                status={transaction.status}
                                disabled={isMutating}
                                onAction={(action) =>
                                  void changeStatus("customer_transaction", transaction.id, action)
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments-loans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Collect customer payment</CardTitle>
                <CardDescription>
                  Record each real installment separately. Collections credit the chosen HTG
                  account, independently of whether the related USD transfer is complete.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.filter(
                  (transaction) =>
                    !["failed", "cancelled", "reversed"].includes(transaction.status),
                ).length === 0 || htgAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Create a customer transaction and an HTG account before recording collections.
                  </p>
                ) : (
                  <form
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    onSubmit={(event) => void onCreatePayment(event)}
                  >
                    <Field label="Customer transaction">
                      <select
                        name="paymentTransactionId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {transactions
                          .filter(
                            (transaction) =>
                              !["failed", "cancelled", "reversed"].includes(transaction.status),
                          )
                          .map((transaction) => (
                            <option key={transaction.id} value={transaction.id}>
                              {transaction.customerName} ·{" "}
                              {formatBusinessMoney(transaction.htgReceived, "HTG")} ·{" "}
                              {transaction.status}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Collection account">
                      <select
                        name="paymentAccountId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {htgAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · HTG
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Amount collected (HTG)">
                      <Input name="paymentAmount" type="number" min="0.01" step="0.01" required />
                    </Field>
                    <Field label="Payment method">
                      <select
                        name="paymentMethod"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue="cash"
                        required
                      >
                        <option value="cash">Cash</option>
                        <option value="moncash">MonCash</option>
                        <option value="natcash">NatCash</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                    <Field label="Payment date">
                      <Input name="paymentDate" type="date" defaultValue={today()} required />
                    </Field>
                    <Field label="Reference (optional)">
                      <Input name="paymentReference" maxLength={200} />
                    </Field>
                    <Field label="Notes (optional)">
                      <Input name="paymentNotes" maxLength={1000} />
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" disabled={isMutating}>
                        Record payment
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer payment balances</CardTitle>
                <CardDescription>
                  Paid and outstanding amounts are calculated from persisted payment records.
                  Overpayments are rejected atomically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No customer transactions yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3">Customer</th>
                          <th className="py-2 pr-3">Due date</th>
                          <th className="py-2 pr-3">Amount due (HTG)</th>
                          <th className="py-2 pr-3">Paid (HTG)</th>
                          <th className="py-2 pr-3">Outstanding (HTG)</th>
                          <th className="py-2 pr-3">Payment status</th>
                          <th className="py-2 pr-3">Transfer status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((transaction) => {
                          const paymentSummary = calculateCustomerPaymentSummary(
                            transaction,
                            payments.filter(
                              (payment) => payment.customerTransactionId === transaction.id,
                            ),
                          );
                          return (
                            <tr key={transaction.id} className="border-b align-top">
                              <td className="py-3 pr-3">{transaction.customerName}</td>
                              <td className="py-3 pr-3">{transaction.dueDate ?? "—"}</td>
                              <td className="py-3 pr-3">
                                {formatBusinessMoney(transaction.htgReceived, "HTG")}
                              </td>
                              <td className="py-3 pr-3">
                                {formatBusinessMoney(paymentSummary.totalPaid, "HTG")}
                              </td>
                              <td className="py-3 pr-3">
                                {formatBusinessMoney(paymentSummary.outstanding, "HTG")}
                              </td>
                              <td className="py-3 pr-3">
                                <StatusBadge status={paymentSummary.status} />
                              </td>
                              <td className="py-3 pr-3">
                                <StatusBadge status={transaction.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <h3 className="mb-2 font-medium">Payment history</h3>
                  {payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments recorded.</p>
                  ) : (
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Customer</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">Method</th>
                          <th className="py-2 pr-3">Account</th>
                          <th className="py-2 pr-3">Reference / notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => {
                          const transaction = transactions.find(
                            (item) => item.id === payment.customerTransactionId,
                          );
                          const account = accounts.find((item) => item.id === payment.accountId);
                          return (
                            <tr key={payment.id} className="border-b">
                              <td className="py-2 pr-3">{payment.paymentDate}</td>
                              <td className="py-2 pr-3">
                                {transaction?.customerName ?? "Unknown customer"}
                              </td>
                              <td className="py-2 pr-3">
                                {formatBusinessMoney(payment.amount, payment.currency)}
                              </td>
                              <td className="py-2 pr-3 capitalize">{payment.paymentMethod}</td>
                              <td className="py-2 pr-3">{account?.name ?? "Unknown account"}</td>
                              <td className="py-2 pr-3">
                                {payment.reference ?? payment.notes ?? "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Issue loan</CardTitle>
                <CardDescription>
                  Issuance immediately disburses principal from the selected account. Principal is
                  an asset, not revenue; agreed interest and fees are recognized only when
                  collected.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {customers.length === 0 || accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Create a customer and account before issuing a loan.
                  </p>
                ) : (
                  <form
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    onSubmit={(event) => void onCreateLoan(event)}
                  >
                    <Field label="Borrower">
                      <select
                        name="loanCustomerId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Disbursement account">
                      <select
                        name="loanAccountId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currency}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Principal amount">
                      <Input name="loanPrincipal" type="number" min="0.01" step="0.01" required />
                    </Field>
                    <Field label="Date issued">
                      <Input name="loanIssuedDate" type="date" defaultValue={today()} required />
                    </Field>
                    <Field label="Due date (optional)">
                      <Input name="loanDueDate" type="date" />
                    </Field>
                    <Field label="Agreed interest (optional)">
                      <Input
                        name="loanInterest"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue="0"
                      />
                    </Field>
                    <Field label="Agreed fee (optional)">
                      <Input name="loanFee" type="number" min="0" step="0.01" defaultValue="0" />
                    </Field>
                    <Field label="Notes (optional)">
                      <Input name="loanNotes" maxLength={1000} />
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" disabled={isMutating}>
                        Issue loan
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Record loan repayment</CardTitle>
                <CardDescription>
                  Repayments apply first to agreed interest, then fees, then principal. The ledger
                  records principal and income components separately and prevents overpayment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {repaymentLoans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No outstanding loans are available for repayment.
                  </p>
                ) : (
                  <form
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    onSubmit={(event) => void onCreateLoanRepayment(event)}
                  >
                    <Field label="Loan">
                      <select
                        name="repaymentLoanId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {repaymentLoans.map((loan) => {
                          const due = loanAmountsDue(loan, loanRepayments);
                          return (
                            <option key={loan.id} value={loan.id}>
                              {loan.customerName} ·{" "}
                              {formatBusinessMoney(
                                due.principal + due.interest + due.fee,
                                loan.currency,
                              )}{" "}
                              due
                            </option>
                          );
                        })}
                      </select>
                    </Field>
                    <Field label="Receiving account">
                      <select
                        name="repaymentAccountId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currency}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Amount received">
                      <Input name="repaymentAmount" type="number" min="0.01" step="0.01" required />
                    </Field>
                    <Field label="Repayment date">
                      <Input name="repaymentDate" type="date" defaultValue={today()} required />
                    </Field>
                    <Field label="Reference (optional)">
                      <Input name="repaymentReference" maxLength={200} />
                    </Field>
                    <Field label="Notes (optional)">
                      <Input name="repaymentNotes" maxLength={1000} />
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" disabled={isMutating}>
                        Record repayment
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Loan balances and repayment history</CardTitle>
                <CardDescription>
                  Loan balances remain grouped by currency. Due dates and status update from the
                  persisted loan and repayment records.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No loans recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3">Borrower</th>
                          <th className="py-2 pr-3">Issued / due</th>
                          <th className="py-2 pr-3">Principal outstanding</th>
                          <th className="py-2 pr-3">Interest / fees outstanding</th>
                          <th className="py-2 pr-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loans.map((loan) => {
                          const due = loanAmountsDue(loan, loanRepayments);
                          const isPastDue =
                            loan.dueDate !== null &&
                            loan.dueDate < today() &&
                            due.principal + due.interest + due.fee > 0;
                          return (
                            <tr key={loan.id} className="border-b">
                              <td className="py-3 pr-3">{loan.customerName}</td>
                              <td className="py-3 pr-3">
                                {loan.issuedDate} / {loan.dueDate ?? "No due date"}
                              </td>
                              <td className="py-3 pr-3">
                                {formatBusinessMoney(due.principal, loan.currency)}
                              </td>
                              <td className="py-3 pr-3">
                                {formatBusinessMoney(due.interest + due.fee, loan.currency)}
                              </td>
                              <td className="py-3 pr-3">
                                <StatusBadge
                                  status={
                                    due.principal + due.interest + due.fee <= 0
                                      ? "repaid"
                                      : isPastDue
                                        ? "overdue"
                                        : loan.status
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <section className="rounded-md border p-3">
                  <h3 className="mb-2 font-medium">Upcoming and overdue loan due dates</h3>
                  {loansDueSoon.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No outstanding loans are due within the next 30 days or overdue.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px] text-sm">
                        <thead className="text-left text-muted-foreground">
                          <tr className="border-b">
                            <th className="py-2 pr-3">Borrower</th>
                            <th className="py-2 pr-3">Due date</th>
                            <th className="py-2 pr-3">Amount remaining</th>
                            <th className="py-2 pr-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loansDueSoon.map((loan) => {
                            const due = loanAmountsDue(loan, loanRepayments);
                            const isPastDue = (loan.dueDate ?? "") < today();
                            return (
                              <tr key={loan.id} className="border-b">
                                <td className="py-2 pr-3">{loan.customerName}</td>
                                <td className="py-2 pr-3">{loan.dueDate}</td>
                                <td className="py-2 pr-3">
                                  {formatBusinessMoney(
                                    due.principal + due.interest + due.fee,
                                    loan.currency,
                                  )}
                                </td>
                                <td className="py-2 pr-3">
                                  <StatusBadge status={isPastDue ? "overdue" : "upcoming"} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
                <div className="overflow-x-auto">
                  <h3 className="mb-2 font-medium">Repayment history</h3>
                  {loanRepayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No loan repayments recorded.</p>
                  ) : (
                    <table className="w-full min-w-[750px] text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Borrower</th>
                          <th className="py-2 pr-3">Principal</th>
                          <th className="py-2 pr-3">Interest</th>
                          <th className="py-2 pr-3">Fee</th>
                          <th className="py-2 pr-3">Total received</th>
                          <th className="py-2 pr-3">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loanRepayments.map((repayment) => {
                          const loan = loans.find((item) => item.id === repayment.loanId);
                          return (
                            <tr key={repayment.id} className="border-b">
                              <td className="py-2 pr-3">{repayment.repaymentDate}</td>
                              <td className="py-2 pr-3">
                                {loan?.customerName ?? "Unknown borrower"}
                              </td>
                              <td className="py-2 pr-3">
                                {formatBusinessMoney(repayment.principalPaid, repayment.currency)}
                              </td>
                              <td className="py-2 pr-3">
                                {formatBusinessMoney(repayment.interestPaid, repayment.currency)}
                              </td>
                              <td className="py-2 pr-3">
                                {formatBusinessMoney(repayment.feePaid, repayment.currency)}
                              </td>
                              <td className="py-2 pr-3">
                                {formatBusinessMoney(repayment.amount, repayment.currency)}
                              </td>
                              <td className="py-2 pr-3">{repayment.reference ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {[
                {
                  label: "Total clients",
                  value: String(customers.length),
                  note: "Profils enregistrés",
                  icon: UsersRound,
                  accent: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
                },
                {
                  label: "Clients actifs",
                  value: String(
                    customerRows.filter(({ transactionCount }) => transactionCount > 0).length,
                  ),
                  note: "Avec au moins une opération enregistrée",
                  icon: TrendingUp,
                  accent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
                },
                {
                  label: "Paiements à recevoir",
                  value: String(customerRows.filter(({ outstanding }) => outstanding > 0).length),
                  note: `${formatBusinessMoney(paymentLoanMetrics.outstandingCustomerPayments, "HTG")} à recevoir`,
                  icon: HandCoins,
                  accent: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
                },
                {
                  label: "Clients avec prêts",
                  value: String(new Set(activeLoans.map((loan) => loan.customerId)).size),
                  note: "Principal suivi séparément",
                  icon: PiggyBank,
                  accent: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                },
              ].map(({ label, value, note, icon: Icon, accent }) => (
                <Card
                  key={label}
                  className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-[#173451] dark:bg-[#091a2e]"
                >
                  <CardContent className="flex min-h-[98px] items-center gap-3 p-3.5">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-full shadow-sm ${accent}`}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-muted-foreground">{label}</p>
                      <p className="text-xl font-bold text-foreground">{value}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{note}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(285px,0.85fr)]">
              <Card className="min-w-0 border-slate-200 bg-white shadow-sm dark:border-[#173451] dark:bg-[#091a2e]">
                <CardHeader className="space-y-3 border-b border-slate-100 pb-3 dark:border-[#142d47]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Clients</CardTitle>
                      <CardDescription className="text-xs">
                        Profils et activité liée aux opérations Business.
                      </CardDescription>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(140px,1fr)_auto_auto_auto]">
                    <div className="relative min-w-0">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        aria-label="Rechercher un client"
                        value={customerSearch}
                        onChange={(event) => {
                          setCustomerSearch(event.target.value);
                          setCustomerPage(1);
                        }}
                        placeholder="Rechercher un client…"
                        className="h-9 pl-9 text-xs"
                      />
                    </div>
                    <select
                      aria-label="Filtrer par paiement"
                      value={customerPaymentFilter}
                      onChange={(event) => {
                        setCustomerPaymentFilter(event.target.value);
                        setCustomerPage(1);
                      }}
                      className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="all">Tous les paiements</option>
                      <option value="pending">À recevoir</option>
                      <option value="clear">Aucun solde dû</option>
                    </select>
                    <select
                      aria-label="Filtrer par activité"
                      value={customerActivityFilter}
                      onChange={(event) => {
                        setCustomerActivityFilter(event.target.value);
                        setCustomerPage(1);
                      }}
                      className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="all">Toute l’activité</option>
                      <option value="active">Avec opérations</option>
                      <option value="new">Sans opération</option>
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 bg-teal-500 text-xs text-[#041521] hover:bg-teal-400"
                      onClick={() => document.getElementById("business-customer-name")?.focus()}
                    >
                      <Plus className="size-3.5" aria-hidden="true" /> Ajouter un client
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {customers.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground">
                      Aucun client enregistré. Ajoutez un client pour commencer.
                    </p>
                  ) : visibleCustomers.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground">
                      Aucun client ne correspond à cette recherche ou à ces filtres.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[680px] text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-[#071426] dark:text-slate-400">
                          <tr>
                            <th className="px-3 py-3 font-medium">Nom du client</th>
                            <th className="px-3 py-3 font-medium">Contact</th>
                            <th className="px-3 py-3 text-center font-medium">Statut</th>
                            <th className="px-3 py-3 text-right font-medium">Opérations</th>
                            <th className="px-3 py-3 text-right font-medium">Solde dû (HTG)</th>
                            <th className="px-3 py-3 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#142d47]">
                          {paginatedCustomers.map(
                            ({ customer, history, outstanding, transactionCount }) => {
                              const initials = customer.name
                                .trim()
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((part) => part.charAt(0).toLocaleUpperCase())
                                .join("");
                              return (
                                <tr
                                  key={customer.id}
                                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-[#0c2037]"
                                >
                                  <td className="px-3 py-3">
                                    <div className="flex min-w-40 items-center gap-2.5">
                                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-100 text-[10px] font-semibold text-cyan-800 dark:bg-[#102f50] dark:text-cyan-200">
                                        {initials || "?"}
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium text-foreground">
                                          {customer.name}
                                        </span>
                                        <span className="block truncate text-[10px] text-muted-foreground">
                                          {customer.nickname || "Client"}
                                        </span>
                                      </span>
                                    </div>
                                  </td>
                                  <td className="max-w-40 px-3 py-3 text-muted-foreground">
                                    <span className="block truncate">
                                      {customer.contact || "—"}
                                    </span>
                                    {customer.contact && (
                                      <span className="block text-[10px] text-muted-foreground/70">
                                        Contact fourni
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {outstanding > 0 ? (
                                      <Badge className="border-0 bg-amber-100 text-[10px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                        En attente
                                      </Badge>
                                    ) : transactionCount > 0 ? (
                                      <Badge className="border-0 bg-teal-100 text-[10px] text-teal-900 dark:bg-teal-950 dark:text-teal-200">
                                        À jour
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] text-muted-foreground"
                                      >
                                        Nouveau
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-right">{transactionCount}</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-right">
                                    <span
                                      className={
                                        outstanding > 0
                                          ? "font-semibold text-amber-700 dark:text-amber-300"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {formatBusinessMoney(outstanding, "HTG")}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <details className="relative inline-block text-left">
                                      <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-cyan-300 dark:hover:bg-[#10243b]">
                                        Gérer
                                      </summary>
                                      <div className="absolute right-0 z-20 mt-2 w-72 max-w-[80vw] rounded-xl border border-slate-200 bg-background p-4 text-left shadow-xl dark:border-[#1a3653]">
                                        <p className="mb-3 text-xs text-muted-foreground">
                                          Ajouté le{" "}
                                          {new Date(customer.createdAt).toLocaleDateString()}
                                          {customer.notes ? ` · ${customer.notes}` : ""}
                                        </p>
                                        <form
                                          className="space-y-2"
                                          onSubmit={(event) =>
                                            void onUpdateCustomer(event, customer.id)
                                          }
                                        >
                                          <Field label="Nom complet">
                                            <Input
                                              name="name"
                                              defaultValue={customer.name}
                                              required
                                              maxLength={160}
                                            />
                                          </Field>
                                          <Field label="Référence">
                                            <Input
                                              name="nickname"
                                              defaultValue={customer.nickname ?? ""}
                                              maxLength={100}
                                            />
                                          </Field>
                                          <Field label="Contact">
                                            <Input
                                              name="contact"
                                              defaultValue={customer.contact ?? ""}
                                              maxLength={200}
                                            />
                                          </Field>
                                          <Field label="Notes">
                                            <Input
                                              name="notes"
                                              defaultValue={customer.notes ?? ""}
                                              maxLength={1000}
                                            />
                                          </Field>
                                          <Button type="submit" size="sm" disabled={isMutating}>
                                            Enregistrer
                                          </Button>
                                        </form>
                                        <div className="mt-4 space-y-2 border-t pt-3">
                                          <p className="text-xs font-semibold">
                                            Transactions de la période
                                          </p>
                                          {history.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">
                                              Aucune opération sur cette période.
                                            </p>
                                          ) : (
                                            <ul className="max-h-36 space-y-2 overflow-y-auto">
                                              {history.map((item) => (
                                                <li
                                                  key={item.id}
                                                  className="flex items-center justify-between gap-2 text-xs"
                                                >
                                                  <span className="truncate">
                                                    {item.transactionDate.slice(0, 10)} ·{" "}
                                                    {formatBusinessMoney(item.usdSent, "USD")}
                                                  </span>
                                                  <StatusBadge status={item.status} />
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      </div>
                                    </details>
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[10px] text-muted-foreground dark:border-[#142d47]">
                    <span>
                      Affichage de{" "}
                      {visibleCustomers.length === 0
                        ? 0
                        : (currentCustomerPage - 1) * customerPageSize + 1}{" "}
                      à {Math.min(currentCustomerPage * customerPageSize, visibleCustomers.length)}{" "}
                      sur {visibleCustomers.length} client{visibleCustomers.length === 1 ? "" : "s"}
                    </span>
                    <div className="flex items-center gap-1" aria-label="Pagination des clients">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-7"
                        aria-label="Page précédente"
                        disabled={currentCustomerPage <= 1}
                        onClick={() => setCustomerPage((page) => Math.max(1, page - 1))}
                      >
                        <ChevronRight className="size-3.5 rotate-180" aria-hidden="true" />
                      </Button>
                      {Array.from({ length: customerPageCount }, (_, index) => index + 1)
                        .slice(
                          Math.max(0, Math.min(currentCustomerPage - 2, customerPageCount - 3)),
                          Math.max(3, Math.min(currentCustomerPage + 1, customerPageCount)),
                        )
                        .map((page) => (
                          <Button
                            key={page}
                            type="button"
                            size="icon"
                            variant={page === currentCustomerPage ? "default" : "outline"}
                            className="size-7 text-[10px]"
                            aria-label={`Page ${page}`}
                            aria-current={page === currentCustomerPage ? "page" : undefined}
                            onClick={() => setCustomerPage(page)}
                          >
                            {page}
                          </Button>
                        ))}
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-7"
                        aria-label="Page suivante"
                        disabled={currentCustomerPage >= customerPageCount}
                        onClick={() =>
                          setCustomerPage((page) => Math.min(customerPageCount, page + 1))
                        }
                      >
                        <ChevronRight className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <Card className="border-cyan-900/50 bg-white shadow-sm dark:border-[#173451] dark:bg-[#091a2e]">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="grid size-8 place-items-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-300">
                        <UsersRound className="size-4" aria-hidden="true" />
                      </span>
                      Ajouter un client
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Renseignez les coordonnées et informations utiles.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="[&_input]:h-9 [&_input]:text-xs [&_label]:text-[11px] [&_textarea]:text-xs">
                    <form className="space-y-3" onSubmit={(event) => void onCreateCustomer(event)}>
                      <Field label="Nom complet *">
                        <Input
                          id="business-customer-name"
                          name="name"
                          required
                          maxLength={160}
                          placeholder="Ex. Marie Jean"
                        />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <Field label="Téléphone ou e-mail">
                          <Input
                            name="contact"
                            maxLength={200}
                            placeholder="Coordonnées du client"
                          />
                        </Field>
                        <Field label="Référence ou surnom">
                          <Input name="nickname" maxLength={100} placeholder="Référence interne" />
                        </Field>
                      </div>
                      <Field label="Notes (facultatif)">
                        <textarea
                          name="notes"
                          rows={3}
                          maxLength={1000}
                          placeholder="Informations utiles…"
                          className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </Field>
                      <p className="text-[10px] leading-relaxed text-muted-foreground">
                        Les coordonnées sont conservées dans un seul champ de contact. Ne stockez
                        pas d’identifiants de compte.
                      </p>
                      <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-[#173451]">
                        <Button
                          type="submit"
                          disabled={isMutating}
                          className="w-full bg-teal-500 text-[#041521] hover:bg-teal-400"
                        >
                          <UsersRound className="size-4" aria-hidden="true" /> Enregistrer le client
                        </Button>
                        <Button type="reset" variant="outline" className="w-full">
                          Annuler
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card className="relative isolate overflow-hidden border-cyan-900/50 bg-gradient-to-br from-slate-50 to-cyan-50 shadow-sm dark:from-[#08182a] dark:to-[#09283a]">
                  <div
                    className="pointer-events-none absolute -bottom-8 -right-3 size-24 rounded-full border-[12px] border-cyan-500/10"
                    aria-hidden="true"
                  />
                  <CardContent className="relative flex gap-3 p-3.5">
                    <Info
                      className="mt-0.5 size-4 shrink-0 text-cyan-600 dark:text-cyan-300"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs font-semibold">Conseil</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                        Les soldes affichés sont calculés à partir des opérations et paiements
                        enregistrés. Le statut du client n’est pas modifiable séparément.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="funding"
            className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]"
          >
            <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-[#071b35] via-[#0b3150] to-[#0b655f] text-white shadow-lg xl:col-start-1 xl:row-start-1">
              <div
                className="pointer-events-none absolute -right-10 -top-14 size-56 rounded-full border-[32px] border-white/5"
                aria-hidden="true"
              />
              <CardContent className="relative flex flex-wrap items-end justify-between gap-5 p-6">
                <div>
                  <p className="flex items-center gap-2 text-sm text-cyan-100">
                    <Wallet className="size-4" aria-hidden="true" /> Solde du portefeuille Meru
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {formatBusinessMoney(metrics.meruWalletBalance, "USD")}
                  </p>
                  <p className="mt-2 text-xs text-cyan-100/80">
                    Solde actuel basé sur les écritures confirmées des comptes Meru
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 xl:col-start-1 xl:row-start-2 xl:grid-cols-2">
              {[
                {
                  label: "Fonds disponibles",
                  value: formatBusinessMoney(accountValueUsdSummary.usd, "USD"),
                  detail: accountValueUsdSummary.incomplete
                    ? "Conversion incomplète pour certains comptes"
                    : `${accounts.length} compte${accounts.length === 1 ? "" : "s"} enregistré${accounts.length === 1 ? "" : "s"}`,
                  icon: Wallet,
                  color: "text-teal-600",
                },
                {
                  label: "Fonds crédités",
                  value: formatBusinessMoney(fundingCreditSummary.usd, "USD"),
                  detail: fundingCreditSummary.incomplete
                    ? "Taux de conversion manquant"
                    : "Crédits confirmés sur la période",
                  icon: ArrowDownToLine,
                  color: "text-emerald-600",
                },
                {
                  label: "Frais enregistrés",
                  value: formatBusinessMoney(fundingCreditSummary.feesUsd, "USD"),
                  detail: fundingCreditSummary.feesIncomplete
                    ? "Certaines conversions de frais sont manquantes"
                    : "Frais de financement confirmés",
                  icon: Receipt,
                  color: "text-amber-600",
                },
                {
                  label: "Opérations en attente",
                  value: String(periodFundings.filter((item) => item.status === "pending").length),
                  detail: "Non incluses dans les soldes",
                  icon: CircleDollarSign,
                  color: "text-blue-600",
                },
              ].map((item) => (
                <Card
                  key={item.label}
                  className="border-cyan-900/10 shadow-sm dark:border-[#173451]"
                >
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-xl font-semibold">{item.value}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{item.detail}</p>
                    </div>
                    <item.icon className={`size-5 shrink-0 ${item.color}`} aria-hidden="true" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-cyan-900/20 shadow-sm dark:border-[#173451] xl:col-start-1 xl:row-start-3">
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="text-base">Mes comptes</CardTitle>
                  <CardDescription>Suivez vos comptes et leurs soldes.</CardDescription>
                </div>
                <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
                  <Button
                    type="button"
                    size="sm"
                    aria-label="Ajouter un compte"
                    className="shrink-0 bg-teal-500 text-[#041521] hover:bg-teal-400"
                    onClick={() => setAccountDialogOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Ajouter un compte</span>
                  </Button>
                  <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Ajouter un compte</DialogTitle>
                      <DialogDescription>
                        Enregistrez un nouveau compte et son solde d’ouverture.
                      </DialogDescription>
                    </DialogHeader>
                    <form
                      id="business-account-form"
                      className="space-y-4"
                      onSubmit={(event) => void onCreateAccount(event)}
                    >
                      <Field label="Nom du compte">
                        <Input name="name" required maxLength={100} />
                      </Field>
                      <Field label="Type de compte">
                        <select
                          name="type"
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="meru">Portefeuille Meru</option>
                          <option value="cash">Espèces</option>
                          <option value="crypto">Cryptomonnaie</option>
                          <option value="other">Autre</option>
                        </select>
                      </Field>
                      <Field
                        label="Devise / code de l’actif"
                        hint="Exemple : USD, HTG, EUR ou BTC."
                      >
                        <Input
                          name="currency"
                          defaultValue="USD"
                          required
                          minLength={3}
                          maxLength={8}
                          pattern="[A-Za-z0-9]{3,8}"
                        />
                      </Field>
                      <Field label="Solde d’ouverture">
                        <Input
                          name="openingBalance"
                          type="number"
                          min="0"
                          step="0.00000001"
                          defaultValue="0"
                          required
                        />
                      </Field>
                      <Button type="submit" className="w-full" disabled={isMutating}>
                        Créer le compte
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Aucun compte pour le moment. Créez un compte pour enregistrer un financement.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-4">Compte</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Solde d’ouverture</th>
                          <th className="py-2 pr-4">Solde actuel</th>
                          <th className="py-2 pr-3">Crédits confirmés</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((account) => (
                          <tr key={account.id} className="border-b last:border-0">
                            <td className="py-3 pr-4 font-medium">{account.name}</td>
                            <td className="py-3 pr-4 capitalize">
                              {account.type.replaceAll("_", " ")}
                            </td>
                            <td className="py-3 pr-4">
                              {formatBusinessMoney(account.openingBalance ?? 0, account.currency)}
                            </td>
                            <td className="py-3 pr-4 font-semibold">
                              {formatBusinessMoney(account.balance, account.currency)}
                            </td>
                            <td className="py-3 pr-3">
                              {formatBusinessMoney(
                                fundingCreditedByAccount[account.id] ?? 0,
                                account.currency,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-cyan-900/20 shadow-sm dark:border-[#173451] xl:col-start-2 xl:row-span-4 xl:row-start-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="grid size-8 place-items-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-300">
                    <Plus className="size-4" aria-hidden="true" />
                  </span>
                  Ajouter un financement
                </CardTitle>
                <CardDescription>
                  Ajoutez des fonds sur votre portefeuille ou un autre compte. Le solde est mis à
                  jour après confirmation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 [&_input]:h-9 [&_input]:text-xs [&_label]:text-xs">
                {accounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Ajoutez d’abord un compte depuis la section « Mes comptes ».
                    </p>
                  </div>
                ) : (
                  <form
                    id="business-funding-form"
                    className="space-y-3"
                    onSubmit={(event) => void onCreateFunding(event)}
                  >
                    <Field label="Type d’opération">
                      <select
                        name="fundingType"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                      >
                        <option value="replenishment">Apport externe Meru</option>
                        <option value="crypto_purchase">Achat de cryptomonnaie</option>
                        <option value="crypto_transfer">Crédit du portefeuille via crypto</option>
                        <option value="asset_transfer">Transfert interne d’actif</option>
                      </select>
                    </Field>
                    <Field
                      label="Compte source"
                      hint="Laissez vide uniquement pour un apport externe."
                    >
                      <select
                        name="sourceAccountId"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                      >
                        <option value="">Externe / non suivi</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currency}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Compte de destination">
                      <select
                        name="destinationAccountId"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                        required
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currency}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Montant prélevé sur la source">
                      <Input name="sourceAmount" type="number" min="0" step="0.00000001" />
                    </Field>
                    <Field label="Montant effectivement crédité">
                      <Input
                        name="creditedAmount"
                        type="number"
                        min="0.00000001"
                        step="0.00000001"
                        required
                      />
                    </Field>
                    <Field label="Frais dans la devise source">
                      <Input
                        name="feeAmount"
                        type="number"
                        min="0"
                        step="0.00000001"
                        defaultValue="0"
                        required
                      />
                    </Field>
                    <Field label="Frais en USD (pour les rapports de dépenses)">
                      <Input name="feeUsd" type="number" min="0" step="0.01" />
                    </Field>
                    <Field label="Quantité crypto, si applicable">
                      <Input
                        name="cryptoQuantity"
                        type="number"
                        min="0.00000001"
                        step="0.00000001"
                      />
                    </Field>
                    <Field label="Prix unitaire crypto (USD)">
                      <Input
                        name="cryptoUnitPriceUsd"
                        type="number"
                        min="0.00000001"
                        step="0.00000001"
                      />
                    </Field>
                    <Field label="Date">
                      <Input
                        name="fundingDate"
                        type="datetime-local"
                        defaultValue={new Date().toISOString().slice(0, 16)}
                        required
                      />
                    </Field>
                    <Field label="Référence">
                      <Input name="reference" />
                    </Field>
                    <Field label="Notes">
                      <Input name="notes" />
                    </Field>
                    <Button
                      type="submit"
                      className="w-full bg-teal-500 text-[#041521] hover:bg-teal-400"
                      disabled={isMutating}
                    >
                      <Receipt className="size-4" aria-hidden="true" />
                      Enregistrer le financement
                    </Button>
                  </form>
                )}
                <div className="border-t pt-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Financements récents</h3>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() =>
                        document
                          .getElementById("business-funding-history")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      Voir tout <ChevronRight className="size-3" aria-hidden="true" />
                    </Button>
                  </div>
                  {fundings.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun financement enregistré.</p>
                  ) : (
                    <ul className="space-y-3">
                      {[...fundings]
                        .sort(
                          (left, right) =>
                            new Date(right.funding_date).getTime() -
                            new Date(left.funding_date).getTime(),
                        )
                        .slice(0, 3)
                        .map((item) => {
                          const destination = accounts.find(
                            (account) => account.id === item.destination_account_id,
                          );
                          return (
                            <li key={item.id} className="flex items-center gap-3 text-xs">
                              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300">
                                <ArrowDownToLine className="size-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {item.funding_type.replaceAll("_", " ")}
                                  {destination ? ` · ${destination.name}` : ""}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(item.funding_date).toLocaleDateString()}
                                </span>
                              </span>
                              <span className="text-right">
                                <span className="block font-semibold">
                                  {formatBusinessMoney(
                                    Number(item.credited_amount),
                                    destination?.currency ?? "",
                                  )}
                                </span>
                                <StatusBadge status={item.status} />
                              </span>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card
              id="business-funding-history"
              className="border-cyan-900/20 shadow-sm dark:border-[#173451] xl:col-start-1 xl:row-start-4"
            >
              <CardHeader>
                <CardTitle>Historique des financements et grand livre</CardTitle>
                <CardDescription>
                  Les soldes sont calculés à partir des soldes d’ouverture et des écritures
                  confirmées.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fundings.length === 0 && ledger.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun financement ni écriture comptable pour le moment.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-3">Financement</th>
                            <th className="py-2 pr-3">Date</th>
                            <th className="py-2 pr-3">Crédité</th>
                            <th className="py-2 pr-3">Statut</th>
                            <th className="py-2 pr-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fundings.map((item) => (
                            <tr key={item.id} className="border-b">
                              <td className="py-3 pr-3">
                                {item.funding_type}
                                {item.reference_code && (
                                  <span className="block text-xs text-muted-foreground">
                                    {item.reference_code}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 pr-3">
                                {new Date(item.funding_date).toLocaleString()}
                              </td>
                              <td className="py-3 pr-3">
                                {formatBusinessMoney(
                                  Number(item.credited_amount),
                                  accounts.find(
                                    (account) => account.id === item.destination_account_id,
                                  )?.currency ?? "",
                                )}
                              </td>
                              <td className="py-3 pr-3">
                                <StatusBadge status={item.status} />
                              </td>
                              <td className="py-3 pr-3">
                                <OperationActions
                                  type="funding"
                                  id={item.id}
                                  status={item.status}
                                  disabled={isMutating}
                                  onAction={(action) =>
                                    void changeStatus("funding", item.id, action)
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <LedgerList
                      ledger={ledger}
                      accounts={accounts}
                      accountFilter={accountFilter}
                      onAccountFilter={setAccountFilter}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Record business expense</CardTitle>
                <CardDescription>
                  Choose the account and currency actually paid. Set the recorded USD-per-unit rate
                  for non-USD expenses; missing rates remain visibly incomplete.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Create an account before recording expenses.
                  </p>
                ) : (
                  <form
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    onSubmit={(event) => void onCreateExpense(event)}
                  >
                    <Field label="Paid from">
                      <select
                        name="accountId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currency}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Category">
                      <Input name="category" required maxLength={100} />
                    </Field>
                    <Field label="Amount">
                      <Input
                        name="amount"
                        type="number"
                        min="0.00000001"
                        step="0.00000001"
                        required
                      />
                    </Field>
                    <Field label="Currency">
                      <Input
                        name="currency"
                        defaultValue="USD"
                        minLength={3}
                        maxLength={8}
                        required
                      />
                    </Field>
                    <Field label="USD per unit (required for non-USD)">
                      <Input name="usdRate" type="number" min="0.00000001" step="0.00000001" />
                    </Field>
                    <Field label="Expense date">
                      <Input name="expenseDate" type="date" defaultValue={today()} required />
                    </Field>
                    <Field label="Notes">
                      <Input name="notes" />
                    </Field>
                    <Button
                      type="submit"
                      className="sm:col-span-2 xl:col-span-4"
                      disabled={isMutating}
                    >
                      Record pending expense
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>
                  Operation-level fees are recorded on the customer transaction. Do not re-enter
                  those same fees here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {periodExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No saved expenses in this reporting period.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {periodExpenses.map((expense) => {
                      return (
                        <div
                          key={expense.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">{expense.category}</p>
                            <p className="text-muted-foreground">
                              {expense.date} · {expense.notes ?? ""}
                            </p>
                          </div>
                          <span>{formatBusinessMoney(expense.amount, expense.currency)}</span>
                          <StatusBadge status={expense.status} />
                          <OperationActions
                            type="expense"
                            id={expense.id}
                            status={expense.status}
                            disabled={isMutating}
                            onAction={(action) => void changeStatus("expense", expense.id, action)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
                  Rapports d’activité
                </p>
                <h2 className="mt-1 text-xl font-semibold">Vue d’ensemble de l’entreprise</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Données enregistrées du {startDate} au {endDate}. Les financements ne sont pas des
                  revenus.
                </p>
              </div>
              <Button variant="outline" onClick={exportReport}>
                <ArrowDownToLine className="size-4" aria-hidden="true" /> Exporter le rapport CSV
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Revenus des opérations",
                  value: formatBusinessMoney(reportIncomeUsd, "USD"),
                  caption: `${completedPeriodTransactions.length} opération${completedPeriodTransactions.length === 1 ? "" : "s"} terminée${completedPeriodTransactions.length === 1 ? "" : "s"}`,
                  icon: TrendingUp,
                  color: "text-teal-600",
                },
                {
                  label: "Dépenses enregistrées",
                  value: formatBusinessMoney(metrics.totalBusinessExpenses, "USD"),
                  caption: metrics.expensesIncomplete
                    ? "Conversion incomplète pour certaines lignes"
                    : "Frais d’opération, dépenses et frais de financement",
                  icon: Receipt,
                  color: "text-rose-600",
                },
                {
                  label: "Montant remis aux clients",
                  value: formatBusinessMoney(metrics.totalUsdSentToCustomers, "USD"),
                  caption: "Montant USD enregistré sur les opérations",
                  icon: ArrowUpRight,
                  color: "text-blue-600",
                },
                {
                  label: "Reçus clients",
                  value: formatBusinessMoney(metrics.totalCustomerReceipts, "HTG"),
                  caption: `${periodPayments.length} paiement${periodPayments.length === 1 ? "" : "s"} client enregistré${periodPayments.length === 1 ? "" : "s"}`,
                  icon: Banknote,
                  color: "text-violet-600",
                },
              ].map((item) => (
                <Card
                  key={item.label}
                  className="border-cyan-900/10 shadow-sm dark:border-[#173451]"
                >
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-xl font-semibold">{item.value}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{item.caption}</p>
                    </div>
                    <item.icon className={`size-5 shrink-0 ${item.color}`} aria-hidden="true" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
              <Card className="border-cyan-900/20 shadow-sm dark:border-[#173451]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenus et dépenses</CardTitle>
                  <CardDescription>
                    Revenus des opérations terminées et coûts réels documentés, regroupés par mois
                    (USD).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportMonthRows.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Aucune activité sur cette période.
                    </p>
                  ) : (
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={reportMonthRows}
                          margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            fontSize={10}
                            tickFormatter={(value: number) => `$${value}`}
                          />
                          <Tooltip
                            formatter={(value) => formatBusinessMoney(Number(value), "USD")}
                            contentStyle={{ borderRadius: 10, border: "1px solid #dbe5ef" }}
                          />
                          <Bar
                            dataKey="income"
                            name="Revenus"
                            fill="#10c6bd"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="expenses"
                            name="Dépenses"
                            fill="#398df7"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {metrics.expensesIncomplete && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Certaines dépenses n’ont pas de taux USD enregistré et ne peuvent pas être
                      converties dans ce graphique.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-cyan-900/20 shadow-sm dark:border-[#173451]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Répartition des dépenses</CardTitle>
                  <CardDescription>Coûts et frais enregistrés · USD.</CardDescription>
                </CardHeader>
                <CardContent>
                  {reportExpenseGroups.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Aucune dépense confirmée sur cette période.
                    </p>
                  ) : (
                    <>
                      <div className="h-[190px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={reportExpenseGroups}
                              dataKey="amount"
                              nameKey="name"
                              innerRadius={52}
                              outerRadius={78}
                              paddingAngle={3}
                            >
                              {reportExpenseGroups.map((entry, index) => (
                                <Cell
                                  key={entry.name}
                                  fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => formatBusinessMoney(Number(value), "USD")}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="space-y-2">
                        {reportExpenseGroups.map((entry, index) => (
                          <li
                            key={entry.name}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length],
                                }}
                              />
                              <span className="truncate">{entry.name}</span>
                            </span>
                            <strong>{formatBusinessMoney(entry.amount, "USD")}</strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-cyan-900/20 shadow-sm dark:border-[#173451]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Clients les plus actifs</CardTitle>
                  <CardDescription>
                    Classés selon les montants USD remis pendant la période.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reportCustomerRows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Aucun client avec une opération terminée sur cette période.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="py-2 pr-3">Client</th>
                            <th className="py-2 pr-3">Opérations</th>
                            <th className="py-2 pr-3">Montant remis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportCustomerRows.map((customer) => (
                            <tr key={customer.id} className="border-b last:border-0">
                              <td className="py-3 pr-3 font-medium">{customer.name}</td>
                              <td className="py-3 pr-3">{customer.count}</td>
                              <td className="py-3 pr-3">
                                {formatBusinessMoney(customer.amount, "USD")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-cyan-900/20 shadow-sm dark:border-[#173451]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Opérations par type</CardTitle>
                  <CardDescription>
                    Nombre d’enregistrements créés durant la période.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
                  {reportOperationMix.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Aucune opération sur cette période.
                    </p>
                  ) : (
                    <>
                      <div className="h-[170px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={reportOperationMix}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={42}
                              outerRadius={68}
                            >
                              {reportOperationMix.map((entry, index) => (
                                <Cell
                                  key={entry.name}
                                  fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="space-y-3">
                        {reportOperationMix.map((entry, index) => (
                          <li
                            key={entry.name}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length],
                                }}
                              />
                              {entry.name}
                            </span>
                            <strong>{entry.value}</strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-cyan-900/20 shadow-sm dark:border-[#173451]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Accès rapide aux rapports</CardTitle>
                <CardDescription>
                  Consultez les enregistrements détaillés ou exportez les données de la période.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Opérations clients", tab: "transactions", icon: ArrowUpRight },
                  { label: "Paiements et prêts", tab: "payments-loans", icon: HandCoins },
                  { label: "Financements", tab: "funding", icon: Wallet },
                  { label: "Dépenses", tab: "expenses", icon: Receipt },
                ].map((report) => (
                  <Button
                    key={report.tab}
                    type="button"
                    variant="outline"
                    className="justify-start"
                    onClick={() => setActiveTab(report.tab)}
                  >
                    <report.icon className="size-4" aria-hidden="true" /> {report.label}
                    <ChevronRight className="ml-auto size-4" aria-hidden="true" />
                  </Button>
                ))}
              </CardContent>
            </Card>

            <details className="rounded-lg border border-cyan-900/20 bg-card shadow-sm dark:border-[#173451]">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                Gérer les taux de change manuels
              </summary>
              <div className="border-t p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Chaque taux correspond aux USD par unité de devise. Il sert à valoriser les
                  comptes, sans modifier les taux propres aux transactions.
                </p>
                <form
                  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                  onSubmit={(event) => void onSaveRate(event)}
                >
                  <Field label="Devise">
                    <Input name="currency" placeholder="HTG" minLength={3} maxLength={8} required />
                  </Field>
                  <Field label="USD par unité">
                    <Input
                      name="usdPerUnit"
                      type="number"
                      min="0.00000001"
                      step="0.00000001"
                      required
                    />
                  </Field>
                  <Field label="Date d’effet">
                    <Input name="effectiveDate" type="date" defaultValue={today()} required />
                  </Field>
                  <Field label="Notes">
                    <Input name="notes" />
                  </Field>
                  <Button
                    type="submit"
                    className="sm:col-span-2 xl:col-span-4"
                    disabled={isMutating}
                  >
                    Enregistrer le taux
                  </Button>
                </form>
              </div>
            </details>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function renderProfit(transaction: BusinessTransaction) {
  const result = calculateTransactionProfit(transaction);
  return (
    <span>
      {formatBusinessMoney(result.netProfit, "USD")}
      {result.incomplete && <span className="block text-xs text-amber-700">Incomplete</span>}
    </span>
  );
}

function OperationActions({
  type,
  id,
  status,
  disabled,
  onAction,
}: {
  type: string;
  id: string;
  status: string;
  disabled: boolean;
  onAction: (action: "complete" | "failed" | "cancelled" | "reverse") => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {status === "pending" && (
        <>
          <Button size="sm" disabled={disabled} onClick={() => onAction("complete")}>
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onAction("failed")}
          >
            Fail
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onAction("cancelled")}
          >
            Cancel
          </Button>
        </>
      )}
      {status === "completed" && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAction("reverse")}>
          Reverse
        </Button>
      )}
      <span className="sr-only">
        {type} {id}
      </span>
    </div>
  );
}

function LedgerList({
  ledger,
  accounts,
  accountFilter,
  onAccountFilter,
}: {
  ledger: {
    id: string;
    account_id: string;
    event_type: string;
    source_type: string;
    amount: number;
    created_at: string;
    notes: string | null;
  }[];
  accounts: { id: string; name: string; currency: string }[];
  accountFilter: string;
  onAccountFilter: (value: string) => void;
}) {
  const entries = ledger.filter(
    (entry) => accountFilter === "all" || entry.account_id === accountFilter,
  );
  return (
    <section className="space-y-2">
      <h3 className="font-medium">Account ledger</h3>
      <select
        aria-label="Filter ledger by account"
        value={accountFilter}
        onChange={(event) => onAccountFilter(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="all">All accounts</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No confirmed ledger entries.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Account</th>
                <th className="py-2 pr-3">Movement</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const account = accounts.find((item) => item.id === entry.account_id);
                return (
                  <tr key={entry.id} className="border-b">
                    <td className="py-2 pr-3">{new Date(entry.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3">{account?.name ?? "Unknown account"}</td>
                    <td className="py-2 pr-3">
                      {entry.event_type.replaceAll("_", " ")}
                      {entry.notes && (
                        <span className="block text-xs text-muted-foreground">{entry.notes}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {formatBusinessMoney(Number(entry.amount), account?.currency ?? "")}
                    </td>
                    <td className="py-2 pr-3">{entry.source_type}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
