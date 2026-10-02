import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FolderKanban, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GoalDialog } from "@/components/goal-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDeleteGoal, useGoals, useProjects, type Goal } from "@/lib/nexora-data";

export const Route = createFileRoute("/goals/$goalId")({
  head: () => ({
    meta: [
      { title: "Goal — Nexora" },
      { name: "description", content: "Review goal progress and related projects." },
    ],
  }),
  component: GoalDetailPage,
});

function GoalDetailPage() {
  const { goalId } = Route.useParams();
  const goals = useGoals();
  const projects = useProjects();
  const deleteGoal = useDeleteGoal();
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const goal = (goals.data ?? []).find((item) => item.id === goalId);
  const relatedProjects = (projects.data ?? []).filter((project) => project.goal_id === goalId);

  if (goals.isLoading || projects.isLoading) {
    return (
      <AppShell>
        <LoadingState rows={3} />
      </AppShell>
    );
  }
  if (goals.isError || projects.isError) {
    return (
      <AppShell>
        <ErrorState onRetry={() => void Promise.all([goals.refetch(), projects.refetch()])} />
      </AppShell>
    );
  }
  if (!goal) {
    return (
      <AppShell>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">This goal could not be found.</p>
          <Button variant="outline" asChild>
            <Link to="/goals">Back to goals</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={goal.title}
          description={goal.description || "A meaningful outcome you're working toward."}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/goals">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Goals
              </Link>
            </Button>
          }
        />

        <section className="nexora-panel space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="outline" className="capitalize">
              {goal.status}
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit goal
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
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} aria-label={`${goal.progress}% complete`} />
          </div>
          <dl className="grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Target date</dt>
              <dd className="mt-1 text-foreground">
                {goal.target_date
                  ? new Date(`${goal.target_date}T00:00:00`).toLocaleDateString()
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-1 text-foreground">
                {new Date(goal.created_at).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="mt-1 text-foreground">
                {new Date(goal.updated_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Projects</h2>
              <p className="text-sm text-muted-foreground">
                Optional projects that move this goal forward.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to="/projects" search={{ goalId }}>
                <FolderKanban className="mr-1 h-4 w-4" />
                Add project
              </Link>
            </Button>
          </div>
          {relatedProjects.length === 0 ? (
            <p className="nexora-panel p-4 text-sm text-muted-foreground">
              No projects are connected to this goal yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedProjects.map((project) => (
                <Link
                  key={project.id}
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="nexora-panel min-w-0 space-y-3 p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="break-words font-medium text-foreground">{project.name}</span>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {project.status === "on_hold" ? "paused" : project.status}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <GoalDialog open={editing} onOpenChange={setEditing} goal={goal} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete this goal?"
        description="Connected projects will remain and become unlinked."
        confirmLabel="Delete goal"
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteGoal.mutate(pendingDelete.id, {
            onSuccess: () => {
              toast.success("Goal deleted");
              window.location.assign("/goals");
            },
            onError: () => toast.error("Couldn't delete that goal"),
          });
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
