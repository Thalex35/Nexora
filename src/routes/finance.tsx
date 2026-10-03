import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  DebtDialog,
  FutureExpenseDialog,
  FutureExpensePaymentDialog,
} from "@/components/finance-expansion-dialogs";
import { TransactionDialog } from "@/components/transaction-dialog";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  allocationAmount,
  currentFinanceMonth,
  financeTotals,
  formatFinanceDate,
  formatMoney,
  monthlyFinanceTotals,
  shiftFinanceMonth,
  toggleDebtStatus,
} from "@/lib/finance";
import {
  todayISO,
  useDebts,
  useDeleteTransaction,
  useFutureExpenses,
  useIncomeAllocations,
  useTransactions,
  useUpdateDebt,
  useUpdateFutureExpense,
  usePayFutureExpense,
  type Debt,
  type FutureExpense,
  type Transaction,
  type TransactionType,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Nexora" },
      {
        name: "description",
        content: "Track income, planned allocations and actual expenses.",
      },
      { property: "og:title", content: "Finance — Nexora" },
      {
        property: "og:description",
        content: "Receive, allocate, execute and track your money.",
      },
    ],
  }),
  component: FinancePage,
});

type HistoryFilter = "all" | "income" | "expense" | "allocations";

function FinancePage() {
  const isIncomeDetail = useRouterState({
    select: (router) =>
      router.matches.some((match) => match.routeId === "/finance/income/$incomeId"),
  });
  const transactions = useTransactions();
  const allocations = useIncomeAllocations();
  const deleteTransaction = useDeleteTransaction();
  const futureExpenses = useFutureExpenses();
  const debts = useDebts();
  const updateFutureExpense = useUpdateFutureExpense();
  const payFutureExpense = usePayFutureExpense();
  const updateDebt = useUpdateDebt();
  const [dialogType, setDialogType] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [month, setMonth] = useState(currentFinanceMonth);
  const [futureDialogOpen, setFutureDialogOpen] = useState(false);
  const [editingFutureExpense, setEditingFutureExpense] = useState<FutureExpense | null>(null);
  const [payingFutureExpense, setPayingFutureExpense] = useState<FutureExpense | null>(null);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const monthDefaultDate =
    month === currentFinanceMonth() ? todayISO() : `${month}-01`;

  const rows = transactions.data ?? [];
  const allocationRows = allocations.data ?? [];
  const totals = financeTotals(rows, allocationRows);
  const futureRows = futureExpenses.data ?? [];
  const debtRows = debts.data ?? [];
  const monthTotals = monthlyFinanceTotals(rows, allocationRows, futureRows, debtRows, month);
  const incomes = monthTotals.incomes;
  const monthIncomeIds = new Set(incomes.map((income) => income.id));
  const monthAllocations = allocationRows.filter((item) => monthIncomeIds.has(item.income_id));
  const upcoming = monthAllocations.filter((allocation) => !allocation.completed).slice(0, 5);
  const completedAllocations = [...monthAllocations]
    .filter((allocation) => allocation.completed)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, 5);

  const transactionItems = [...monthTotals.incomes, ...monthTotals.expenses]
    .filter((row) => filter === "all" || filter === row.type)
    .map((transaction) => ({
      kind: "transaction" as const,
      date: transaction.transaction_date,
      transaction,
    }));
  const allocationItems =
    filter === "all" || filter === "allocations"
      ? monthAllocations.map((allocation) => ({
          kind: "allocation" as const,
          date: allocation.planned_date ?? allocation.updated_at.slice(0, 10),
          allocation,
        }))
      : [];
  const history = [...transactionItems, ...allocationItems].sort((left, right) =>
    right.date.localeCompare(left.date),
  );

  function closeTransactionDialog() {
    setDialogType(null);
    setEditingTransaction(null);
  }

  function editTransaction(transaction: Transaction) {
    setEditingTransaction(transaction);
    setDialogType(transaction.type);
  }

  const loading =
    transactions.isLoading ||
    allocations.isLoading ||
    futureExpenses.isLoading ||
    debts.isLoading;
  const failed =
    transactions.isError || allocations.isError || futureExpenses.isError || debts.isError;

  if (isIncomeDetail) return <Outlet />;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Finance"
          description="Track money received, planned, spent, and owed — month by month."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setDialogType("income")}>
                Add income
              </Button>
              <Button size="sm" onClick={() => setDialogType("expense")}>
                Add expense
              </Button>
            </div>
          }
        />

        {loading ? (
          <LoadingState rows={3} />
        ) : failed ? (
          <ErrorState
            onRetry={() =>
              void Promise.all([
                transactions.refetch(),
                allocations.refetch(),
                futureExpenses.refetch(),
                debts.refetch(),
              ])
            }
          />
        ) : (
          <>
            <section className="nexora-panel flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous month"
                  onClick={() => setMonth((value) => shiftFinanceMonth(value, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <label className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <span className="sr-only">Finance month</span>
                  <Input
                    type="month"
                    value={month}
                    onChange={(event) => event.target.value && setMonth(event.target.value)}
                    className="w-40"
                    aria-label="Finance month"
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next month"
                  onClick={() => setMonth((value) => shiftFinanceMonth(value, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setMonth(currentFinanceMonth())}>
                This month
              </Button>
            </section>

            <section
              aria-label="Monthly finance summary"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              <SummaryValue label="Total income" value={monthTotals.totalIncome} />
              <SummaryValue label="Actual expenses" value={monthTotals.totalExpenses} />
              <SummaryValue
                label="Allocated to these incomes"
                value={monthTotals.totalAllocated}
              />
              <SummaryValue
                label="Future expenses planned"
                value={monthTotals.futureExpenses}
              />
              <SummaryValue label="Outstanding debts" value={monthTotals.outstandingDebts} />
              <SummaryValue
                label="Remaining after spending & allocations"
                value={monthTotals.remainingBalance}
                accent
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Income</h2>
                    <p className="text-sm text-muted-foreground">
                      Each income has its own allocations and linked expenses.
                    </p>
                  </div>
                  <Badge variant="outline">{incomes.length}</Badge>
                </div>
                {incomes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No income recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {incomes.map((income) => (
                      <li
                        key={income.id}
                        className="flex min-w-0 items-center gap-3 py-3 first:pt-0"
                      >
                        <ArrowDownLeft className="h-4 w-4 shrink-0 text-success" />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/finance/income/$incomeId"
                            params={{ incomeId: income.id }}
                            className="block truncate text-sm font-medium text-foreground hover:text-primary"
                          >
                            {income.category || "Income"}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatFinanceDate(income.transaction_date)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-success">
                          +{formatMoney(Number(income.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Upcoming allocations</h2>
                    <p className="text-sm text-muted-foreground">
                      Planned amounts stay separate from spending.
                    </p>
                  </div>
                  <Badge variant="outline">{upcoming.length}</Badge>
                </div>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming allocations.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcoming.map((allocation) => {
                      const parent = incomes.find((income) => income.id === allocation.income_id);
                      const amount = allocationAmount(
                        allocation,
                        totals.incomeById.get(allocation.income_id) ?? 0,
                      );
                      return (
                        <li key={allocation.id} className="flex min-w-0 items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/finance/income/$incomeId"
                              params={{ incomeId: allocation.income_id }}
                              className="block truncate text-sm text-foreground hover:text-primary"
                            >
                              {allocation.title}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatFinanceDate(allocation.planned_date)}
                              {parent ? ` · ${parent.category || "Income"}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm text-foreground">
                            {formatMoney(amount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Completed allocations</h2>
                    <p className="text-sm text-muted-foreground">
                      Completed plans remain in your history.
                    </p>
                  </div>
                  <Badge variant="secondary">{completedAllocations.length}</Badge>
                </div>
                {completedAllocations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No completed allocations yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {completedAllocations.map((allocation) => (
                      <li key={allocation.id} className="flex min-w-0 items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/finance/income/$incomeId"
                            params={{ incomeId: allocation.income_id }}
                            className="block truncate text-sm text-muted-foreground line-through hover:text-primary"
                          >
                            {allocation.title}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatFinanceDate(allocation.planned_date)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {formatMoney(
                            allocationAmount(
                              allocation,
                              totals.incomeById.get(allocation.income_id) ?? 0,
                            ),
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <FutureExpensesPanel
                expenses={monthTotals.monthFutureExpenses}
                onAdd={() => {
                  setEditingFutureExpense(null);
                  setFutureDialogOpen(true);
                }}
                onEdit={(expense) => {
                  setEditingFutureExpense(expense);
                  setFutureDialogOpen(true);
                }}
                onPay={setPayingFutureExpense}
                onStatusChange={(expense, status) =>
                  updateFutureExpense.mutate(
                    { id: expense.id, status },
                    {
                      onSuccess: () =>
                        toast.success(status === "planned" ? "Expense reopened" : "Expense cancelled"),
                      onError: () => toast.error("Couldn't update this planned expense"),
                    },
                  )
                }
                updating={updateFutureExpense.isPending}
              />
              <DebtsPanel
                debts={monthTotals.monthDebts}
                onAdd={() => {
                  setEditingDebt(null);
                  setDebtDialogOpen(true);
                }}
                onEdit={(debt) => {
                  setEditingDebt(debt);
                  setDebtDialogOpen(true);
                }}
                onToggleStatus={(debt) => {
                  const markingPaid = debt.status === "unpaid";
                  updateDebt.mutate(
                    {
                      id: debt.id,
                      ...toggleDebtStatus(debt.status, todayISO()),
                    },
                    {
                      onSuccess: () =>
                        toast.success(markingPaid ? "Debt marked paid" : "Debt marked unpaid"),
                      onError: () => toast.error("Couldn't update this debt"),
                    },
                  );
                }}
                updating={updateDebt.isPending}
              />
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">Finance history</h2>
                  <p className="text-sm text-muted-foreground">
                    Income, actual expenses, and allocations for{" "}
                    {new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Tabs value={filter} onValueChange={(value) => setFilter(value as HistoryFilter)}>
                  <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="income">Income</TabsTrigger>
                    <TabsTrigger value="expense">Expenses</TabsTrigger>
                    <TabsTrigger value="allocations">Allocations</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {history.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="h-5 w-5" />}
                  title="No finance activity yet"
                  description="No income, expenses, or allocations are recorded for this month."
                  actionLabel="Add income"
                  onAction={() => setDialogType("income")}
                />
              ) : (
                <ul className="nexora-panel divide-y divide-border px-4">
                  {history.map((item) =>
                    item.kind === "transaction" ? (
                      <TransactionHistoryRow
                        key={`transaction-${item.transaction.id}`}
                        transaction={item.transaction}
                        onEdit={() => editTransaction(item.transaction)}
                        onDelete={() => setPendingDelete(item.transaction)}
                      />
                    ) : (
                      <AllocationHistoryRow
                        key={`allocation-${item.allocation.id}`}
                        allocation={item.allocation}
                        amount={allocationAmount(
                          item.allocation,
                          totals.incomeById.get(item.allocation.income_id) ?? 0,
                        )}
                      />
                    ),
                  )}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <TransactionDialog
        type={dialogType}
        transaction={editingTransaction}
        incomes={incomes}
        defaultDate={monthDefaultDate}
        onClose={closeTransactionDialog}
      />
      <FutureExpenseDialog
        open={futureDialogOpen}
        expense={editingFutureExpense}
        defaultDate={monthDefaultDate}
        onClose={() => {
          setFutureDialogOpen(false);
          setEditingFutureExpense(null);
        }}
      />
      <FutureExpensePaymentDialog
        open={payingFutureExpense !== null}
        expense={payingFutureExpense}
        pending={payFutureExpense.isPending}
        onClose={() => setPayingFutureExpense(null)}
        onPay={(paidDate) => {
          if (!payingFutureExpense) return;
          payFutureExpense.mutate(
            { id: payingFutureExpense.id, paidDate },
            {
              onSuccess: () => {
                toast.success("Payment recorded as an actual expense");
                setPayingFutureExpense(null);
              },
              onError: (error) =>
                toast.error(error.message || "Couldn't record this payment"),
            },
          );
        }}
      />
      <DebtDialog
        open={debtDialogOpen}
        debt={editingDebt}
        defaultDate={monthDefaultDate}
        onClose={() => {
          setDebtDialogOpen(false);
          setEditingDebt(null);
        }}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title={pendingDelete?.type === "income" ? "Delete this income?" : "Delete this expense?"}
        description={
          pendingDelete?.type === "income"
            ? "This permanently deletes the income and its allocations. Linked expenses are kept and become unlinked."
            : "This permanently deletes this recorded expense."
        }
        confirmLabel={pendingDelete?.type === "income" ? "Delete income" : "Delete expense"}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteTransaction.mutate(pendingDelete.id, {
            onSuccess: () =>
              toast.success(pendingDelete.type === "income" ? "Income deleted" : "Expense deleted"),
            onError: () => toast.error("Couldn't delete that transaction"),
          });
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}

function FutureExpensesPanel({
  expenses,
  onAdd,
  onEdit,
  onPay,
  onStatusChange,
  updating,
}: {
  expenses: FutureExpense[];
  onAdd: () => void;
  onEdit: (expense: FutureExpense) => void;
  onPay: (expense: FutureExpense) => void;
  onStatusChange: (expense: FutureExpense, status: "planned" | "cancelled") => void;
  updating: boolean;
}) {
  return (
    <section className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <CalendarClock className="h-4 w-4 text-primary" />
            Future expenses
          </h2>
          <p className="text-sm text-muted-foreground">
            Plans do not reduce your actual balance.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd}>
          Plan expense
        </Button>
      </div>
      {expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No future expenses for this month.</p>
      ) : (
        <ul className="divide-y divide-border">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{expense.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Planned {formatFinanceDate(expense.planned_date)}
                  {expense.paid_date ? ` · Paid ${formatFinanceDate(expense.paid_date)}` : ""}
                  {expense.description ? ` · ${expense.description}` : ""}
                </p>
                {expense.status === "paid" && expense.resulting_expense_id && (
                  <p className="text-xs text-primary">Linked actual expense recorded</p>
                )}
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {formatMoney(Number(expense.amount))}
              </span>
              <Badge
                variant={
                  expense.status === "paid"
                    ? "secondary"
                    : expense.status === "cancelled"
                      ? "outline"
                      : "default"
                }
                className="capitalize"
              >
                {expense.status}
              </Badge>
              <div className="flex shrink-0 items-center">
                {expense.status !== "paid" && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(expense)}
                      aria-label={`Edit ${expense.title}`}
                    >
                      Edit
                    </Button>
                    {expense.status === "planned" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating}
                          onClick={() => onPay(expense)}
                        >
                          Record payment
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updating}
                          onClick={() => onStatusChange(expense, "cancelled")}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updating}
                        onClick={() => onStatusChange(expense, "planned")}
                      >
                        Reopen
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DebtsPanel({
  debts,
  onAdd,
  onEdit,
  onToggleStatus,
  updating,
}: {
  debts: Debt[];
  onAdd: () => void;
  onEdit: (debt: Debt) => void;
  onToggleStatus: (debt: Debt) => void;
  updating: boolean;
}) {
  const outstanding = debts
    .filter((debt) => debt.status === "unpaid")
    .reduce((sum, debt) => sum + Number(debt.amount), 0);

  return (
    <section className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <HandCoins className="h-4 w-4 text-primary" />
            Debts
          </h2>
          <p className="text-sm text-muted-foreground">
            Owed amounts are tracked separately and are not expenses.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd}>
          Record debt
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
        <span className="text-muted-foreground">Outstanding this month</span>
        <span className="font-semibold text-foreground">{formatMoney(outstanding)}</span>
      </div>
      {debts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No debts recorded for this month.</p>
      ) : (
        <ul className="divide-y divide-border">
          {debts.map((debt) => (
            <li key={debt.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{debt.creditor}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatFinanceDate(debt.debt_date)}
                  {debt.due_date ? ` · Due ${formatFinanceDate(debt.due_date)}` : ""}
                  {debt.paid_date ? ` · Paid ${formatFinanceDate(debt.paid_date)}` : ""}
                  {debt.description ? ` · ${debt.description}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {formatMoney(Number(debt.amount))}
              </span>
              <Badge variant={debt.status === "paid" ? "secondary" : "outline"}>
                {debt.status === "paid" ? "Paid" : "Unpaid"}
              </Badge>
              <div className="flex shrink-0 items-center">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(debt)}
                  aria-label={`Edit debt from ${debt.creditor}`}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updating}
                  onClick={() => onToggleStatus(debt)}
                >
                  Mark {debt.status === "unpaid" ? "paid" : "unpaid"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryValue({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="nexora-panel min-w-0 p-4">
      <p className="nexora-label">{label}</p>
      <p
        className={`mt-2 truncate text-lg font-semibold ${accent ? "text-primary" : "text-foreground"}`}
      >
        {formatMoney(value)}
      </p>
    </div>
  );
}

function TransactionHistoryRow({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const income = transaction.type === "income";
  const title = income ? transaction.category || "Income" : transaction.category || "Expense";
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        {income ? (
          <ArrowDownLeft className="h-4 w-4 text-success" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatFinanceDate(transaction.transaction_date)}
          {transaction.description ? ` · ${transaction.description}` : ""}
        </span>
      </span>
      <span
        className={`shrink-0 text-sm font-semibold ${income ? "text-success" : "text-foreground"}`}
      >
        {income ? "+" : "−"}
        {formatMoney(Number(transaction.amount))}
      </span>
    </>
  );

  return (
    <li className="flex min-w-0 items-center gap-3 py-3">
      {income ? (
        <Link
          to="/finance/income/$incomeId"
          params={{ incomeId: transaction.id }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
      )}
      <Button variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
        Delete
      </Button>
    </li>
  );
}

function AllocationHistoryRow({
  allocation,
  amount,
}: {
  allocation: NonNullable<ReturnType<typeof useIncomeAllocations>["data"]>[number];
  amount: number;
}) {
  return (
    <li className="flex min-w-0 items-center gap-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
        %
      </span>
      <Link
        to="/finance/income/$incomeId"
        params={{ incomeId: allocation.income_id }}
        className="min-w-0 flex-1"
      >
        <span
          className={`block truncate text-sm font-medium ${allocation.completed ? "text-muted-foreground line-through" : "text-foreground"}`}
        >
          {allocation.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {allocation.allocation_type === "percentage"
            ? `${allocation.value}% · ${formatMoney(amount)}`
            : formatMoney(amount)}
          {` · ${formatFinanceDate(allocation.planned_date)}`}
        </span>
      </Link>
      <Badge variant={allocation.completed ? "secondary" : "outline"}>
        {allocation.completed ? "Completed" : "Planned"}
      </Badge>
    </li>
  );
}
