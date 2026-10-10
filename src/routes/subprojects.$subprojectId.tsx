import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GoalDialog } from "@/components/goal-dialog";
import { PageHeader } from "@/components/page-header";
import { ProjectSubprojectDialog } from "@/components/project-subproject-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useAllProjectSubprojects,
  useDeleteProjectSubproject,
  useGoals,
  useProjects,
  useUpdateGoal,
  type Goal,
} from "@/lib/nexora-data";
import { calculateProjectGoalProgress, sortGoalsChronologically } from "@/lib/project-goals";

export const Route = createFileRoute("/subprojects/$subprojectId")({
  head: () => ({
    meta: [
      { title: "Subproject — Nexora" },
      { name: "description", content: "Review a project phase and its goals." },
    ],
  }),
  component: SubprojectDetailPage,
});

function SubprojectDetailPage() {
  const { subprojectId } = Route.useParams();
  const navigate = useNavigate();
  const projects = useProjects();
  const goals = useGoals();
  const subprojects = useAllProjectSubprojects();
  const updateGoal = useUpdateGoal();
  const deleteSubproject = useDeleteProjectSubproject();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const subproject = (subprojects.data ?? []).find((item) => item.id === subprojectId);
  const project = (projects.data ?? []).find((item) => item.id === subproject?.project_id);
  const projectGoals = sortGoalsChronologically(
    (goals.data ?? []).filter((goal) => goal.subproject_id === subprojectId),
  );
  const loading = projects.isLoading || goals.isLoading || subprojects.isLoading;

  if (loading) {
    return (
      <AppShell>
        <LoadingState rows={3} />
      </AppShell>
    );
  }

  if (projects.isError || goals.isError || subprojects.isError) {
    return (
      <AppShell>
        <ErrorState
          onRetry={() =>
            void Promise.all([projects.refetch(), goals.refetch(), subprojects.refetch()])
          }
        />
      </AppShell>
    );
  }

  if (!subproject || !project) {
    return (
      <AppShell>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">This subproject could not be found.</p>
          <Button variant="outline" asChild>
            <Link to="/projects" search={{ goalId: undefined }}>
              Back to projects
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { completed: completedGoals, progress } = calculateProjectGoalProgress(projectGoals);

  function openGoalDialog(goal: Goal | null = null) {
    setEditingGoal(goal);
    setGoalDialogOpen(true);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">
          <Link
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            search={{ goalId: undefined }}
            className="text-primary hover:underline"
          >
            {project.name}
          </Link>
          <span className="px-2">/</span>
          <span>{subproject.title}</span>
        </div>
        <PageHeader
          title={subproject.title}
          description={subproject.description || "Project phase and its goals."}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                search={{ goalId: undefined }}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                {project.name}
              </Link>
            </Button>
          }
        />

        <section className="nexora-panel space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {subproject.status === "on_hold" ? "paused" : subproject.status}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {subproject.priority} priority
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete subproject"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {subproject.objective && (
            <div>
              <h2 className="text-sm font-medium text-foreground">Objective</h2>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {subproject.objective}
              </p>
            </div>
          )}
          {subproject.notes && (
            <div>
              <h2 className="text-sm font-medium text-foreground">Notes</h2>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {subproject.notes}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                Progress ({completedGoals}/{projectGoals.length} goals completed)
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} aria-label={`${progress}% complete`} />
            {projectGoals.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add a goal to start tracking progress. An empty subproject is not considered
                complete.
              </p>
            )}
          </div>
          <dl className="grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Start date</dt>
              <dd className="mt-1 text-foreground">
                {subproject.start_date
                  ? new Date(`${subproject.start_date}T00:00:00`).toLocaleDateString()
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Deadline</dt>
              <dd className="mt-1 text-foreground">
                {subproject.deadline
                  ? new Date(`${subproject.deadline}T00:00:00`).toLocaleDateString()
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-1 text-foreground">
                {new Date(subproject.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Goals</h2>
              <p className="text-sm text-muted-foreground">
                Only goals assigned to this subproject are shown here.
              </p>
            </div>
            <Button size="sm" onClick={() => openGoalDialog()}>
              <Target className="mr-1 h-4 w-4" />
              Add goal
            </Button>
          </div>
          {projectGoals.length === 0 ? (
            <EmptyState
              icon={<Target className="h-5 w-5" />}
              title="No goals in this subproject"
              description="Create a goal to define a clear outcome for this phase."
              actionLabel="Create a goal"
              onAction={() => openGoalDialog()}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projectGoals.map((goal) => (
                <article key={goal.id} className="nexora-panel min-w-0 space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to="/goals/$goalId"
                      params={{ goalId: goal.id }}
                      className="break-words font-medium text-foreground hover:text-primary"
                    >
                      {goal.title}
                    </Link>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {goal.status}
                    </Badge>
                  </div>
                  {goal.description && (
                    <p className="break-words text-sm text-muted-foreground">{goal.description}</p>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Goal progress</span>
                      <span>{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {goal.target_date
                      ? `Due ${new Date(`${goal.target_date}T00:00:00`).toLocaleDateString()}`
                      : "No due date"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openGoalDialog(goal)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateGoal.isPending}
                      onClick={() =>
                        updateGoal.mutate(
                          goal.status === "completed"
                            ? { id: goal.id, status: "active", progress: 0 }
                            : { id: goal.id, status: "completed", progress: 100 },
                          {
                            onSuccess: () =>
                              toast.success(
                                goal.status === "completed" ? "Goal reopened" : "Goal completed",
                              ),
                            onError: () => toast.error("Couldn't update that goal"),
                          },
                        )
                      }
                    >
                      {goal.status === "completed" ? "Reopen" : "Mark complete"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={editingGoal}
        projectId={project.id}
        subprojectId={subproject.id}
      />
      <ProjectSubprojectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        projectId={project.id}
        subproject={subproject}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this subproject?"
        description="Its goals will remain linked to the main project and can be organized later."
        confirmLabel="Delete subproject"
        onConfirm={() => {
          deleteSubproject.mutate(
            { id: subproject.id, projectId: project.id },
            {
              onSuccess: () => {
                toast.success("Subproject deleted; its goals were kept");
                void navigate({
                  to: "/projects/$projectId",
                  params: { projectId: project.id },
                  search: { goalId: undefined },
                });
              },
              onError: () => toast.error("Couldn't delete that subproject"),
            },
          );
          setDeleteDialogOpen(false);
        }}
      />
    </AppShell>
  );
}
