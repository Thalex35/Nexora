import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, FolderKanban, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { ProjectDialog } from "@/components/project-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeleteProject,
  useGoals,
  useProjects,
  useUpdateProject,
  type Project,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/projects")({
  validateSearch: (search: Record<string, unknown>) => ({
    goalId: typeof search["goalId"] === "string" ? search["goalId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Projects — Nexora" },
      {
        name: "description",
        content: "Organize focused bodies of work and see the tasks that move them forward.",
      },
      { property: "og:title", content: "Projects — Nexora" },
      {
        property: "og:description",
        content: "Organize projects with clear progress, dates and related goals.",
      },
    ],
  }),
  component: ProjectsPage,
});

type ProjectFilter = "active" | "completed" | "paused" | "archived" | "all";

function ProjectsPage() {
  const search = Route.useSearch();
  const projects = useProjects();
  const goals = useGoals();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [filter, setFilter] = useState<ProjectFilter>("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const visible = (projects.data ?? []).filter((project) => {
    if (filter === "all") return true;
    if (filter === "paused") return project.status === "on_hold";
    if (filter === "active") return project.status === "active" || project.status === "planning";
    return project.status === filter;
  });
  const goalNames = new Map((goals.data ?? []).map((goal) => [goal.id, goal.title]));

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Projects"
          description="Focused bodies of work, supported by tasks."
          actions={
            <Button size="sm" onClick={openCreate}>
              New project
            </Button>
          }
        />

        <Tabs value={filter} onValueChange={(value) => setFilter(value as ProjectFilter)}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {projects.isLoading || goals.isLoading ? (
          <LoadingState />
        ) : projects.isError || goals.isError ? (
          <ErrorState onRetry={() => void Promise.all([projects.refetch(), goals.refetch()])} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title={filter === "active" ? "No active projects" : `No ${filter} projects`}
            description={
              filter === "active"
                ? "Create a project to group related tasks into a focused piece of work."
                : "Projects in this view will appear here."
            }
            actionLabel="Create a project"
            onAction={openCreate}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((project) => (
              <article key={project.id} className="nexora-panel min-w-0 space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                      search={search}
                      className="break-words font-semibold text-foreground hover:text-primary"
                    >
                      {project.name}
                    </Link>
                    {project.description && (
                      <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                    {project.goal_id && goalNames.has(project.goal_id) && (
                      <Link
                        to="/goals/$goalId"
                        params={{ goalId: project.goal_id }}
                        className="mt-2 inline-block max-w-full truncate text-xs text-primary hover:underline"
                      >
                        Goal: {goalNames.get(project.goal_id)}
                      </Link>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {project.status === "on_hold" ? "paused" : project.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} aria-label={`${project.progress}% complete`} />
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-muted-foreground">
                      {project.deadline
                        ? `Deadline ${new Date(`${project.deadline}T00:00:00`).toLocaleDateString()}`
                        : "No deadline"}
                    </span>
                    <div className="flex shrink-0 items-center">
                      {filter === "archived" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateProject.isPending}
                          onClick={() =>
                            updateProject.mutate(
                              { id: project.id, status: "active" },
                              {
                                onSuccess: () => toast.success("Project restored"),
                                onError: () => toast.error("Couldn't restore that project"),
                              },
                            )
                          }
                        >
                          <ArchiveRestore className="mr-1 h-4 w-4" />
                          Restore
                        </Button>
                      ) : project.status !== "archived" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateProject.isPending}
                          onClick={() =>
                            updateProject.mutate(
                              { id: project.id, status: "archived" },
                              {
                                onSuccess: () => toast.success("Project archived"),
                                onError: () => toast.error("Couldn't archive that project"),
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
                          setEditing(project);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${project.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete(project)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <ProjectDialog
        open={open}
        onOpenChange={setOpen}
        project={editing}
        defaultGoalId={editing ? editing.goal_id : (search.goalId ?? null)}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete this project?"
        description="Its tasks stay in Nexora and become unlinked from the project."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteProject.mutate(pendingDelete.id, {
            onSuccess: () => toast.success("Project deleted"),
            onError: () => toast.error("Couldn't delete that project"),
          });
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
