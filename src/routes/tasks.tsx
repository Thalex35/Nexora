import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TaskRow } from "@/components/task-row";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTask,
  useTasks,
  useUpdateTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Nexora" },
      {
        name: "description",
        content:
          "Create, edit and complete your tasks in Nexora with clear priorities and due dates.",
      },
      { property: "og:title", content: "Tasks — Nexora" },
      {
        property: "og:description",
        content: "Capture what needs doing and keep priorities and due dates clear.",
      },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  const tasks = useTasks();
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);

  const visible = (tasks.data ?? []).filter((task) =>
    filter === "all" ? true : filter === "done" ? task.status === "done" : task.status !== "done",
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Tasks"
          description="Everything you need to do, in one place."
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              New task
            </Button>
          }
        />

        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Completed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {tasks.isLoading ? (
          <LoadingState />
        ) : tasks.isError ? (
          <ErrorState onRetry={() => void tasks.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<CheckSquare className="h-5 w-5" />}
            title="No tasks yet"
            description="Add your first task to start shaping your day."
            actionLabel="Create a task"
            onAction={() => {
              setEditing(null);
              setOpen(true);
            }}
          />
        ) : (
          <div className="space-y-2">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                showDelete
                onEdit={(selected) => {
                  setEditing(selected);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <TaskDialog open={open} onOpenChange={setOpen} task={editing} />
    </AppShell>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
}) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const key = task?.id ?? "new";
  if (open && hydratedFor !== key) {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "medium");
    setStatus(task?.status ?? "todo");
    setDueDate(task?.due_date ?? "");
    setHydratedFor(key);
  }
  if (!open && hydratedFor !== null) setHydratedFor(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = {
      title,
      description: description || null,
      priority,
      status,
      due_date: dueDate || null,
    };
    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...values });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync(values);
        toast.success("Task created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that task. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger>
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
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={createTask.isPending || updateTask.isPending}
            >
              {createTask.isPending || updateTask.isPending ? "Saving…" : "Save task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
