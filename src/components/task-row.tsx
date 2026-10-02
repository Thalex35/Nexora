import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDeleteTask, useUpdateTask, type Task, type TaskPriority } from "@/lib/nexora-data";

const priorityStyles: Record<TaskPriority, string> = {
  low: "border-border text-muted-foreground",
  medium: "border-primary/40 text-primary",
  high: "border-warning/50 text-warning",
};

export function TaskRow({
  task,
  onEdit,
  showDelete = false,
}: {
  task: Task;
  onEdit?: (task: Task) => void;
  showDelete?: boolean;
}) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const done = task.status === "done";

  return (
    <div className="nexora-panel flex items-center gap-3 p-3.5">
      <Checkbox
        checked={done}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        disabled={updateTask.isPending}
        onCheckedChange={(checked) =>
          updateTask.mutate(
            { id: task.id, status: checked ? "done" : "todo" },
            { onError: () => toast.error("Couldn't update that task") },
          )
        }
      />
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onEdit?.(task)}
        disabled={!onEdit}
      >
        <p
          className={cn(
            "truncate text-sm font-medium text-foreground",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {task.due_date
            ? `Due ${new Date(`${task.due_date}T00:00:00`).toLocaleDateString()}`
            : "No due date"}
          {" · "}
          {task.status === "done"
            ? "Completed"
            : task.status === "in_progress"
              ? "In progress"
              : "To do"}
        </p>
      </button>
      <Badge variant="outline" className={cn("shrink-0 capitalize", priorityStyles[task.priority])}>
        {task.priority}
      </Badge>
      {showDelete && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete task"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => {
            deleteTask.mutate(task.id, {
              onError: () => toast.error("Couldn't delete that task"),
              onSuccess: () => toast.success("Task deleted"),
            });
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
