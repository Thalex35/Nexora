import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GoalDialog } from "@/components/goal-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeleteGoal, useGoals, useUpdateGoal, type Goal } from "@/lib/nexora-data";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Nexora" },
      {
        name: "description",
        content: "Track meaningful goals with clear progress, status and target dates.",
      },
      { property: "og:title", content: "Goals — Nexora" },
      {
        property: "og:description",
        content: "Track what you are working toward with clear progress and target dates.",
      },
    ],
  }),
  component: GoalsPage,
});

type GoalFilter = "active" | "completed" | "paused" | "all";

function GoalsPage() {
  const goals = useGoals();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const [filter, setFilter] = useState<GoalFilter>("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const visible = (goals.data ?? []).filter((goal) => {
    if (filter === "all") return true;
    if (filter === "paused") return goal.status === "paused";
    return goal.status === filter;
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Goals"
          description="Meaningful outcomes to keep moving toward."
          actions={
            <Button size="sm" onClick={openCreate}>
              New goal
            </Button>
          }
        />

        <Tabs value={filter} onValueChange={(value) => setFilter(value as GoalFilter)}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {goals.isLoading ? (
          <LoadingState />
        ) : goals.isError ? (
          <ErrorState onRetry={() => void goals.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Target className="h-5 w-5" />}
            title={filter === "active" ? "No active goals" : `No ${filter} goals`}
            description={
              filter === "active"
                ? "Create a goal to give your longer-term effort a clear direction."
                : "Goals in this view will appear here."
            }
            actionLabel="Create a goal"
            onAction={openCreate}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((goal) => (
              <article key={goal.id} className="nexora-panel min-w-0 space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/goals/$goalId"
                      params={{ goalId: goal.id }}
                      className="break-words font-semibold text-foreground hover:text-primary"
                    >
                      {goal.title}
                    </Link>
                    {goal.description && (
                      <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {goal.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} aria-label={`${goal.progress}% complete`} />
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-muted-foreground">
                      {goal.target_date
                        ? `Target ${new Date(`${goal.target_date}T00:00:00`).toLocaleDateString()}`
                        : "No target date"}
                    </span>
                    <div className="flex shrink-0 items-center">
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
                        aria-label={`Delete ${goal.title}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(goal)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {goal.status === "active" && goal.progress < 100 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={updateGoal.isPending}
                      onClick={() =>
                        updateGoal.mutate(
                          { id: goal.id, progress: Math.min(100, goal.progress + 10) },
                          {
                            onError: () => toast.error("Couldn't update goal progress"),
                          },
                        )
                      }
                    >
                      Update progress +10%
                    </Button>
                  )}
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
        description="Projects connected to it will remain and become unlinked."
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
