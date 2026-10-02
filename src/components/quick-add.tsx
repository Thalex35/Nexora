import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  useCreateGoal,
  useCreateProject,
  useCreateRoutine,
  useCreateTask,
  useCreateTransaction,
  useTransactions,
  type TaskPriority,
} from "@/lib/nexora-data";

type QuickAddType = "task" | "routine" | "expense" | "income" | "goal" | "project" | "note";

const typeLabels: Record<QuickAddType, string> = {
  task: "Add Task",
  routine: "Add Routine",
  expense: "Add Expense",
  income: "Add Income",
  goal: "Add Goal",
  project: "Add Project",
  note: "Add Note",
};

export function QuickAdd({ defaultType = "task" }: { defaultType?: QuickAddType }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<QuickAddType>(defaultType);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setType(defaultType);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Quick Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Add</DialogTitle>
          <DialogDescription>Capture something without leaving the page.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>What are you adding?</Label>
          <Select value={type} onValueChange={(value) => setType(value as QuickAddType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(typeLabels) as QuickAddType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {typeLabels[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <QuickAddForm type={type} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function QuickAddForm({ type, onDone }: { type: QuickAddType; onDone: () => void }) {
  const createTask = useCreateTask();
  const createGoal = useCreateGoal();
  const createProject = useCreateProject();
  const createRoutine = useCreateRoutine();
  const createTransaction = useCreateTransaction();
  const transactions = useTransactions();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [linkedIncomeId, setLinkedIncomeId] = useState("unlinked");
  const incomes = (transactions.data ?? []).filter((transaction) => transaction.type === "income");

  const pending =
    createTask.isPending ||
    createGoal.isPending ||
    createProject.isPending ||
    createRoutine.isPending ||
    createTransaction.isPending;

  const reset = () => {
    setTitle("");
    setNotes("");
    setDate("");
    setAmount("");
    setCategory("");
    setLinkedIncomeId("unlinked");
    setPriority("medium");
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (type === "task") {
        await createTask.mutateAsync({
          title,
          description: notes || null,
          priority,
          due_date: date || null,
        });
      } else if (type === "goal") {
        await createGoal.mutateAsync({
          title,
          description: notes || null,
          target_date: date || null,
        });
      } else if (type === "project") {
        await createProject.mutateAsync({
          name: title,
          description: notes || null,
          deadline: date || null,
        });
      } else if (type === "routine") {
        await createRoutine.mutateAsync({
          name: title.trim(),
          description: notes || null,
        });
      } else if (type === "income" || type === "expense") {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
          toast.error("Enter a valid amount");
          return;
        }
        await createTransaction.mutateAsync({
          type,
          amount: value,
          category: category || null,
          description: notes || title || null,
          transaction_date: date || todayISO(),
          income_id: type === "expense" && linkedIncomeId !== "unlinked" ? linkedIncomeId : null,
        });
      } else {
        toast.info("Notes arrive in a later sprint", {
          description: "The Notes module is still a foundation — nothing was saved.",
        });
        return;
      }
      toast.success(`${typeLabels[type].replace("Add ", "")} saved`);
      reset();
      onDone();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  if (type === "note") {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Notes are a foundation in this release. Once the Notes module ships, quick-added notes will
        save here.
      </div>
    );
  }

  const isMoney = type === "income" || type === "expense";
  const hasDate = type === "task" || type === "goal" || type === "project" || isMoney;

  return (
    <form onSubmit={submit} className="space-y-4">
      {isMoney ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="qa-amount">Amount</Label>
            <Input
              id="qa-amount"
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
            <Label htmlFor="qa-category">{type === "income" ? "Source" : "Category"}</Label>
            <Input
              id="qa-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder={type === "income" ? "Salary" : "Groceries"}
            />
          </div>
          {type === "expense" && (
            <div className="space-y-2">
              <Label htmlFor="qa-linked-income">Linked income (optional)</Label>
              <Select value={linkedIncomeId} onValueChange={setLinkedIncomeId}>
                <SelectTrigger
                  id="qa-linked-income"
                  disabled={transactions.isLoading || transactions.isError}
                >
                  <SelectValue placeholder="No linked income" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlinked">No linked income</SelectItem>
                  {incomes.map((income) => (
                    <SelectItem key={income.id} value={income.id}>
                      {income.category || "Income"} — {formatMoney(Number(income.amount))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transactions.isError && (
                <p className="text-xs text-destructive" role="alert">
                  Couldn't load incomes. Try again before linking this expense.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="qa-title">
            {type === "project" ? "Project name" : type === "routine" ? "Routine name" : "Title"}
          </Label>
          <Input
            id="qa-title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              type === "goal"
                ? "Run a half marathon"
                : type === "routine"
                  ? "Morning walk"
                  : "What needs doing?"
            }
          />
        </div>
      )}

      {type === "task" && (
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {hasDate && (
        <div className="space-y-2">
          <Label htmlFor="qa-date">
            {type === "task"
              ? "Due date"
              : type === "goal"
                ? "Target date"
                : type === "project"
                  ? "Deadline"
                  : "Date"}
          </Label>
          <Input
            id="qa-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      )}

      {type !== "task" && (
        <div className="space-y-2">
          <Label htmlFor="qa-notes">{isMoney ? "Description" : "Details"}</Label>
          <Textarea
            id="qa-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : typeLabels[type]}
      </Button>
    </form>
  );
}
