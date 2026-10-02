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
import { Textarea } from "@/components/ui/textarea";
import {
  todayISO,
  useCreateDebt,
  useCreateFutureExpense,
  useUpdateDebt,
  useUpdateFutureExpense,
  type Debt,
  type FutureExpense,
  type FutureExpenseInput,
} from "@/lib/nexora-data";

export function FutureExpenseDialog({
  open,
  expense,
  defaultDate,
  onClose,
}: {
  open: boolean;
  expense: FutureExpense | null;
  defaultDate?: string;
  onClose: () => void;
}) {
  const createFutureExpense = useCreateFutureExpense();
  const updateFutureExpense = useUpdateFutureExpense();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [plannedDate, setPlannedDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const pending = createFutureExpense.isPending || updateFutureExpense.isPending;

  useEffect(() => {
    if (!open) return;
    setTitle(expense?.title ?? "");
    setAmount(expense ? String(expense.amount) : "");
    setPlannedDate(expense?.planned_date ?? defaultDate ?? todayISO());
    setDescription(expense?.description ?? "");
  }, [defaultDate, open, expense]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    const values: FutureExpenseInput = {
      title: title.trim(),
      amount: Math.round((amountValue + Number.EPSILON) * 100) / 100,
      planned_date: plannedDate,
      description: description.trim() || null,
    };
    try {
      if (expense) {
        await updateFutureExpense.mutateAsync({ id: expense.id, ...values });
        toast.success("Future expense updated");
      } else {
        await createFutureExpense.mutateAsync(values);
        toast.success("Future expense planned");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this future expense");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit future expense" : "Plan a future expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="future-expense-title">Title</Label>
            <Input
              id="future-expense-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              required
              placeholder="Car insurance"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="future-expense-amount">Amount</Label>
            <Input
              id="future-expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="future-expense-date">Planned date</Label>
            <Input
              id="future-expense-date"
              type="date"
              required
              value={plannedDate}
              onChange={(event) => setPlannedDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="future-expense-description">Description (optional)</Label>
            <Textarea
              id="future-expense-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending || !title.trim()}>
              {pending ? "Saving…" : expense ? "Save changes" : "Plan expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FutureExpensePaymentDialog({
  open,
  expense,
  pending,
  onClose,
  onPay,
}: {
  open: boolean;
  expense: FutureExpense | null;
  pending: boolean;
  onClose: () => void;
  onPay: (paidDate: string) => void;
}) {
  const [paidDate, setPaidDate] = useState(todayISO());

  useEffect(() => {
    if (open) setPaidDate(todayISO());
  }, [open, expense]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This creates an actual expense for {expense?.title ?? "this plan"}, links it here, and
            keeps the future-expense record in history.
          </p>
          <div className="space-y-2">
            <Label htmlFor="future-expense-paid-date">Paid date</Label>
            <Input
              id="future-expense-paid-date"
              type="date"
              required
              value={paidDate}
              onChange={(event) => setPaidDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              className="w-full"
              disabled={pending || !expense || !paidDate}
              onClick={() => onPay(paidDate)}
            >
              {pending ? "Recording…" : "Create actual expense"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DebtDialog({
  open,
  debt,
  defaultDate,
  onClose,
}: {
  open: boolean;
  debt: Debt | null;
  defaultDate?: string;
  onClose: () => void;
}) {
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const [creditor, setCreditor] = useState("");
  const [amount, setAmount] = useState("");
  const [debtDate, setDebtDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const pending = createDebt.isPending || updateDebt.isPending;

  useEffect(() => {
    if (!open) return;
    setCreditor(debt?.creditor ?? "");
    setAmount(debt ? String(debt.amount) : "");
    setDebtDate(debt?.debt_date ?? defaultDate ?? todayISO());
    setDueDate(debt?.due_date ?? "");
    setDescription(debt?.description ?? "");
  }, [defaultDate, open, debt]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    const values = {
      creditor: creditor.trim(),
      amount: Math.round((amountValue + Number.EPSILON) * 100) / 100,
      debt_date: debtDate,
      due_date: dueDate || null,
      description: description.trim() || null,
    };
    try {
      if (debt) {
        await updateDebt.mutateAsync({ id: debt.id, ...values });
        toast.success("Debt updated");
      } else {
        await createDebt.mutateAsync(values);
        toast.success("Debt recorded");
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this debt");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{debt ? "Edit debt" : "Record a debt"}</DialogTitle>
        </DialogHeader>
        {debt?.status === "paid" && (
          <p className="text-sm text-muted-foreground">
            Paid on {debt.paid_date}. Paid debts remain in your history.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="debt-creditor">Person or creditor</Label>
            <Input
              id="debt-creditor"
              value={creditor}
              onChange={(event) => setCreditor(event.target.value)}
              maxLength={160}
              required
              placeholder="Creditor"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debt-amount">Amount owed</Label>
            <Input
              id="debt-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="debt-date">Date</Label>
              <Input
                id="debt-date"
                type="date"
                required
                value={debtDate}
                onChange={(event) => setDebtDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debt-due-date">Due date (optional)</Label>
              <Input
                id="debt-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="debt-description">Description or reason (optional)</Label>
            <Textarea
              id="debt-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending || !creditor.trim()}>
              {pending ? "Saving…" : debt ? "Save changes" : "Record debt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
