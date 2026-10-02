import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/finance";
import {
  todayISO,
  useCreateTransaction,
  useUpdateTransaction,
  type Transaction,
  type TransactionType,
} from "@/lib/nexora-data";

export function TransactionDialog({
  type,
  transaction,
  incomes = [],
  incomeOptionsError = false,
  onClose,
}: {
  type: TransactionType | null;
  transaction: Transaction | null;
  incomes?: Transaction[];
  incomeOptionsError?: boolean;
  onClose: () => void;
}) {
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const [amount, setAmount] = useState("");
  const [sourceOrCategory, setSourceOrCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [linkedIncomeId, setLinkedIncomeId] = useState("unlinked");
  const open = type !== null;

  useEffect(() => {
    if (!open) return;
    setAmount(transaction ? String(transaction.amount) : "");
    setSourceOrCategory(transaction?.category ?? "");
    setDescription(transaction?.description ?? "");
    setDate(transaction?.transaction_date ?? todayISO());
    setLinkedIncomeId(transaction?.income_id ?? "unlinked");
  }, [open, transaction, type]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!type) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      const values = {
        amount: Math.round((value + Number.EPSILON) * 100) / 100,
        category: sourceOrCategory.trim() || null,
        description: description.trim() || null,
        transaction_date: date || todayISO(),
        income_id: income ? null : linkedIncomeId === "unlinked" ? null : linkedIncomeId,
      };
      if (transaction) {
        await updateTransaction.mutateAsync({ id: transaction.id, ...values });
        toast.success(type === "income" ? "Income updated" : "Expense updated");
      } else {
        await createTransaction.mutateAsync({ ...values, type });
        toast.success(type === "income" ? "Income recorded" : "Expense recorded");
      }
      onClose();
    } catch {
      toast.error("Couldn't save that transaction. Please try again.");
    }
  }

  const pending = createTransaction.isPending || updateTransaction.isPending;
  const income = type === "income";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Edit" : "Add"} {income ? "income" : "expense"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="finance-amount">Amount</Label>
            <Input
              id="finance-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-source">{income ? "Source" : "Category"}</Label>
            <Input
              id="finance-source"
              value={sourceOrCategory}
              onChange={(event) => setSourceOrCategory(event.target.value)}
              placeholder={income ? "Salary, freelance, gift…" : "Groceries, travel…"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-date">Date</Label>
            <Input
              id="finance-date"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          {!income && (
            <div className="space-y-2">
              <Label htmlFor="finance-linked-income">Linked income (optional)</Label>
              <Select value={linkedIncomeId} onValueChange={setLinkedIncomeId}>
                <SelectTrigger id="finance-linked-income" disabled={incomeOptionsError}>
                  <SelectValue placeholder="No linked income" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlinked">No linked income</SelectItem>
                  {incomes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.category || "Income"} — {formatMoney(Number(item.amount))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {incomeOptionsError && (
                <p className="text-xs text-destructive" role="alert">
                  Couldn't load income choices. This expense's existing link will be preserved.
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="finance-description">Description (optional)</Label>
            <Textarea
              id="finance-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : transaction ? "Save changes" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
