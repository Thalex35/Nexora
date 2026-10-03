import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Edit3, Pin } from "lucide-react";
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
  useCreateNote,
  useGoals,
  useLearningItems,
  useProjects,
  useTasks,
  useUpdateNote,
  type Note,
  type NoteInput,
} from "@/lib/nexora-data";
import { formatPlanningDate } from "@/lib/planning";

export function NoteDialog({
  open,
  onOpenChange,
  note,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  categories: string[];
}) {
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const goals = useGoals();
  const projects = useProjects();
  const tasks = useTasks();
  const learningItems = useLearningItems();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Personal");
  const [tags, setTags] = useState("");
  const [linkedRecord, setLinkedRecord] = useState("none");

  useEffect(() => {
    if (!open) return;
    setEditing(!note);
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    setCategory(note?.category ?? "Personal");
    setTags(note?.tags.join(", ") ?? "");
    if (note?.goal_id) setLinkedRecord(`goal:${note.goal_id}`);
    else if (note?.project_id) setLinkedRecord(`project:${note.project_id}`);
    else if (note?.task_id) setLinkedRecord(`task:${note.task_id}`);
    else if (note?.learning_item_id) setLinkedRecord(`learning:${note.learning_item_id}`);
    else setLinkedRecord("none");
  }, [note, open]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const [linkType, linkId] = linkedRecord.split(":");
    const values: NoteInput = {
      title: title.trim(),
      content,
      category: category.trim(),
      tags: [
        ...new Set(
          tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
      goal_id: linkType === "goal" ? (linkId ?? null) : null,
      project_id: linkType === "project" ? (linkId ?? null) : null,
      task_id: linkType === "task" ? (linkId ?? null) : null,
      learning_item_id: linkType === "learning" ? (linkId ?? null) : null,
    };

    try {
      if (note) {
        await updateNote.mutateAsync({ id: note.id, ...values });
        toast.success("Note updated");
      } else {
        await createNote.mutateAsync(values);
        toast.success("Note saved");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this note.");
    }
  }

  const linkQueries = [goals, projects, tasks, learningItems];
  const linkQueryError = linkQueries.some((query) => query.isError);
  const linkQueryLoading = linkQueries.some((query) => query.isLoading);
  const pending = createNote.isPending || updateNote.isPending;
  const linkedTitle = note
    ? getLinkedTitle(
        note,
        goals.data ?? [],
        projects.data ?? [],
        tasks.data ?? [],
        learningItems.data ?? [],
      )
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{note ? (editing ? "Edit note" : note.title) : "New note"}</DialogTitle>
          <DialogDescription>
            {note && !editing
              ? `${note.category} · Created ${formatPlanningDate(note.created_at.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })} · Updated ${formatPlanningDate(note.updated_at.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}`
              : "Capture an idea or reference to find again later."}
          </DialogDescription>
        </DialogHeader>
        {editing ? (
          <form onSubmit={(event) => void save(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                required
                maxLength={180}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="note-category">Category</Label>
                <Input
                  id="note-category"
                  required
                  maxLength={80}
                  list="note-category-suggestions"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                />
                <datalist id="note-category-suggestions">
                  {categories.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-tags">Tags</Label>
                <Input
                  id="note-tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="Separate tags with commas"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                rows={12}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-56 resize-y"
                placeholder="Write your note…"
              />
              <p className="text-xs text-muted-foreground">
                Plain text is supported; Markdown syntax is preserved as text.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-linked-record">Link a Nexora record (optional)</Label>
              <Select
                value={linkedRecord}
                onValueChange={setLinkedRecord}
                disabled={linkQueryLoading || linkQueryError}
              >
                <SelectTrigger id="note-linked-record">
                  <SelectValue placeholder="No linked record" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked record</SelectItem>
                  {(goals.data ?? []).map((goal) => (
                    <SelectItem key={goal.id} value={`goal:${goal.id}`}>
                      Goal · {goal.title}
                    </SelectItem>
                  ))}
                  {(projects.data ?? []).map((project) => (
                    <SelectItem key={project.id} value={`project:${project.id}`}>
                      Project · {project.name}
                    </SelectItem>
                  ))}
                  {(tasks.data ?? []).map((task) => (
                    <SelectItem key={task.id} value={`task:${task.id}`}>
                      Task · {task.title}
                    </SelectItem>
                  ))}
                  {(learningItems.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={`learning:${item.id}`}>
                      Learning · {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linkQueryError && (
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
                {pending ? "Saving…" : note ? "Save changes" : "Save note"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {note?.category}
              </span>
              {note?.is_pinned && (
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
              {note?.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="min-h-20 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
              {note?.content || "This note is empty."}
            </p>
            {linkedTitle && note && (
              <p className="text-sm text-muted-foreground">
                Linked to: <NoteRecordLink note={note} title={linkedTitle} />
              </p>
            )}
            <DialogFooter>
              <Button onClick={() => setEditing(true)}>
                <Edit3 className="mr-1 h-4 w-4" /> Edit note
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getLinkedTitle(
  note: Note,
  goals: NonNullable<ReturnType<typeof useGoals>["data"]>,
  projects: NonNullable<ReturnType<typeof useProjects>["data"]>,
  tasks: NonNullable<ReturnType<typeof useTasks>["data"]>,
  learningItems: NonNullable<ReturnType<typeof useLearningItems>["data"]>,
) {
  if (note.goal_id)
    return `Goal · ${goals.find((item) => item.id === note.goal_id)?.title ?? "record"}`;
  if (note.project_id)
    return `Project · ${projects.find((item) => item.id === note.project_id)?.name ?? "record"}`;
  if (note.task_id)
    return `Task · ${tasks.find((item) => item.id === note.task_id)?.title ?? "record"}`;
  if (note.learning_item_id)
    return `Learning · ${learningItems.find((item) => item.id === note.learning_item_id)?.title ?? "record"}`;
  return null;
}

function NoteRecordLink({ note, title }: { note: Note; title: string }) {
  if (note.goal_id) {
    return (
      <Link
        to="/goals/$goalId"
        params={{ goalId: note.goal_id }}
        className="text-primary hover:underline"
      >
        {title}
      </Link>
    );
  }
  if (note.project_id) {
    return (
      <Link
        to="/projects/$projectId"
        params={{ projectId: note.project_id }}
        search={{ goalId: undefined }}
        className="text-primary hover:underline"
      >
        {title}
      </Link>
    );
  }
  if (note.learning_item_id) {
    return (
      <Link
        to="/learning/$learningId"
        params={{ learningId: note.learning_item_id }}
        className="text-primary hover:underline"
      >
        {title}
      </Link>
    );
  }
  return (
    <Link to="/tasks" className="text-primary hover:underline">
      {title}
    </Link>
  );
}
