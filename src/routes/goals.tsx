import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Target, Trash2 } from "lucide-react";
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
import {
  useDeleteGoal,
  useAllProjectSubprojects,
  useGoals,
  useProjects,
  useUpdateGoal,
  type Goal,
  type Project,
  type ProjectSubproject,
} from "@/lib/nexora-data";
import {
  filterGoalsByProjectState,
  filterGoalsBySubproject,
  goalProjectId,
} from "@/lib/project-goals";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type GoalFilter =
  | "active"
  | "completed"
  | "paused"
  | "archived"
  | "all"
  | "without-project"
  | "with-project"
  | "in-progress";

function GoalsPage() {
  const goals = useGoals();
  const projects = useProjects();
  const subprojects = useAllProjectSubprojects();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const [filter, setFilter] = useState<GoalFilter>("active");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedSubprojectId, setSelectedSubprojectId] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);
  const statusFiltered = (goals.data ?? []).filter((goal) => {
    if (filter === "all") return true;
    if (filter === "without-project" || filter === "with-project") return true;
    if (filter === "in-progress") return goal.status === "active";
    if (filter === "paused" || filter === "archived" || filter === "completed")
      return goal.status === filter;
    return goal.status === "active";
  });
  const projectFiltered =
    selectedProjectId === "all"
      ? statusFiltered
      : statusFiltered.filter(
          (goal) => goalProjectId(goal, projects.data ?? []) === selectedProjectId,
        );
  const subprojectFiltered =
    selectedSubprojectId === "all"
      ? projectFiltered
      : filterGoalsBySubproject(projectFiltered, selectedSubprojectId);
  const visible =
    filter === "without-project" || filter === "with-project"
      ? filterGoalsByProjectState(subprojectFiltered, projects.data ?? [], filter)
      : subprojectFiltered;
  const projectOptions = [...(projects.data ?? [])].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const subprojectOptions = (subprojects.data ?? [])
    .filter(
      (subproject) => selectedProjectId === "all" || subproject.project_id === selectedProjectId,
    )
    .sort((left, right) => left.title.localeCompare(right.title));
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as GoalFilter)}>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="without-project">Without project</TabsTrigger>
              <TabsTrigger value="with-project">With project</TabsTrigger>
              <TabsTrigger value="in-progress">In progress</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid w-full gap-3 sm:max-w-xl sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Project
              </label>
              <Select
                value={selectedProjectId}
                onValueChange={(value) => {
                  setSelectedProjectId(value);
                  setSelectedSubprojectId("all");
                }}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projectOptions.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Subproject
              </label>
              <Select value={selectedSubprojectId} onValueChange={setSelectedSubprojectId}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="All subprojects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subprojects</SelectItem>
                  {subprojectOptions.map((subproject) => (
                    <SelectItem key={subproject.id} value={subproject.id}>
                      {subproject.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {goals.isLoading || projects.isLoading || subprojects.isLoading ? (
          <LoadingState />
        ) : goals.isError || projects.isError || subprojects.isError ? (
          <ErrorState
            onRetry={() =>
              void Promise.all([goals.refetch(), projects.refetch(), subprojects.refetch()])
            }
          />
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
                    <GoalProjectLink
                      goal={goal}
                      projects={projects.data ?? []}
                      subprojects={subprojects.data ?? []}
                    />
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
                      {filter === "archived" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateGoal.isPending}
                          onClick={() =>
                            updateGoal.mutate(
                              { id: goal.id, status: "active" },
                              {
                                onSuccess: () => toast.success("Goal restored"),
                                onError: () => toast.error("Couldn't restore that goal"),
                              },
                            )
                          }
                        >
                          <ArchiveRestore className="mr-1 h-4 w-4" />
                          Restore
                        </Button>
                      ) : goal.status !== "archived" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateGoal.isPending}
                          onClick={() =>
                            updateGoal.mutate(
                              { id: goal.id, status: "archived" },
                              {
                                onSuccess: () => toast.success("Goal archived"),
                                onError: () => toast.error("Couldn't archive that goal"),
                              },
                            )
                          }
                        >
                          <Archive className="mr-1 h-4 w-4" />
                          Archive
                        </Button>
                      ) : null}
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

function GoalProjectLink({
  goal,
  projects,
  subprojects,
}: {
  goal: Goal;
  projects: Project[];
  subprojects: ProjectSubproject[];
}) {
  const projectId = goalProjectId(goal, projects);
  const project = projects.find((item) => item.id === projectId);
  if (!project) return null;
  const subproject = subprojects.find((item) => item.id === goal.subproject_id);

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        search={{ goalId: undefined }}
        className="max-w-full truncate text-primary hover:underline"
      >
        Project: {project.name}
      </Link>
      {subproject && (
        <>
          <span className="text-muted-foreground">/</span>
          <Link
            to="/subprojects/$subprojectId"
            params={{ subprojectId: subproject.id }}
            className="max-w-full truncate text-primary hover:underline"
          >
            {subproject.title}
          </Link>
        </>
      )}
    </div>
  );
}
