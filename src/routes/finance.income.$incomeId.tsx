import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IncomeAllocationDialog } from "@/components/income-allocation-dialog";
import { TransactionDialog } from "@/components/transaction-dialog";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { allocationAmount, formatFinanceDate, formatMoney } from "@/lib/finance";
import {
  useIncome,
  useDeleteIncomeAllocation,
  useDeleteTransaction,
  useIncomeAllocations,
  useIncomeExpenses,
  useTransactions,
  useUpdateIncomeAllocation,
  type IncomeAllocation,
  type Transaction,
  type TransactionType,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/finance/income/$incomeId")({
  head: () => ({
    meta: [
      { title: "Income details — Nexora" },
      { name: "description", content: "Plan and track how an income will be used." },
    ],
  }),
  component: IncomeDetailPage,
});

function IncomeDetailPage() {
  const { incomeId } = Route.useParams();
  const transactions = useTransactions();
  const incomeQuery = useIncome(incomeId);
  const allocations = useIncomeAllocations(incomeId);
  const expenses = useIncomeExpenses(incomeId);
  const updateAllocation = useUpdateIncomeAllocation();
  const deleteAllocation = useDeleteIncomeAllocation();
  const deleteTransaction = useDeleteTransaction();
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<IncomeAllocation | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [pendingExpenseDelete, setPendingExpenseDelete] = useState<Transaction | null>(null);
  const [pendingAllocationDelete, setPendingAllocationDelete] = useState<IncomeAllocation | null>(
    null,
  );
  const [confirmIncomeDelete, setConfirmIncomeDelete] = useState(false);

  const income = incomeQuery.data;
  const incomeAllocations = allocations.data ?? [];
  const incomeExpenses = expenses.data ?? [];
  const incomes = (transactions.data ?? []).filter((transaction) => transaction.type === "income");

  function openNewAllocation() {
    setEditingAllocation(null);
    setAllocationDialogOpen(true);
  }

  const loading = incomeQuery.isLoading || allocations.isLoading || expenses.isLoading;
  const failed = incomeQuery.isError || allocations.isError || expenses.isError;

  if (loading) {
    return (
      <AppShell>
        <LoadingState rows={4} />
      </AppShell>
    );
  }

  if (failed) {
    return (
      <AppShell>
        <ErrorState
          onRetry={() =>
            void Promise.all([
              transactions.refetch(),
              incomeQuery.refetch(),
              allocations.refetch(),
              expenses.refetch(),
            ])
          }
        />
      </AppShell>
    );
  }

  if (!income || income.type !== "income") {
    return (
      <AppShell>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">This income could not be found.</p>
          <Button variant="outline" asChild>
            <Link to="/finance">Back to Finance</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const allocated = incomeAllocations.reduce(
    (sum, allocation) => sum + allocationAmount(allocation, Number(income.amount)),
    0,
  );
  const spent = incomeExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const remaining = Number(income.amount) - allocated - spent;
  const completed = incomeAllocations.filter((allocation) => allocation.completed);
  const incomeOptions = incomes.some((item) => item.id === income.id)
    ? incomes
    : [income, ...incomes];

  function openTransaction(type: TransactionType, transaction: Transaction | null = null) {
    setTransactionType(type);
    setEditingTransaction(transaction);
  }

  function closeTransactionDialog() {
    setTransactionType(null);
    setEditingTransaction(null);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={income.category || "Income"}
          description="Income details, planned allocations, and linked expenses."
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/finance">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Finance
              </Link>
            </Button>
          }
        />

        <section className="nexora-panel space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Source</p>
                <p className="mt-1 font-medium text-foreground">{income.category || "Income"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Income received</p>
                <p className="mt-1 text-2xl font-semibold text-success">
                  {formatMoney(Number(income.amount))}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatFinanceDate(income.transaction_date)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openTransaction("income", income)}>
                Edit income
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete income"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmIncomeDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="mt-1 break-words text-sm text-foreground">
              {income.description || "No description"}
            </p>
          </div>
          <div className="grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Income</p>
              <p className="mt-1 font-medium text-foreground">
                {formatMoney(Number(income.amount))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Allocated</p>
              <p className="mt-1 font-medium text-foreground">{formatMoney(allocated)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Linked expenses</p>
              <p className="mt-1 font-medium text-foreground">{formatMoney(spent)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className="mt-1 font-medium text-foreground">{formatMoney(remaining)}</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Allocations</h2>
              <p className="text-sm text-muted-foreground">
                Planning an allocation does not record an expense.
              </p>
            </div>
            <Button size="sm" onClick={openNewAllocation}>
              <Plus className="mr-1 h-4 w-4" />
              Add allocation
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {completed.length} of {incomeAllocations.length} allocations completed.
          </p>
          {incomeAllocations.length === 0 ? (
            <div className="nexora-panel p-5">
              <p className="text-sm text-muted-foreground">
                No allocations yet. Add a plan for how to use this income.
              </p>
            </div>
          ) : (
            <ul className="nexora-panel divide-y divide-border px-4">
              {incomeAllocations.map((allocation) => {
                const amount = allocationAmount(allocation, Number(income.amount));
                return (
                  <li
                    key={allocation.id}
                    className="flex min-w-0 flex-wrap items-center gap-3 py-3 sm:flex-nowrap"
                  >
                    <Checkbox
                      checked={allocation.completed}
                      disabled={updateAllocation.isPending}
                      aria-label={
                        allocation.completed
                          ? `Mark ${allocation.title} incomplete`
                          : `Complete ${allocation.title}`
                      }
                      onCheckedChange={(checked) =>
                        updateAllocation.mutate(
                          { id: allocation.id, completed: checked === true },
                          {
                            onError: () => toast.error("Couldn't update allocation completion"),
                          },
                        )
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`break-words text-sm font-medium ${
                          allocation.completed
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {allocation.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {allocation.allocation_type === "percentage"
                          ? `${allocation.value}% of ${formatMoney(Number(income.amount))} = `
                          : "Fixed amount · "}
                        {formatMoney(amount)}
                        {` · ${formatFinanceDate(allocation.planned_date)}`}
                      </p>
                    </div>
                    <Badge variant={allocation.completed ? "secondary" : "outline"}>
                      {allocation.completed ? "Completed" : "Planned"}
                    </Badge>
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingAllocation(allocation);
                          setAllocationDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${allocation.title}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingAllocationDelete(allocation)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Linked expenses</h2>
              <p className="text-sm text-muted-foreground">
                Only expenses explicitly linked to this income are included.
              </p>
            </div>
            <Button size="sm" onClick={() => openTransaction("expense")}>
              <Plus className="mr-1 h-4 w-4" />
              Add expense
            </Button>
          </div>
          {incomeExpenses.length === 0 ? (
            <div className="nexora-panel p-5">
              <p className="text-sm text-muted-foreground">
                No expenses are linked to this income.
              </p>
            </div>
          ) : (
            <ul className="nexora-panel divide-y divide-border px-4">
              {incomeExpenses.map((expense) => (
                <li
                  key={expense.id}
                  className="flex min-w-0 flex-wrap items-center gap-3 py-3 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {expense.category || "Expense"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatFinanceDate(expense.transaction_date)}
                      {expense.description ? ` · ${expense.description}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    −{formatMoney(Number(expense.amount))}
                  </span>
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openTransaction("expense", expense)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${expense.category || "expense"}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingExpenseDelete(expense)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
              <li className="flex justify-between gap-3 py-3 text-sm font-semibold">
                <span>Total linked expenses</span>
                <span>{formatMoney(spent)}</span>
              </li>
            </ul>
          )}
        </section>
      </div>

      <TransactionDialog
        type={transactionType}
        transaction={editingTransaction}
        incomes={incomeOptions}
        incomeOptionsError={transactions.isError}
        onClose={closeTransactionDialog}
      />
      <IncomeAllocationDialog
        open={allocationDialogOpen}
        incomeId={income.id}
        incomeAmount={Number(income.amount)}
        allocation={editingAllocation}
        onClose={() => setAllocationDialogOpen(false)}
      />
      <ConfirmDialog
        open={pendingAllocationDelete !== null}
        onOpenChange={(next) => !next && setPendingAllocationDelete(null)}
        title="Delete this allocation?"
        description="This removes only the plan. It does not create or delete an expense."
        confirmLabel="Delete allocation"
        onConfirm={() => {
          if (!pendingAllocationDelete) return;
          deleteAllocation.mutate(pendingAllocationDelete.id, {
            onSuccess: () => toast.success("Allocation deleted"),
            onError: () => toast.error("Couldn't delete that allocation"),
          });
          setPendingAllocationDelete(null);
        }}
      />
      <ConfirmDialog
        open={confirmIncomeDelete}
        onOpenChange={setConfirmIncomeDelete}
        title="Delete this income?"
        description="This permanently deletes the income and its allocations. Linked expenses are kept and become unlinked."
        confirmLabel="Delete income"
        onConfirm={() => {
          deleteTransaction.mutate(income.id, {
            onSuccess: () => {
              toast.success("Income deleted");
              window.location.assign("/finance");
            },
            onError: () => toast.error("Couldn't delete that income"),
          });
          setConfirmIncomeDelete(false);
        }}
      />
      <ConfirmDialog
        open={pendingExpenseDelete !== null}
        onOpenChange={(next) => !next && setPendingExpenseDelete(null)}
        title="Delete this expense?"
        description="This permanently deletes the selected expense."
        confirmLabel="Delete expense"
        onConfirm={() => {
          if (!pendingExpenseDelete) return;
          deleteTransaction.mutate(pendingExpenseDelete.id, {
            onSuccess: () => toast.success("Expense deleted"),
            onError: () => toast.error("Couldn't delete that expense"),
          });
          setPendingExpenseDelete(null);
        }}
      />
    </AppShell>
  );
}
