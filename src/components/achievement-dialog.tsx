import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  todayISO,
  useCreateAchievement,
  useGoals,
  useLearningItems,
  useProjects,
  useTasks,
  useUpdateAchievement,
  type Achievement,
  type AchievementInput,
} from "@/lib/nexora-data";

const suggestedCategories = [
  "Personal",
  "Education",
  "Programming",
  "Business",
  "Finance",
  "Health",
];

export function AchievementDialog({
  open,
  onOpenChange,
  achievement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievement: Achievement | null;
}) {
  const createAchievement = useCreateAchievement();
  const updateAchievement = useUpdateAchievement();
  const goals = useGoals();
  const projects = useProjects();
  const learningItems = useLearningItems();
  const tasks = useTasks();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Personal");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [linkedRecord, setLinkedRecord] = useState("none");

  useEffect(() => {
    if (!open) return;
    setTitle(achievement?.title ?? "");
    setDescription(achievement?.description ?? "");
    setCategory(achievement?.category ?? "Personal");
    setDate(achievement?.achievement_date ?? todayISO());
    setNotes(achievement?.notes ?? "");
    if (achievement?.goal_id) setLinkedRecord(`goal:${achievement.goal_id}`);
    else if (achievement?.project_id) setLinkedRecord(`project:${achievement.project_id}`);
    else if (achievement?.learning_item_id)
      setLinkedRecord(`learning:${achievement.learning_item_id}`);
    else if (achievement?.task_id) setLinkedRecord(`task:${achievement.task_id}`);
    else setLinkedRecord("none");
  }, [achievement, open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const [linkType, linkId] = linkedRecord.split(":");
    const values: AchievementInput = {
      title: title.trim(),
      description: description.trim() || null,
      category: category.trim(),
      achievement_date: date,
      notes: notes.trim() || null,
      goal_id: linkType === "goal" ? (linkId ?? null) : null,
      project_id: linkType === "project" ? (linkId ?? null) : null,
      learning_item_id: linkType === "learning" ? (linkId ?? null) : null,
      task_id: linkType === "task" ? (linkId ?? null) : null,
    };

    try {
      if (achievement) {
        await updateAchievement.mutateAsync({ id: achievement.id, ...values });
        toast.success("Achievement updated");
      } else {
        await createAchievement.mutateAsync(values);
        toast.success("Achievement saved");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this achievement.");
    }
  }

  const pending = createAchievement.isPending || updateAchievement.isPending;
  const linkQueries = [goals, projects, learningItems, tasks];
  const linkQueryFailed = linkQueries.some((query) => query.isError);
  const linkQueryLoading = linkQueries.some((query) => query.isLoading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{achievement ? "Edit achievement" : "Record an achievement"}</DialogTitle>
          <DialogDescription>Save a meaningful milestone, not an everyday task.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="achievement-title">Title</Label>
            <Input
              id="achievement-title"
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What did you accomplish?"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="achievement-category">Category</Label>
              <Input
                id="achievement-category"
                required
                maxLength={60}
                list="achievement-category-suggestions"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Personal"
              />
              <datalist id="achievement-category-suggestions">
                {suggestedCategories.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="achievement-date">Achievement date</Label>
              <Input
                id="achievement-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="achievement-description">Description</Label>
            <Textarea
              id="achievement-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add context you will want to remember."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="achievement-notes">Notes (optional)</Label>
            <Textarea
              id="achievement-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="achievement-linked-record">Link a Nexora record (optional)</Label>
            <Select
              value={linkedRecord}
              onValueChange={setLinkedRecord}
              disabled={linkQueryLoading || linkQueryFailed}
            >
              <SelectTrigger id="achievement-linked-record">
                <SelectValue placeholder="No linked record" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked record</SelectItem>
                {(goals.data ?? []).length > 0 && (
                  <>
                    {(goals.data ?? []).map((goal) => (
                      <SelectItem key={goal.id} value={`goal:${goal.id}`}>
                        Goal · {goal.title}
                      </SelectItem>
                    ))}
                  </>
                )}
                {(projects.data ?? []).map((project) => (
                  <SelectItem key={project.id} value={`project:${project.id}`}>
                    Project · {project.name}
                  </SelectItem>
                ))}
                {(learningItems.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={`learning:${item.id}`}>
                    Learning · {item.title}
                  </SelectItem>
                ))}
                {(tasks.data ?? []).map((task) => (
                  <SelectItem key={task.id} value={`task:${task.id}`}>
                    Task · {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {linkQueryFailed && (
              <p className="text-sm text-destructive" role="alert">
                Existing records could not be loaded, so linking is unavailable.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={pending || !title.trim() || !category.trim()}
            >
              {pending ? "Saving…" : achievement ? "Save changes" : "Save achievement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
