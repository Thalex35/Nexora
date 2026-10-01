import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  todayISO,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  type TransactionType,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Nexora" },
      {
        name: "description",
        content:
          "Record income and expenses in Nexora and see your totals and remaining balance at a glance.",
      },
      { property: "og:title", content: "Finance — Nexora" },
      {
        property: "og:description",
        content: "Record income and expenses and see your remaining balance at a glance.",
      },
    ],
  }),
  component: FinancePage,
});

const money = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function FinancePage() {
  const transactions = useTransactions();
  const deleteTransaction = useDeleteTransaction();
  const [dialogType, setDialogType] = useState<TransactionType | null>(null);

  const rows = transactions.data ?? [];
  const income = rows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const expenses = rows
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Finance"
          description="What comes in, what goes out, what's left."
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => setDialogType("income")}>
                Add income
              </Button>
              <Button size="sm" onClick={() => setDialogType("expense")}>
                Add expense
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Total income" value={rows.length ? money(income) : null} />
          <SummaryCard label="Total expenses" value={rows.length ? money(expenses) : null} />
          <SummaryCard
            label="Remaining balance"
            value={rows.length ? money(income - expenses) : null}
            accent
          />
        </div>

        <section className="space-y-3">
          <h2 className="nexora-label">Transactions</h2>
          {transactions.isLoading ? (
            <LoadingState />
          ) : transactions.isError ? (
            <ErrorState onRetry={() => void transactions.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="No transactions yet"
              description="Record your first income or expense to see your balance."
              actionLabel="Add expense"
              onAction={() => setDialogType("expense")}
            />
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="nexora-panel flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {row.description || row.category || (row.type === "income" ? "Income" : "Expense")}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {new Date(`${row.transaction_date}T00:00:00`).toLocaleDateString()}
                      {row.category ? ` · ${row.category}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold",
                      row.type === "income" ? "text-success" : "text-foreground",
                    )}
                  >
                    {row.type === "income" ? "+" : "−"}
                    {money(Number(row.amount))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete transaction"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      deleteTransaction.mutate(row.id, {
                        onSuccess: () => toast.success("Transaction deleted"),
                        onError: () => toast.error("Couldn't delete that transaction"),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <TransactionDialog
        type={dialogType}
        onClose={() => setDialogType(null)}
      />
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <div className="nexora-panel p-4">
      <p className="nexora-label">{label}</p>
      <p
        className={cn(
          "mt-2 text-xl font-semibold",
          accent ? "text-primary" : "text-foreground",
          !value && "text-sm font-normal text-muted-foreground",
        )}
      >
        {value ?? "No transactions yet"}
      </p>
    </div>
  );
}

function TransactionDialog({
  type,
  onClose,
}: {
  type: TransactionType | null;
  onClose: () => void;
}) {
  const createTransaction = useCreateTransaction();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!type) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await createTransaction.mutateAsync({
        type,
        amount: value,
        category: category || null,
        description: description || null,
        transaction_date: date || todayISO(),
      });
      toast.success(type === "income" ? "Income recorded" : "Expense recorded");
      setAmount("");
      setCategory("");
      setDescription("");
      setDate(todayISO());
      onClose();
    } catch {
      toast.error("Couldn't save that. Please try again.");
    }
  }

  return (
    <Dialog open={type !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "income" ? "Add income" : "Add expense"}
            {type && (
              <Badge variant="outline" className="capitalize">
                {type}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tx-amount">Amount</Label>
            <Input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-category">Category</Label>
            <Input
              id="tx-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder={type === "income" ? "Salary" : "Groceries"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-date">Date</Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-description">{type === "income" ? "Source" : "Description"}</Label>
            <Textarea
              id="tx-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
