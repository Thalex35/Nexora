import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Briefcase,
  CircleDollarSign,
  HandCoins,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calculateBusinessMetrics,
  calculateCustomerPerformance,
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
  useCreateBusinessExpense,
  useCreateBusinessFunding,
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
const EMPTY_FUNDINGS: BusinessRecords["fundings"] = [];
const EMPTY_EXPENSES: BusinessRecords["expenses"] = [];

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
  return (
    <Badge
      variant={
        status === "completed" ? "default" : status === "failed" ? "destructive" : "secondary"
      }
    >
      {status}
    </Badge>
  );
}

function BusinessPage() {
  const recordsQuery = useBusinessRecords();
  const createCustomer = useCreateBusinessCustomer();
  const createAccount = useCreateBusinessAccount();
  const createTransaction = useCreateBusinessTransaction();
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [transactionAccountFilter, setTransactionAccountFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [reportingCurrency, setReportingCurrency] = useState<BusinessCurrency>("USD");
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

  const records = recordsQuery.data;
  const accounts = records?.accounts ?? [];
  const customers = records?.customers ?? [];
  const transactions = records?.transactions ?? EMPTY_TRANSACTIONS;
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
  const metrics = calculateBusinessMetrics({
    accounts,
    transactions: periodTransactions,
    expenses: periodExpenses,
    fundings: periodFundings,
    reportingCurrency,
    exchangeRates: rates,
  });

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
      toast.success("Customer operation recorded as pending. Confirm it to post ledger movements.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't record the customer operation.",
      );
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
  const visibleCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.nickname ?? ""} ${customer.contact ?? ""}`
      .toLocaleLowerCase()
      .includes(customerSearch.trim().toLocaleLowerCase()),
  );
  const htgAccounts = accounts.filter((account) => account.currency === "HTG");
  const usdAccounts = accounts.filter((account) => account.currency === "USD");
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
    createFunding.isPending ||
    createExpense.isPending ||
    createAdjustment.isPending ||
    completeOperation.isPending ||
    closeOperation.isPending ||
    reverseOperation.isPending ||
    saveRate.isPending;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Business"
          description="Manual records for customer payments, verified wallet movements, costs, and profit."
          actions={
            <Button size="sm" variant="outline" onClick={exportReport}>
              <ArrowDownToLine /> Export CSV
            </Button>
          }
        />

        <section className="nexora-panel flex flex-wrap items-end gap-3 p-4">
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

        {isMutating && (
          <p className="text-sm text-muted-foreground" role="status">
            Saving business record…
          </p>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="funding">Funding & accounts</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Meru Wallet Balance (USD)",
                  value: hasMeruAccount
                    ? formatBusinessMoney(metrics.meruWalletBalance, "USD")
                    : "Not set up",
                  icon: Wallet,
                },
                {
                  label: `Total Business Funds (${reportingCurrency})`,
                  value:
                    metrics.totalBusinessFunds === null
                      ? "Unavailable"
                      : formatBusinessMoney(metrics.totalBusinessFunds, reportingCurrency),
                  icon: Briefcase,
                },
                {
                  label: "Cash on Hand (HTG)",
                  value: formatBusinessMoney(metrics.cashOnHand, "HTG"),
                  icon: PiggyBank,
                },
                {
                  label: "Customer Receipts (HTG)",
                  value: formatBusinessMoney(metrics.totalCustomerReceipts, "HTG"),
                  icon: CircleDollarSign,
                },
                {
                  label: "USD Sent to Customers",
                  value: formatBusinessMoney(metrics.totalUsdSentToCustomers, "USD"),
                  icon: ArrowUpRight,
                },
                {
                  label: "Business Expenses (USD est.)",
                  value: formatBusinessMoney(metrics.totalBusinessExpenses, "USD"),
                  icon: HandCoins,
                },
                {
                  label: "Net Profit (USD est.)",
                  value: formatBusinessMoney(metrics.netProfit, "USD"),
                  icon: TrendingUp,
                },
                {
                  label: "Pending Transactions",
                  value: String(metrics.pendingTransactions),
                  icon: Landmark,
                },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {label}
                      </CardTitle>
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tracking-tight">{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {(metrics.valuationIncomplete ||
              metrics.expensesIncomplete ||
              metrics.profitIncomplete) && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                One or more totals are incomplete estimates because a required operation cost or
                recorded exchange rate is missing.
              </p>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Business accounts</CardTitle>
                <CardDescription>
                  Balances come from immutable ledger entries plus each account’s opening balance.
                  Pending operations do not affect available balances. Internal transfers move value
                  between accounts and are not revenue.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No accounts yet. Create the accounts you actually use in Funding & accounts.
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
                    Corrections are append-only, require a reason, and cannot reduce an account
                    below zero.
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
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Record customer operation</CardTitle>
                <CardDescription>
                  HTG received and USD sent are separate. The operation starts pending and must be
                  explicitly confirmed before ledger balances change.
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
                    <Field label="HTG received">
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
                          <th className="py-2 pr-4">HTG received</th>
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

          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add customer</CardTitle>
                <CardDescription>
                  Only store information needed to identify and manage customers; never store their
                  account credentials.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                  onSubmit={(event) => void onCreateCustomer(event)}
                >
                  <Field label="Full/display name">
                    <Input name="name" required maxLength={160} />
                  </Field>
                  <Field label="Nickname or reference">
                    <Input name="nickname" maxLength={100} />
                  </Field>
                  <Field label="Optional contact">
                    <Input name="contact" maxLength={200} />
                  </Field>
                  <Field label="Notes">
                    <Input name="notes" maxLength={1000} />
                  </Field>
                  <Button
                    type="submit"
                    className="sm:col-span-2 xl:col-span-4"
                    disabled={isMutating}
                  >
                    Save customer
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Field label="Search customers">
              <Input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Name, nickname, or contact"
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {customers.length === 0 ? (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No customers saved yet.
                  </CardContent>
                </Card>
              ) : visibleCustomers.length === 0 ? (
                <Card className="md:col-span-2 xl:col-span-3">
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No customers match this search.
                  </CardContent>
                </Card>
              ) : (
                visibleCustomers.map((customer) => {
                  const summary = calculateCustomerPerformance(customer.id, periodTransactions);
                  const history = periodTransactions.filter(
                    (transaction) => transaction.customerId === customer.id,
                  );
                  return (
                    <Card key={customer.id}>
                      <CardHeader>
                        <CardTitle>{customer.name}</CardTitle>
                        <CardDescription>
                          {customer.nickname || "No internal reference"} · added{" "}
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {customer.contact && (
                          <p className="text-muted-foreground">{customer.contact}</p>
                        )}
                        {customer.notes && <p>{customer.notes}</p>}
                        <details className="pt-1">
                          <summary className="cursor-pointer">Edit customer</summary>
                          <form
                            className="mt-2 space-y-2"
                            onSubmit={(event) => void onUpdateCustomer(event, customer.id)}
                          >
                            <Input
                              aria-label="Display name"
                              name="name"
                              defaultValue={customer.name}
                              required
                            />
                            <Input
                              aria-label="Nickname"
                              name="nickname"
                              defaultValue={customer.nickname ?? ""}
                            />
                            <Input
                              aria-label="Contact"
                              name="contact"
                              defaultValue={customer.contact ?? ""}
                            />
                            <Input
                              aria-label="Notes"
                              name="notes"
                              defaultValue={customer.notes ?? ""}
                            />
                            <Button type="submit" size="sm" disabled={isMutating}>
                              Save details
                            </Button>
                          </form>
                        </details>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completed HTG receipts</span>
                          <span>{formatBusinessMoney(summary.totalHtgReceived, "HTG")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completed USD sent</span>
                          <span>{formatBusinessMoney(summary.totalUsdSent, "USD")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Estimated profit</span>
                          <span>{formatBusinessMoney(summary.estimatedProfit, "USD")}</span>
                        </div>
                        <details className="pt-2">
                          <summary className="cursor-pointer">
                            Transaction history ({history.length})
                          </summary>
                          <ul className="mt-2 space-y-2">
                            {history.map((item) => (
                              <li
                                key={item.id}
                                className="flex items-center justify-between gap-2 border-t pt-2"
                              >
                                <span>
                                  {item.transactionDate.slice(0, 10)} ·{" "}
                                  {formatBusinessMoney(item.htgReceived, "HTG")}
                                </span>
                                <StatusBadge status={item.status} />
                              </li>
                            ))}
                          </ul>
                        </details>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="funding" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create account</CardTitle>
                <CardDescription>
                  Opening balances are entered once and become immutable. Create HTG, USD, or
                  crypto-quantity accounts as needed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                  onSubmit={(event) => void onCreateAccount(event)}
                >
                  <Field label="Account name">
                    <Input name="name" required maxLength={100} />
                  </Field>
                  <Field label="Account type">
                    <select
                      name="type"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="meru">Meru wallet</option>
                      <option value="cash">Cash</option>
                      <option value="crypto">Cryptocurrency</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field
                    label="Currency / asset code"
                    hint="Use an explicit code such as USD, HTG, EUR, BTC."
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
                  <Field label="Opening balance">
                    <Input
                      name="openingBalance"
                      type="number"
                      min="0"
                      step="0.00000001"
                      defaultValue="0"
                      required
                    />
                  </Field>
                  <Button
                    type="submit"
                    className="sm:col-span-2 xl:col-span-4"
                    disabled={isMutating}
                  >
                    Create account
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Record funding or asset movement</CardTitle>
                <CardDescription>
                  Only the actual amount credited changes the destination balance. External top-ups
                  do not count as revenue. Account-to-account transfers move value rather than
                  create revenue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Create accounts before recording funding.
                  </p>
                ) : (
                  <form
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    onSubmit={(event) => void onCreateFunding(event)}
                  >
                    <Field label="Operation type">
                      <select
                        name="fundingType"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="replenishment">External Meru replenishment</option>
                        <option value="crypto_purchase">Crypto purchase</option>
                        <option value="crypto_transfer">Crypto-funded wallet credit</option>
                        <option value="asset_transfer">Internal asset transfer</option>
                      </select>
                    </Field>
                    <Field label="Source account" hint="Leave blank only for external funds.">
                      <select
                        name="sourceAccountId"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">External / not tracked</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} · {account.currency}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Destination account">
                      <select
                        name="destinationAccountId"
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
                    <Field label="Amount used from source">
                      <Input name="sourceAmount" type="number" min="0" step="0.00000001" />
                    </Field>
                    <Field label="Actual amount credited">
                      <Input
                        name="creditedAmount"
                        type="number"
                        min="0.00000001"
                        step="0.00000001"
                        required
                      />
                    </Field>
                    <Field label="Fee in source currency">
                      <Input
                        name="feeAmount"
                        type="number"
                        min="0"
                        step="0.00000001"
                        defaultValue="0"
                        required
                      />
                    </Field>
                    <Field label="Fee (USD, for expense reporting)">
                      <Input name="feeUsd" type="number" min="0" step="0.01" />
                    </Field>
                    <Field label="Crypto quantity, if applicable">
                      <Input
                        name="cryptoQuantity"
                        type="number"
                        min="0.00000001"
                        step="0.00000001"
                      />
                    </Field>
                    <Field label="Crypto unit price (USD)">
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
                    <Field label="Reference">
                      <Input name="reference" />
                    </Field>
                    <Field label="Notes">
                      <Input name="notes" />
                    </Field>
                    <Button
                      type="submit"
                      className="sm:col-span-2 xl:col-span-4"
                      disabled={isMutating}
                    >
                      Record pending funding
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Funding history and ledger</CardTitle>
                <CardDescription>
                  Balances are computed by PostgreSQL from opening balances and append-only
                  confirmed entries.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fundings.length === 0 && ledger.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No funding or ledger entries yet.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 pr-3">Funding</th>
                            <th className="py-2 pr-3">Date</th>
                            <th className="py-2 pr-3">Credited</th>
                            <th className="py-2 pr-3">Status</th>
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
            <Card>
              <CardHeader>
                <CardTitle>Manual exchange rates</CardTitle>
                <CardDescription>
                  Each value is USD per one unit of the named currency. Rates are used for account
                  valuation, not to rewrite transaction-specific rates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                  onSubmit={(event) => void onSaveRate(event)}
                >
                  <Field label="Currency">
                    <Input name="currency" placeholder="HTG" minLength={3} maxLength={8} required />
                  </Field>
                  <Field label="USD per unit">
                    <Input
                      name="usdPerUnit"
                      type="number"
                      min="0.00000001"
                      step="0.00000001"
                      required
                    />
                  </Field>
                  <Field label="Effective date">
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
                    Save rate
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activity report</CardTitle>
                <CardDescription>
                  Generated from saved records for {startDate} through {endDate}. CSV includes
                  customer operations, funding, and expenses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <p>
                    Completed customer operations:{" "}
                    <strong>
                      {periodTransactions.filter((item) => item.status === "completed").length}
                    </strong>
                  </p>
                  <p>
                    Receipts:{" "}
                    <strong>{formatBusinessMoney(metrics.totalCustomerReceipts, "HTG")}</strong>
                  </p>
                  <p>
                    USD delivered:{" "}
                    <strong>{formatBusinessMoney(metrics.totalUsdSentToCustomers, "USD")}</strong>
                  </p>
                  <p>
                    Funding operations: <strong>{periodFundings.length}</strong>
                  </p>
                  <p>
                    Recorded ledger entries:{" "}
                    <strong>
                      {
                        ledger.filter(
                          (item) =>
                            item.created_at.slice(0, 10) >= startDate &&
                            item.created_at.slice(0, 10) <= endDate,
                        ).length
                      }
                    </strong>
                  </p>
                  <p>
                    Net profit estimate:{" "}
                    <strong>{formatBusinessMoney(metrics.netProfit, "USD")}</strong>
                  </p>
                  <p>
                    Data status:{" "}
                    <strong>
                      {metrics.profitIncomplete
                        ? "Incomplete estimate"
                        : "Based on recorded inputs"}
                    </strong>
                  </p>
                </div>
                <Button variant="outline" onClick={exportReport}>
                  <ArrowDownToLine /> Download selected period CSV
                </Button>
              </CardContent>
            </Card>
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
