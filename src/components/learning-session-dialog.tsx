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
import { Textarea } from "@/components/ui/textarea";
import { todayISO, useCreateLearningSession, type LearningItem } from "@/lib/nexora-data";

export function LearningSessionDialog({
  open,
  item,
  onOpenChange,
}: {
  open: boolean;
  item: LearningItem;
  onOpenChange: (open: boolean) => void;
}) {
  const createSession = useCreateLearningSession();
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [duration, setDuration] = useState("30");
  const [studied, setStudied] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setSessionDate(todayISO());
    setDuration("30");
    setStudied("");
    setNotes("");
  }, [open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const durationMinutes = Number(duration);
    if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1) {
      toast.error("Enter a session duration of at least one minute");
      return;
    }

    try {
      await createSession.mutateAsync({
        learning_item_id: item.id,
        learning_item_title: item.title,
        session_date: sessionDate,
        duration_minutes: durationMinutes,
        studied: studied.trim(),
        notes: notes.trim() || null,
      });
      toast.success("Learning session recorded");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record this session");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a learning session</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="truncate text-sm text-muted-foreground">{item.title}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="learning-session-date">Date</Label>
              <Input
                id="learning-session-date"
                type="date"
                required
                value={sessionDate}
                onChange={(event) => setSessionDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="learning-session-duration">Duration (minutes)</Label>
              <Input
                id="learning-session-duration"
                type="number"
                min="1"
                step="1"
                required
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="learning-session-studied">What did you study?</Label>
            <Textarea
              id="learning-session-studied"
              rows={3}
              required
              maxLength={2000}
              value={studied}
              onChange={(event) => setStudied(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="learning-session-notes">Notes (optional)</Label>
            <Textarea
              id="learning-session-notes"
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={createSession.isPending || !studied.trim()}
            >
              {createSession.isPending ? "Saving…" : "Save session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
