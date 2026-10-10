import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FolderKanban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GoalDialog } from "@/components/goal-dialog";
import { PageHeader } from "@/components/page-header";
import { ProjectBudgetSection } from "@/components/project-budget-section";
import { ProjectDialog } from "@/components/project-dialog";
import { ProjectSubprojectDialog } from "@/components/project-subproject-dialog";
import { TaskRow } from "@/components/task-row";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  useCreateTask,
  useDeleteProject,
  useGoals,
  useProjects,
  useProjectBudget,
  useProjectBudgetItems,
  useProjectSubprojects,
  useTasks,
  useDeleteProjectSubproject,
  type Goal,
  type Project,
  type ProjectSubproject,
  type TaskPriority,
} from "@/lib/nexora-data";
import { downloadProjectReport } from "@/lib/project-pdf";
import { calculateProjectGoalProgress, sortGoalsChronologically } from "@/lib/project-goals";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project — Nexora" },
      { name: "description", content: "Review project progress, dates and tasks." },
    ],
  }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const projects = useProjects();
  const goals = useGoals();
  const tasks = useTasks();
  const projectBudget = useProjectBudget(projectId);
  const budgetItems = useProjectBudgetItems(projectBudget.data?.id);
  const subprojects = useProjectSubprojects(projectId);
  const createTask = useCreateTask();
  const deleteProject = useDeleteProject();
  const deleteSubproject = useDeleteProjectSubproject();
  const [editing, setEditing] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [subprojectDialogOpen, setSubprojectDialogOpen] = useState(false);
  const [editingSubproject, setEditingSubproject] = useState<ProjectSubproject | null>(null);
  const [pendingSubprojectDelete, setPendingSubprojectDelete] = useState<ProjectSubproject | null>(
    null,
  );
  const [taskTitle, setTaskTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const project = (projects.data ?? []).find((item) => item.id === projectId);
  const goal = (goals.data ?? []).find((item) => item.id === project?.goal_id);
  const projectGoals = sortGoalsChronologically(
    (goals.data ?? []).filter(
      (item) => item.project_id === projectId || item.id === project?.goal_id,
    ),
  );
  const projectTasks = (tasks.data ?? []).filter((task) => task.project_id === projectId);
  const projectSubprojects = subprojects.data ?? [];
  const unassignedGoals = sortGoalsChronologically(
    (goals.data ?? []).filter(
      (item) =>
        (item.project_id === projectId || item.id === project?.goal_id) && !item.subproject_id,
    ),
  );
  const loading =
    projects.isLoading ||
    goals.isLoading ||
    tasks.isLoading ||
    subprojects.isLoading ||
    projectBudget.isLoading ||
    (Boolean(projectBudget.data) && budgetItems.isLoading);

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createTask.mutateAsync({
        title: taskTitle.trim(),
        priority,
        due_date: dueDate || null,
        project_id: projectId,
      });
      setTaskTitle("");
      setDueDate("");
      setPriority("medium");
      toast.success("Task added to project");
    } catch {
      toast.error("Couldn't add that task. Please try again.");
    }
  }

  function openGoalDialog(goalToEdit: Goal | null = null) {
    setEditingGoal(goalToEdit);
    setGoalDialogOpen(true);
  }

  function handleDownloadPdf() {
    if (!project) return;
    downloadProjectReport(
      project,
      projectGoals,
      projectBudget.data
        ? { budget: projectBudget.data, items: budgetItems.data ?? [] }
        : undefined,
      projectSubprojects.map((subproject) => ({
        subproject,
        goals: sortGoalsChronologically(
          (goals.data ?? []).filter((item) => item.subproject_id === subproject.id),
        ),
      })),
    );
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingState rows={3} />
      </AppShell>
    );
  }
  if (
    projects.isError ||
    goals.isError ||
    tasks.isError ||
    subprojects.isError ||
    projectBudget.isError ||
    budgetItems.isError
  ) {
    return (
      <AppShell>
        <ErrorState
          onRetry={() =>
            void Promise.all([
              projects.refetch(),
              goals.refetch(),
              tasks.refetch(),
              subprojects.refetch(),
              projectBudget.refetch(),
              budgetItems.refetch(),
            ])
          }
        />
      </AppShell>
    );
  }
  if (!project) {
    return (
      <AppShell>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">This project could not be found.</p>
          <Button variant="outline" asChild>
            <Link to="/projects" search={{ goalId: undefined }}>
              Back to projects
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={project.name}
          description={project.description || "A focused body of work, supported by tasks."}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects" search={{ goalId: undefined }}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Projects
              </Link>
            </Button>
          }
        />

        <section className="nexora-panel space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {project.status === "on_hold" ? "paused" : project.status}
              </Badge>
              {goal && (
                <Link
                  to="/goals/$goalId"
                  params={{ goalId: goal.id }}
                  className="text-sm text-primary hover:underline"
                >
                  Goal: {goal.title}
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit project
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete project"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setPendingDelete(project)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} aria-label={`${project.progress}% complete`} />
          </div>
          <dl className="grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Start date</dt>
              <dd className="mt-1 text-foreground">
                {project.start_date
                  ? new Date(`${project.start_date}T00:00:00`).toLocaleDateString()
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Deadline</dt>
              <dd className="mt-1 text-foreground">
                {project.deadline
                  ? new Date(`${project.deadline}T00:00:00`).toLocaleDateString()
                  : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-1 text-foreground">
                {new Date(project.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </section>

        <ProjectBudgetSection
          projectId={project.id}
          budget={projectBudget.data ?? null}
          items={budgetItems.data ?? []}
          loading={
            projectBudget.isLoading || (Boolean(projectBudget.data) && budgetItems.isLoading)
          }
        />

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Subprojects</h2>
              <p className="text-sm text-muted-foreground">
                {projectSubprojects.length}{" "}
                {projectSubprojects.length === 1 ? "subproject" : "subprojects"} · progress is based
                on goals assigned to subprojects.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingSubproject(null);
                setSubprojectDialogOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add subproject
            </Button>
          </div>
          {projectSubprojects.length === 0 ? (
            <div className="nexora-panel flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-primary/10 p-2 text-primary">
                  <FolderKanban className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-foreground">No subprojects yet</p>
                  <p className="text-sm text-muted-foreground">
                    Break this project into phases and give each phase its own goals.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingSubproject(null);
                  setSubprojectDialogOpen(true);
                }}
              >
                Create your first subproject
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projectSubprojects.map((subproject, index) => {
                const subprojectGoals = sortGoalsChronologically(
                  (goals.data ?? []).filter((item) => item.subproject_id === subproject.id),
                );
                const { progress } = calculateProjectGoalProgress(subprojectGoals);
                return (
                  <article
                    key={subproject.id}
                    className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <Link
                            to="/subprojects/$subprojectId"
                            params={{ subprojectId: subproject.id }}
                            className="break-words font-semibold text-foreground hover:text-primary"
                          >
                            {subproject.title}
                          </Link>
                          {subproject.description && (
                            <p className="mt-1 break-words text-sm text-muted-foreground">
                              {subproject.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 capitalize">
                        {subproject.status === "on_hold" ? "paused" : subproject.status}
                      </Badge>
                    </div>
                    {subproject.objective && (
                      <p className="break-words text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Objective: </span>
                        {subproject.objective}
                      </p>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {subprojectGoals.length} {subprojectGoals.length === 1 ? "goal" : "goals"}
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} aria-label={`${progress}% complete`} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">
                        {subproject.deadline
                          ? `Due ${new Date(`${subproject.deadline}T00:00:00`).toLocaleDateString()}`
                          : "No deadline"}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingSubproject(subproject);
                            setSubprojectDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${subproject.title}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingSubprojectDelete(subproject)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {unassignedGoals.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Goals to organize</h2>
              <p className="text-sm text-muted-foreground">
                These existing goals remain linked to the project. Edit one to assign it to a
                subproject; none were moved automatically.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {unassignedGoals.map((legacyGoal) => (
                <article
                  key={legacyGoal.id}
                  className="nexora-panel flex min-w-0 items-start justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      to="/goals/$goalId"
                      params={{ goalId: legacyGoal.id }}
                      className="break-words font-medium text-foreground hover:text-primary"
                    >
                      {legacyGoal.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {legacyGoal.target_date
                        ? `Due ${new Date(`${legacyGoal.target_date}T00:00:00`).toLocaleDateString()}`
                        : "No due date"}{" "}
                      · {legacyGoal.status}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openGoalDialog(legacyGoal)}>
                    Organize
                  </Button>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Project tasks</h2>
              <p className="text-sm text-muted-foreground">
                {projectTasks.length} {projectTasks.length === 1 ? "task" : "tasks"}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tasks">Manage all tasks</Link>
            </Button>
          </div>

          <form
            onSubmit={addTask}
            className="nexora-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end"
          >
            <div className="space-y-2">
              <Label htmlFor="project-task-title">Add a task</Label>
              <Input
                id="project-task-title"
                required
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="What needs doing?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-task-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
              >
                <SelectTrigger id="project-task-priority" className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-task-date">Due date</Label>
              <Input
                id="project-task-date"
                type="date"
                className="w-full sm:w-40"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={createTask.isPending}>
              <Plus className="mr-1 h-4 w-4" />
              {createTask.isPending ? "Adding…" : "Add task"}
            </Button>
          </form>

          {projectTasks.length === 0 ? (
            <p className="nexora-panel p-5 text-sm text-muted-foreground">
              No tasks belong to this project yet. Add one above, or use the Tasks page for more
              details.
            </p>
          ) : (
            <div className="space-y-2">
              {projectTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>
      </div>

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={editingGoal}
        projectId={projectId}
        subprojects={projectSubprojects}
      />
      <ProjectSubprojectDialog
        open={subprojectDialogOpen}
        onOpenChange={setSubprojectDialogOpen}
        projectId={projectId}
        subproject={editingSubproject}
      />
      <ConfirmDialog
        open={pendingSubprojectDelete !== null}
        onOpenChange={(next) => !next && setPendingSubprojectDelete(null)}
        title="Delete this subproject?"
        description="Its goals stay linked to the main project and return to Goals to organize."
        confirmLabel="Delete subproject"
        onConfirm={() => {
          if (!pendingSubprojectDelete) return;
          deleteSubproject.mutate(
            { id: pendingSubprojectDelete.id, projectId },
            {
              onSuccess: () => toast.success("Subproject deleted; its goals were kept"),
              onError: () => toast.error("Couldn't delete that subproject"),
            },
          );
          setPendingSubprojectDelete(null);
        }}
      />
      <ProjectDialog open={editing} onOpenChange={setEditing} project={project} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete this project?"
        description="Its tasks stay in Nexora and become unlinked from the project."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteProject.mutate(pendingDelete.id, {
            onSuccess: () => {
              toast.success("Project deleted");
              window.location.assign("/projects");
            },
            onError: () => toast.error("Couldn't delete that project"),
          });
          setPendingDelete(null);
        }}
      />
    </AppShell>
  );
}
