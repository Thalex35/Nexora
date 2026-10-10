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
  useCreateProjectSubproject,
  useUpdateProjectSubproject,
  type ProjectStatus,
  type ProjectSubproject,
  type TaskPriority,
} from "@/lib/nexora-data";

export function ProjectSubprojectDialog({
  open,
  onOpenChange,
  projectId,
  subproject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  subproject: ProjectSubproject | null;
}) {
  const createSubproject = useCreateProjectSubproject();
  const updateSubproject = useUpdateProjectSubproject();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(subproject?.title ?? "");
    setDescription(subproject?.description ?? "");
    setObjective(subproject?.objective ?? "");
    setStartDate(subproject?.start_date ?? "");
    setDeadline(subproject?.deadline ?? "");
    setStatus(subproject?.status ?? "planning");
    setPriority(subproject?.priority ?? "medium");
    setNotes(subproject?.notes ?? "");
  }, [open, subproject]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const values = {
      project_id: projectId,
      title: title.trim(),
      description: description.trim() || null,
      objective: objective.trim() || null,
      start_date: startDate || null,
      deadline: deadline || null,
      status,
      priority,
      notes: notes.trim() || null,
    };
    try {
      if (subproject) {
        await updateSubproject.mutateAsync({ id: subproject.id, ...values });
        toast.success("Subproject updated");
      } else {
        await createSubproject.mutateAsync(values);
        toast.success("Subproject created");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save this subproject. Please try again.");
    }
  }

  const pending = createSubproject.isPending || updateSubproject.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subproject ? "Edit subproject" : "New subproject"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subproject-title">Name</Label>
            <Input
              id="subproject-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subproject-description">Description</Label>
            <Textarea
              id="subproject-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subproject-objective">Objective / expected outcome</Label>
            <Textarea
              id="subproject-objective"
              rows={2}
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subproject-status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                <SelectTrigger id="subproject-status">
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
              <Label htmlFor="subproject-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
              >
                <SelectTrigger id="subproject-priority">
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
              <Label htmlFor="subproject-start">Start date</Label>
              <Input
                id="subproject-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subproject-deadline">Deadline</Label>
              <Input
                id="subproject-deadline"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subproject-notes">Notes</Label>
            <Textarea
              id="subproject-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Save subproject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
