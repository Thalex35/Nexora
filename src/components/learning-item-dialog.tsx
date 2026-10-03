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
  useCreateLearningItem,
  useGoals,
  useProjects,
  useTasks,
  useUpdateLearningItem,
  type LearningItem,
  type LearningStatus,
} from "@/lib/nexora-data";
import { learningStateFromProgress, learningStateFromStatus } from "@/lib/learning";

const NO_LINK = "none";

export function LearningItemDialog({
  open,
  item,
  onOpenChange,
}: {
  open: boolean;
  item: LearningItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const createItem = useCreateLearningItem();
  const updateItem = useUpdateLearningItem();
  const goals = useGoals();
  const projects = useProjects();
  const tasks = useTasks();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<LearningStatus>("not_started");
  const [progress, setProgress] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [goalId, setGoalId] = useState(NO_LINK);
  const [projectId, setProjectId] = useState(NO_LINK);
  const [taskId, setTaskId] = useState(NO_LINK);
  const pending = createItem.isPending || updateItem.isPending;

  function changeStatus(nextStatus: LearningStatus) {
    const state = learningStateFromStatus(nextStatus, Number(progress) || 0);
    setStatus(state.status);
    setProgress(String(state.progress));
  }

  function changeProgress(value: string) {
    setProgress(value);
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      const state = learningStateFromProgress(numericValue);
      setStatus(state.status);
      setProgress(String(state.progress));
    }
  }

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setCategory(item?.category ?? "");
    setStatus(item?.status ?? "not_started");
    setProgress(String(item?.progress ?? 0));
    setTargetDate(item?.target_date ?? "");
    setGoalId(item?.goal_id ?? NO_LINK);
    setProjectId(item?.project_id ?? NO_LINK);
    setTaskId(item?.task_id ?? NO_LINK);
  }, [item, open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = {
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      status,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
      target_date: targetDate || null,
      goal_id: goalId === NO_LINK ? null : goalId,
      project_id: projectId === NO_LINK ? null : projectId,
      task_id: taskId === NO_LINK ? null : taskId,
    };

    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, ...values });
        toast.success("Learning item updated");
      } else {
        await createItem.mutateAsync(values);
        toast.success("Learning item created");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this learning item");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit learning item" : "New learning item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="learning-title">Title</Label>
            <Input
              id="learning-title"
              required
              maxLength={180}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="learning-description">Description or notes</Label>
            <Textarea
              id="learning-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="learning-category">Category or topic</Label>
              <Input
                id="learning-category"
                maxLength={100}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Programming, Languages…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="learning-target">Target date (optional)</Label>
              <Input
                id="learning-target"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="learning-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => changeStatus(value as LearningStatus)}
              >
                <SelectTrigger id="learning-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="learning-progress">Progress (%)</Label>
              <Input
                id="learning-progress"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(event) => changeProgress(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <LearningLinkSelect
              id="learning-goal"
              label="Goal"
              value={goalId}
              onValueChange={setGoalId}
              loading={goals.isLoading}
              error={goals.isError}
              options={(goals.data ?? []).map((goal) => ({ id: goal.id, label: goal.title }))}
            />
            <LearningLinkSelect
              id="learning-project"
              label="Project"
              value={projectId}
              onValueChange={setProjectId}
              loading={projects.isLoading}
              error={projects.isError}
              options={(projects.data ?? []).map((project) => ({
                id: project.id,
                label: project.name,
              }))}
            />
            <LearningLinkSelect
              id="learning-task"
              label="Task"
              value={taskId}
              onValueChange={setTaskId}
              loading={tasks.isLoading}
              error={tasks.isError}
              options={(tasks.data ?? []).map((task) => ({ id: task.id, label: task.title }))}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending || !title.trim()}>
              {pending ? "Saving…" : item ? "Save changes" : "Create learning item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LearningLinkSelect({
  id,
  label,
  value,
  onValueChange,
  loading,
  error,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  loading: boolean;
  error: boolean;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label} (optional)</Label>
      <Select value={value} onValueChange={onValueChange} disabled={loading || error}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={`No ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_LINK}>No {label.toLowerCase()}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          Couldn't load {label.toLowerCase()}s.
        </p>
      )}
    </div>
  );
}
