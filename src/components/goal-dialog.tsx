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
import { useCreateGoal, useUpdateGoal, type Goal, type GoalStatus } from "@/lib/nexora-data";

export function GoalDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
}) {
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [targetDate, setTargetDate] = useState("");
  const [progress, setProgress] = useState("0");

  useEffect(() => {
    if (!open) return;
    setTitle(goal?.title ?? "");
    setDescription(goal?.description ?? "");
    setStatus(goal?.status ?? "active");
    setTargetDate(goal?.target_date ?? "");
    setProgress(String(goal?.progress ?? 0));
  }, [goal, open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      target_date: targetDate || null,
      progress: Math.min(100, Math.max(0, Number(progress) || 0)),
    };
    try {
      if (goal) {
        await updateGoal.mutateAsync({ id: goal.id, ...values });
        toast.success("Goal updated");
      } else {
        await createGoal.mutateAsync(values);
        toast.success("Goal created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that goal. Please try again.");
    }
  }

  const pending = createGoal.isPending || updateGoal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-description">Description</Label>
            <Textarea
              id="goal-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="goal-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as GoalStatus)}>
                <SelectTrigger id="goal-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-progress">Progress (%)</Label>
              <Input
                id="goal-progress"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(event) => setProgress(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-target">Target date</Label>
            <Input
              id="goal-target"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Save goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
