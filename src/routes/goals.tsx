import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
  type Goal,
  type GoalStatus,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Nexora" },
      {
        name: "description",
        content:
          "Track what you are working toward in Nexora with target dates, status and clear progress.",
      },
      { property: "og:title", content: "Goals — Nexora" },
      {
        property: "og:description",
        content: "Track what you are working toward with target dates and clear progress.",
      },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const goals = useGoals();
  const deleteGoal = useDeleteGoal();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Goals"
          description="What you are working toward."
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              New goal
            </Button>
          }
        />

        {goals.isLoading ? (
          <LoadingState />
        ) : goals.isError ? (
          <ErrorState onRetry={() => void goals.refetch()} />
        ) : (goals.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Target className="h-5 w-5" />}
            title="No goals yet"
            description="Set a goal and track your progress toward it."
            actionLabel="Create a goal"
            onAction={() => {
              setEditing(null);
              setOpen(true);
            }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(goals.data ?? []).map((goal) => (
              <article key={goal.id} className="nexora-panel space-y-4 p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {goal.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {goal.target_date
                      ? `Target ${new Date(`${goal.target_date}T00:00:00`).toLocaleDateString()}`
                      : "No target date"}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(goal);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete goal"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingDelete(goal)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <GoalDialog open={open} onOpenChange={setOpen} goal={editing} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete this goal?"
        description="This permanently removes the goal and its progress."
        confirmLabel="Delete goal"
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteGoal.mutate(pendingDelete.id, {
            onSuccess: () => toast.success("Goal deleted"),
            onError: () => toast.error("Couldn't delete that goal"),
          });
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
}) {
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [targetDate, setTargetDate] = useState("");
  const [progress, setProgress] = useState("0");
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const key = goal?.id ?? "new";
  if (open && hydratedFor !== key) {
    setTitle(goal?.title ?? "");
    setDescription(goal?.description ?? "");
    setStatus(goal?.status ?? "active");
    setTargetDate(goal?.target_date ?? "");
    setProgress(String(goal?.progress ?? 0));
    setHydratedFor(key);
  }
  if (!open && hydratedFor !== null) setHydratedFor(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = {
      title,
      description: description || null,
      status,
      target_date: targetDate || null,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
    };
    try {
      if (goal) {
        await updateGoal.mutateAsync({ id: goal.id, ...values });
        toast.success("Goal updated");
      } else {
        await createGoal.mutateAsync(values);
        toast.success("Goal created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that goal. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-description">Description</Label>
            <Textarea
              id="goal-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as GoalStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-progress">Progress (%)</Label>
              <Input
                id="goal-progress"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(event) => setProgress(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-target">Target date</Label>
            <Input
              id="goal-target"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={createGoal.isPending || updateGoal.isPending}
            >
              {createGoal.isPending || updateGoal.isPending ? "Saving…" : "Save goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
