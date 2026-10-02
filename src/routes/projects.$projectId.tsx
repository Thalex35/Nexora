import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { ProjectDialog } from "@/components/project-dialog";
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
  useTasks,
  type Project,
  type TaskPriority,
} from "@/lib/nexora-data";

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
  const createTask = useCreateTask();
  const deleteProject = useDeleteProject();
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const project = (projects.data ?? []).find((item) => item.id === projectId);
  const goal = (goals.data ?? []).find((item) => item.id === project?.goal_id);
  const projectTasks = (tasks.data ?? []).filter((task) => task.project_id === projectId);
  const loading = projects.isLoading || goals.isLoading || tasks.isLoading;

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

  if (loading) {
    return (
      <AppShell>
        <LoadingState rows={3} />
      </AppShell>
    );
  }
  if (projects.isError || goals.isError || tasks.isError) {
    return (
      <AppShell>
        <ErrorState
          onRetry={() => void Promise.all([projects.refetch(), goals.refetch(), tasks.refetch()])}
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
            <div className="flex gap-2">
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
