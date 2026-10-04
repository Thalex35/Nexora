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
import { parseQuickCapture } from "@/lib/intelligence";
import {
  todayISO,
  useCreateGoal,
  useCreateAchievement,
  useCreateLearningItem,
  useCreateNote,
  useCreateProject,
  useCreateRoutine,
  useCreateTask,
  useCreateTransaction,
  useTransactions,
  type TaskPriority,
} from "@/lib/nexora-data";

type QuickAddType =
  | "task"
  | "routine"
  | "expense"
  | "income"
  | "goal"
  | "project"
  | "learning"
  | "achievement"
  | "note"
  | "capture";

const typeLabels: Record<QuickAddType, string> = {
  task: "Add Task",
  routine: "Add Routine",
  expense: "Add Expense",
  income: "Add Income",
  goal: "Add Goal",
  project: "Add Project",
  learning: "Add Learning",
  achievement: "Add Achievement",
  note: "Add Note",
  capture: "Quick Capture",
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

        {type === "capture" ? (
          <QuickCaptureForm onDone={() => setOpen(false)} />
        ) : (
          <QuickAddForm type={type} onDone={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type CaptureProposal = NonNullable<ReturnType<typeof parseQuickCapture>>;

function QuickCaptureForm({ onDone }: { onDone: () => void }) {
  const createTask = useCreateTask();
  const createNote = useCreateNote();
  const createTransaction = useCreateTransaction();
  const [input, setInput] = useState("");
  const [proposal, setProposal] = useState<CaptureProposal | null>(null);
  const [category, setCategory] = useState("");
  const [capturePriority, setCapturePriority] = useState<TaskPriority>("medium");
  const [parseFailed, setParseFailed] = useState(false);
  const pending = createTask.isPending || createNote.isPending || createTransaction.isPending;

  function prepare(event: React.FormEvent) {
    event.preventDefault();
    const next = parseQuickCapture(input, todayISO());
    setProposal(next);
    setParseFailed(!next);
    setCategory("");
    setCapturePriority("medium");
  }

  function updateProposal(values: Partial<CaptureProposal>) {
    setProposal((current) => (current ? { ...current, ...values } : current));
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!proposal) return;
    try {
      if (proposal.type === "task") {
        if (!proposal.title.trim()) {
          toast.error("Add a task title before saving");
          return;
        }
        await createTask.mutateAsync({
          title: proposal.title.trim(),
          description: proposal.notes.trim() || null,
          priority: capturePriority,
          due_date: proposal.date || null,
        });
      } else if (proposal.type === "note") {
        if (!proposal.title.trim()) {
          toast.error("Add a note title before saving");
          return;
        }
        await createNote.mutateAsync({
          title: proposal.title.trim(),
          content: proposal.notes,
          category: category.trim() || "Personal",
        });
      } else {
        const amountValue = Number(proposal.amount);
        if (!Number.isFinite(amountValue) || amountValue <= 0 || !proposal.notes.trim()) {
          toast.error("Enter a valid amount and expense description");
          return;
        }
        await createTransaction.mutateAsync({
          type: "expense",
          amount: amountValue,
          category: category.trim() || null,
          description: proposal.notes.trim(),
          transaction_date: proposal.date || todayISO(),
          income_id: null,
        });
      }
      toast.success(
        `${proposal.type === "expense" ? "Expense" : proposal.type === "note" ? "Note" : "Task"} saved`,
      );
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (!proposal) {
    return (
      <form onSubmit={prepare} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qa-capture-input">Describe a task, note, or expense</Label>
          <Textarea
            id="qa-capture-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={'"Call Sam tomorrow", "note: book ideas", or "spent $12 on lunch"'}
            rows={3}
            required
          />
          <p className="text-xs text-muted-foreground">
            Nexora prepares a local draft only. Nothing is saved until you review and confirm it.
          </p>
          {parseFailed && (
            <p className="text-xs text-destructive" role="alert">
              Couldn't identify a task, note, or expense. Try adding “task:”, “note:”, or an expense
              amount.
            </p>
          )}
        </div>
        <Button type="submit" className="w-full">
          Prepare for review
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="qa-capture-type">Proposed item</Label>
        <Select
          value={proposal.type}
          onValueChange={(value) => {
            if (value === "task" || value === "note" || value === "expense")
              updateProposal({ type: value });
          }}
        >
          <SelectTrigger id="qa-capture-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {proposal.type === "expense" ? (
        <div className="space-y-2">
          <Label htmlFor="qa-capture-amount">Amount</Label>
          <Input
            id="qa-capture-amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={proposal.amount}
            onChange={(event) => updateProposal({ amount: event.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="qa-capture-title">
            {proposal.type === "note" ? "Note title" : "Task title"}
          </Label>
          <Input
            id="qa-capture-title"
            required
            value={proposal.title}
            onChange={(event) => updateProposal({ title: event.target.value })}
          />
        </div>
      )}
      {proposal.type === "task" && (
        <div className="space-y-2">
          <Label htmlFor="qa-capture-priority">Priority</Label>
          <Select
            value={capturePriority}
            onValueChange={(value) => setCapturePriority(value as TaskPriority)}
          >
            <SelectTrigger id="qa-capture-priority">
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
      {proposal.type !== "task" && (
        <div className="space-y-2">
          <Label htmlFor="qa-capture-category">Category</Label>
          <Input
            id="qa-capture-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={proposal.type === "note" ? "Personal" : "Groceries"}
          />
        </div>
      )}
      {proposal.type !== "task" && (
        <div className="space-y-2">
          <Label htmlFor="qa-capture-description">
            {proposal.type === "note" ? "Content" : "Expense description"}
          </Label>
          <Textarea
            id="qa-capture-description"
            value={proposal.notes}
            onChange={(event) => updateProposal({ notes: event.target.value })}
            rows={2}
          />
        </div>
      )}
      {proposal.type !== "note" && (
        <div className="space-y-2">
          <Label htmlFor="qa-capture-date">
            {proposal.type === "task" ? "Due date (optional)" : "Expense date"}
          </Label>
          <Input
            id="qa-capture-date"
            type="date"
            value={proposal.date}
            onChange={(event) => updateProposal({ date: event.target.value })}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            setProposal(null);
            setParseFailed(false);
          }}
        >
          Cancel draft
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Saving…" : `Confirm ${proposal.type}`}
        </Button>
      </div>
    </form>
  );
}

function QuickAddForm({ type, onDone }: { type: QuickAddType; onDone: () => void }) {
  const createTask = useCreateTask();
  const createGoal = useCreateGoal();
  const createAchievement = useCreateAchievement();
  const createNote = useCreateNote();
  const createLearningItem = useCreateLearningItem();
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
    createAchievement.isPending ||
    createNote.isPending ||
    createGoal.isPending ||
    createLearningItem.isPending ||
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
      } else if (type === "learning") {
        await createLearningItem.mutateAsync({
          title: title.trim(),
          description: notes.trim() || null,
          category: category.trim() || null,
          target_date: date || null,
        });
      } else if (type === "achievement") {
        await createAchievement.mutateAsync({
          title: title.trim(),
          description: notes.trim() || null,
          category: category.trim() || "Personal",
          achievement_date: date || todayISO(),
        });
      } else if (type === "note") {
        await createNote.mutateAsync({
          title: title.trim(),
          content: notes,
          category: category.trim() || "Personal",
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
        throw new Error("This item type is not supported.");
      }
      toast.success(`${typeLabels[type].replace("Add ", "")} saved`);
      reset();
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    }
  }

  const isMoney = type === "income" || type === "expense";
  const hasDate =
    type === "task" ||
    type === "goal" ||
    type === "project" ||
    type === "learning" ||
    type === "achievement" ||
    isMoney;

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
            {type === "project"
              ? "Project name"
              : type === "routine"
                ? "Routine name"
                : type === "learning"
                  ? "Learning item"
                  : type === "achievement"
                    ? "Achievement"
                    : type === "note"
                      ? "Note title"
                      : "Title"}
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
                  : type === "learning"
                    ? "What do you want to learn?"
                    : type === "achievement"
                      ? "What meaningful milestone did you reach?"
                      : type === "note"
                        ? "Give this note a useful title"
                        : "What needs doing?"
            }
          />
        </div>
      )}

      {(type === "learning" || type === "achievement" || type === "note") && (
        <div className="space-y-2">
          <Label htmlFor="qa-category">
            {type === "achievement" || type === "note" ? "Category" : "Category or topic"}
          </Label>
          <Input
            id="qa-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={
              type === "achievement" || type === "note" ? "Personal" : "Programming, Languages…"
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
                  : type === "learning"
                    ? "Target date"
                    : type === "achievement"
                      ? "Achievement date"
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
          <Label htmlFor="qa-notes">
            {type === "note" ? "Content" : isMoney ? "Description" : "Details"}
          </Label>
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
