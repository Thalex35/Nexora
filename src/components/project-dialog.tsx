import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  useGoals,
  useUpdateProject,
  type Project,
  type ProjectStatus,
} from "@/lib/nexora-data";

const NO_GOAL = "__no_goal__";

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  defaultGoalId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  defaultGoalId?: string | null;
}) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const goals = useGoals();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [progress, setProgress] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [goalId, setGoalId] = useState(NO_GOAL);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? "planning");
    setProgress(String(project?.progress ?? 0));
    setStartDate(project?.start_date ?? "");
    setDeadline(project?.deadline ?? "");
    setGoalId(project?.goal_id ?? defaultGoalId ?? NO_GOAL);
  }, [defaultGoalId, open, project]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = {
      name: name.trim(),
      description: description.trim() || null,
      status,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      start_date: startDate || null,
      deadline: deadline || null,
      goal_id: goalId === NO_GOAL ? null : goalId,
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

  const pending = createProject.isPending || updateProject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
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
          <div className="space-y-2">
            <Label htmlFor="project-goal">Related goal (optional)</Label>
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger id="project-goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GOAL}>No goal</SelectItem>
                {(goals.data ?? [])
                  .filter((goal) => goal.status !== "archived")
                  .map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      {goal.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                <SelectTrigger id="project-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">Paused</SelectItem>
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
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Save project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
