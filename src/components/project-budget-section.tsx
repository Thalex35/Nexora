import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateProjectBudget,
  useCreateProjectBudgetItem,
  useDeleteProjectBudget,
  useDeleteProjectBudgetItem,
  useUpdateProjectBudget,
  useUpdateProjectBudgetItem,
  type ProjectBudget,
  type ProjectBudgetItem,
} from "@/lib/nexora-data";
import { calculateProjectBudgetSummary, formatBudgetAmount } from "@/lib/project-budget";

type BudgetCurrency = "USD" | "EUR" | "HTG";

function amountFromInput(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("Enter an amount of zero or more.");
  }
  return Math.round(amount * 100) / 100;
}

function formatDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "No target date";
}

export function ProjectBudgetSection({
  projectId,
  budget,
  items,
  loading,
}: {
  projectId: string;
  budget: ProjectBudget | null;
  items: ProjectBudgetItem[];
  loading: boolean;
}) {
  const createBudget = useCreateProjectBudget();
  const updateBudget = useUpdateProjectBudget();
  const deleteBudget = useDeleteProjectBudget();
  const createItem = useCreateProjectBudgetItem();
  const updateItem = useUpdateProjectBudgetItem();
  const deleteItem = useDeleteProjectBudgetItem();
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectBudgetItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectBudgetItem | null>(null);
  const [deleteBudgetOpen, setDeleteBudgetOpen] = useState(false);
  const [plannedAmount, setPlannedAmount] = useState("");
  const [availableFunds, setAvailableFunds] = useState("");
  const [currency, setCurrency] = useState<BudgetCurrency>("USD");
  const [itemTitle, setItemTitle] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemPlannedAmount, setItemPlannedAmount] = useState("");
  const [itemActualAmount, setItemActualAmount] = useState("0");
  const [itemTargetDate, setItemTargetDate] = useState("");
  const [itemNotes, setItemNotes] = useState("");

  useEffect(() => {
    if (!budgetDialogOpen) return;
    setPlannedAmount(budget ? String(budget.planned_amount) : "");
    setAvailableFunds(
      budget?.available_funds === null || budget?.available_funds === undefined
        ? ""
        : String(budget.available_funds),
    );
    setCurrency((budget?.currency as BudgetCurrency | undefined) ?? "USD");
  }, [budget, budgetDialogOpen]);

  useEffect(() => {
    if (!itemDialogOpen) return;
    setItemTitle(editingItem?.title ?? "");
    setItemCategory(editingItem?.category ?? "");
    setItemPlannedAmount(editingItem ? String(editingItem.planned_amount) : "");
    setItemActualAmount(editingItem ? String(editingItem.actual_amount) : "0");
    setItemTargetDate(editingItem?.target_date ?? "");
    setItemNotes(editingItem?.notes ?? "");
  }, [editingItem, itemDialogOpen]);

  const summary = budget
    ? calculateProjectBudgetSummary(budget.planned_amount, budget.available_funds, items)
    : null;
  const canChangeCurrency = items.length === 0;

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const values = {
        planned_amount: amountFromInput(plannedAmount),
        available_funds: availableFunds ? amountFromInput(availableFunds) : null,
        currency,
      };
      if (budget) {
        await updateBudget.mutateAsync({ id: budget.id, ...values });
        toast.success("Project budget updated");
      } else {
        await createBudget.mutateAsync({ project_id: projectId, ...values });
        toast.success("Project budget created");
      }
      setBudgetDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof RangeError
          ? error.message
          : "Couldn't save the project budget. Please try again.",
      );
    }
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!budget) return;
    try {
      const values = {
        title: itemTitle.trim(),
        category: itemCategory.trim(),
        planned_amount: amountFromInput(itemPlannedAmount),
        actual_amount: amountFromInput(itemActualAmount),
        target_date: itemTargetDate || null,
        notes: itemNotes.trim() || null,
      };
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          budget_id: budget.id,
          ...values,
        });
        toast.success("Budget item updated");
      } else {
        await createItem.mutateAsync({ budget_id: budget.id, ...values });
        toast.success("Budget item added");
      }
      setItemDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      toast.error(
        error instanceof RangeError
          ? error.message
          : "Couldn't save that budget item. Please try again.",
      );
    }
  }

  async function removeItem() {
    if (!pendingDelete || !budget) return;
    try {
      await deleteItem.mutateAsync({ id: pendingDelete.id, budgetId: budget.id });
      toast.success("Budget item removed");
    } catch {
      toast.error("Couldn't remove that budget item. Please try again.");
    }
    setPendingDelete(null);
  }

  async function removeBudget() {
    if (!budget) return;
    try {
      await deleteBudget.mutateAsync({ id: budget.id, projectId });
      toast.success("Project budget removed");
    } catch {
      toast.error("Couldn't remove the project budget. Please try again.");
    }
    setDeleteBudgetOpen(false);
  }

  function openItemDialog(item: ProjectBudgetItem | null = null) {
    setEditingItem(item);
    setItemDialogOpen(true);
  }

  return (
    <section className="space-y-4" aria-labelledby="project-budget-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="project-budget-heading" className="text-lg font-semibold text-foreground">
            Project budget
          </h2>
          <p className="text-sm text-muted-foreground">
            Plan costs and track actual spending. Amounts stay in the selected currency.
          </p>
        </div>
        {budget && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBudgetDialogOpen(true)}
              disabled={loading || updateBudget.isPending}
            >
              <Pencil className="mr-1 h-4 w-4" />
              Edit budget
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteBudgetOpen(true)}
              disabled={deleteBudget.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Remove
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="nexora-panel p-5 text-sm text-muted-foreground" role="status">
          Loading project budget…
        </div>
      ) : !budget || !summary ? (
        <div className="nexora-panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 p-2 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium text-foreground">No budget defined</p>
              <p className="text-sm text-muted-foreground">
                Create a plan for this project and track its costs.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setBudgetDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Set up budget
          </Button>
        </div>
      ) : (
        <>
          <div className="nexora-panel space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Planned project budget</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {formatBudgetAmount(summary.planned, budget.currency)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? "budget item" : "budget items"} ·{" "}
                  {budget.currency}
                </p>
              </div>
              <div className="min-w-48 flex-1 space-y-2 sm:max-w-xs">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Actual spending</span>
                  <span
                    className={summary.overBudget ? "font-medium text-destructive" : "font-medium"}
                  >
                    {formatBudgetAmount(summary.actual, budget.currency)}
                  </span>
                </div>
                <Progress
                  value={summary.progressPercent}
                  aria-label={`${Math.round(summary.progressPercent)}% of the planned budget spent`}
                  className={
                    summary.overBudget ? "[&_[data-radix-progress-indicator]]:bg-destructive" : ""
                  }
                />
                <p
                  className={
                    summary.overBudget
                      ? "text-xs font-medium text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {summary.overBudget
                    ? `Over budget by ${formatBudgetAmount(Math.abs(summary.remaining), budget.currency)}`
                    : `${formatBudgetAmount(summary.remaining, budget.currency)} remaining`}
                </p>
              </div>
            </div>
            <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Allocated</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {formatBudgetAmount(summary.allocated, budget.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Actual vs allocated</dt>
                <dd
                  className={`mt-1 font-medium ${
                    summary.variance > 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {summary.variance > 0 ? "+" : ""}
                  {formatBudgetAmount(summary.variance, budget.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Available funds</dt>
                <dd className="mt-1 font-medium text-foreground">
                  {budget.available_funds === null
                    ? "Not set"
                    : formatBudgetAmount(budget.available_funds, budget.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Funds after spending</dt>
                <dd
                  className={`mt-1 font-medium ${
                    summary.availableFundsRemaining !== null && summary.availableFundsRemaining < 0
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                >
                  {summary.availableFundsRemaining === null
                    ? "Not set"
                    : formatBudgetAmount(summary.availableFundsRemaining, budget.currency)}
                </dd>
              </div>
            </dl>
          </div>

          {summary.categories.length > 0 && (
            <div className="nexora-panel space-y-3 p-4 sm:p-5">
              <h3 className="font-medium text-foreground">By category</h3>
              <div className="divide-y divide-border">
                {summary.categories.map((category) => (
                  <div
                    key={category.category}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">{category.category}</span>
                    <span className="text-muted-foreground">
                      Actual {formatBudgetAmount(category.actual, budget.currency)} / Planned{" "}
                      {formatBudgetAmount(category.planned, budget.currency)} · Variance{" "}
                      <span
                        className={
                          category.variance > 0 ? "font-medium text-destructive" : "text-foreground"
                        }
                      >
                        {category.variance > 0 ? "+" : ""}
                        {formatBudgetAmount(category.variance, budget.currency)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium text-foreground">Budget items</h3>
              <Button size="sm" onClick={() => openItemDialog()} disabled={createItem.isPending}>
                <Plus className="mr-1 h-4 w-4" />
                Add item
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="nexora-panel p-4 text-sm text-muted-foreground">
                Add planned costs to compare allocations with actual spending.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <article key={item.id} className="nexora-panel min-w-0 space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="break-words font-medium text-foreground">{item.title}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${item.title}`}
                          onClick={() => openItemDialog(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${item.title}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingDelete(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Planned</dt>
                        <dd className="mt-1 text-foreground">
                          {formatBudgetAmount(item.planned_amount, budget.currency)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Actual</dt>
                        <dd
                          className={`mt-1 ${
                            item.actual_amount > item.planned_amount
                              ? "font-medium text-destructive"
                              : "text-foreground"
                          }`}
                        >
                          {formatBudgetAmount(item.actual_amount, budget.currency)}
                        </dd>
                      </div>
                    </dl>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDate(item.target_date)}
                    </p>
                    {item.notes && (
                      <p className="break-words border-t border-border pt-3 text-sm text-muted-foreground">
                        {item.notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{budget ? "Edit project budget" : "Set up project budget"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveBudget} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-budget-planned">Planned budget</Label>
              <Input
                id="project-budget-planned"
                type="number"
                min="0"
                step="0.01"
                required
                value={plannedAmount}
                onChange={(event) => setPlannedAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-budget-currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value as BudgetCurrency)}
                disabled={Boolean(budget) && !canChangeCurrency}
              >
                <SelectTrigger id="project-budget-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="HTG">HTG — Haitian Gourde</SelectItem>
                </SelectContent>
              </Select>
              {budget && !canChangeCurrency && (
                <p className="text-xs text-muted-foreground">
                  Remove all budget items before changing currency; amounts are never converted.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-budget-available">Available funds (optional)</Label>
              <Input
                id="project-budget-available"
                type="number"
                min="0"
                step="0.01"
                value={availableFunds}
                onChange={(event) => setAvailableFunds(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Manually maintained; this does not connect to accounts or transactions.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={createBudget.isPending || updateBudget.isPending}
              >
                {createBudget.isPending || updateBudget.isPending ? "Saving…" : "Save budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={itemDialogOpen}
        onOpenChange={(open) => {
          setItemDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit budget item" : "Add budget item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveItem} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget-item-title">Name</Label>
              <Input
                id="budget-item-title"
                required
                value={itemTitle}
                onChange={(event) => setItemTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-item-category">Category</Label>
              <Input
                id="budget-item-category"
                required
                value={itemCategory}
                onChange={(event) => setItemCategory(event.target.value)}
                placeholder="e.g. Equipment, Design, Travel"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-item-planned">Planned amount ({budget?.currency})</Label>
                <Input
                  id="budget-item-planned"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={itemPlannedAmount}
                  onChange={(event) => setItemPlannedAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-item-actual">Actual amount ({budget?.currency})</Label>
                <Input
                  id="budget-item-actual"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={itemActualAmount}
                  onChange={(event) => setItemActualAmount(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-item-date">Target date (optional)</Label>
              <Input
                id="budget-item-date"
                type="date"
                value={itemTargetDate}
                onChange={(event) => setItemTargetDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-item-notes">Notes (optional)</Label>
              <Textarea
                id="budget-item-notes"
                rows={3}
                value={itemNotes}
                onChange={(event) => setItemNotes(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={createItem.isPending || updateItem.isPending}
              >
                {createItem.isPending || updateItem.isPending ? "Saving…" : "Save item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this budget item?"
        description="Its planned and actual amounts will be removed from the project totals."
        confirmLabel="Delete item"
        onConfirm={() => void removeItem()}
      />
      <ConfirmDialog
        open={deleteBudgetOpen}
        onOpenChange={setDeleteBudgetOpen}
        title="Remove this project budget?"
        description="The budget and all of its items will be permanently removed."
        confirmLabel="Remove budget"
        onConfirm={() => void removeBudget()}
      />
    </section>
  );
}
