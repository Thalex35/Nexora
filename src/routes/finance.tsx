import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { toast } from "sonner";

import { TransactionDialog } from "@/components/transaction-dialog";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allocationAmount, financeTotals, formatFinanceDate, formatMoney } from "@/lib/finance";
import {
  useDeleteTransaction,
  useIncomeAllocations,
  useTransactions,
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
  const transactions = useTransactions();
  const allocations = useIncomeAllocations();
  const deleteTransaction = useDeleteTransaction();
  const [dialogType, setDialogType] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const rows = transactions.data ?? [];
  const allocationRows = allocations.data ?? [];
  const totals = financeTotals(rows, allocationRows);
  const incomes = rows.filter((row) => row.type === "income");
  const upcoming = allocationRows.filter((allocation) => !allocation.completed).slice(0, 5);
  const completedAllocations = [...allocationRows]
    .filter((allocation) => allocation.completed)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, 5);

  const transactionItems = rows
    .filter((row) => filter === "all" || filter === row.type)
    .map((transaction) => ({
      kind: "transaction" as const,
      date: transaction.transaction_date,
      transaction,
    }));
  const allocationItems =
    filter === "all" || filter === "allocations"
      ? allocationRows.map((allocation) => ({
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

  const loading = transactions.isLoading || allocations.isLoading;
  const failed = transactions.isError || allocations.isError;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Finance"
          description="Receive → allocate → execute → track. Allocations are plans, not expenses."
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
            onRetry={() => void Promise.all([transactions.refetch(), allocations.refetch()])}
          />
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryValue label="Total income" value={totals.totalIncome} />
              <SummaryValue label="Total expenses" value={totals.totalExpenses} />
              <SummaryValue label="Available balance" value={totals.availableBalance} accent />
              <SummaryValue label="Total allocated" value={totals.totalAllocated} />
              <SummaryValue label="Unallocated income" value={totals.unallocatedIncome} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">Income</h2>
                    <p className="text-sm text-muted-foreground">Open an income to plan its use.</p>
                  </div>
                  <Badge variant="outline">{incomes.length}</Badge>
                </div>
                {incomes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No income recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {incomes.slice(0, 5).map((income) => (
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

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">Finance history</h2>
                  <p className="text-sm text-muted-foreground">
                    Income, actual expenses, and planned allocations.
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
                  description="Add income or an expense to start your finance history."
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
        onClose={closeTransactionDialog}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title={pendingDelete?.type === "income" ? "Delete this income?" : "Delete this expense?"}
        description={
          pendingDelete?.type === "income"
            ? "This permanently deletes the income and its allocations. Expenses are not affected."
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
