import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
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
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
  type Project,
  type ProjectStatus,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Nexora" },
      {
        name: "description",
        content:
          "See what you are building in Nexora: project status, progress, start dates and deadlines.",
      },
      { property: "og:title", content: "Projects — Nexora" },
      {
        property: "og:description",
        content: "See what you are building, with status, progress and deadlines.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useProjects();
  const deleteProject = useDeleteProject();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Projects"
          description="The bigger pieces of work you are moving forward."
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              New project
            </Button>
          }
        />

        {projects.isLoading ? (
          <LoadingState />
        ) : projects.isError ? (
          <ErrorState onRetry={() => void projects.refetch()} />
        ) : (projects.data ?? []).length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title="No projects yet"
            description="Create a project to group the work you're moving forward."
            actionLabel="Create a project"
            onAction={() => {
              setEditing(null);
              setOpen(true);
            }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(projects.data ?? []).map((project) => (
              <article key={project.id} className="nexora-panel space-y-4 p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {project.status.replace("_", " ")}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {project.deadline
                      ? `Deadline ${new Date(`${project.deadline}T00:00:00`).toLocaleDateString()}`
                      : "No deadline"}
                  </p>
                  <div className="flex shrink-0 gap-1">
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
                      aria-label="Delete project"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingDelete(project)}
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

      <ProjectDialog open={open} onOpenChange={setOpen} project={editing} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete this project?"
        description="Tasks linked to it stay, but lose the project connection."
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

function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
}) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [progress, setProgress] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const key = project?.id ?? "new";
  if (open && hydratedFor !== key) {
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? "planning");
    setProgress(String(project?.progress ?? 0));
    setStartDate(project?.start_date ?? "");
    setDeadline(project?.deadline ?? "");
    setHydratedFor(key);
  }
  if (!open && hydratedFor !== null) setHydratedFor(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = {
      name,
      description: description || null,
      status,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      start_date: startDate || null,
      deadline: deadline || null,
    };
    try {
      if (project) {
        await updateProject.mutateAsync({ id: project.id, ...values });
        toast.success("Project updated");
      } else {
        await createProject.mutateAsync(values);
        toast.success("Project created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that project. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-progress">Progress (%)</Label>
              <Input
                id="project-progress"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(event) => setProgress(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-start">Start date</Label>
              <Input
                id="project-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-deadline">Deadline</Label>
              <Input
                id="project-deadline"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={createProject.isPending || updateProject.isPending}
            >
              {createProject.isPending || updateProject.isPending ? "Saving…" : "Save project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
