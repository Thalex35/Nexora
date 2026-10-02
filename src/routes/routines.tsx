import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { RoutineChecklist } from "@/components/routine-checklist";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  dateOffsetISO,
  todayISO,
  useCreateRoutine,
  useDeleteRoutine,
  useRoutineCompletions,
  useRoutines,
  useUpdateRoutine,
  type Routine,
  type RoutineInput,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/routines")({
  head: () => ({
    meta: [
      { title: "Routines — Nexora" },
      {
        name: "description",
        content: "Build steady habits and keep a history of what you complete each day.",
      },
    ],
  }),
  component: RoutinesPage,
});

type RoutineFilter = "active" | "inactive" | "all";

function RoutinesPage() {
  const today = todayISO();
  const historyStart = dateOffsetISO(-6);
  const routines = useRoutines();
  const completions = useRoutineCompletions(historyStart, today);
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const [filter, setFilter] = useState<RoutineFilter>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Routine | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const selectedDay = useRoutineCompletions(selectedDate, selectedDate);
  const allRoutines = routines.data ?? [];
  const activeRoutines = allRoutines.filter((routine) => routine.is_active);
  const visibleRoutines = allRoutines.filter((routine) =>
    filter === "all" ? true : routine.is_active === (filter === "active"),
  );
  const dates = Array.from({ length: 7 }, (_, index) => dateOffsetISO(index - 6));
  const completionKeys = new Set(
    (completions.data ?? []).map(
      (completion) => `${completion.routine_id}:${completion.completion_date}`,
    ),
  );

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteRoutine.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success("Routine deleted");
        setPendingDelete(null);
      },
      onError: () => toast.error("Couldn't delete this routine"),
    });
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Routines"
          description="Build a rhythm, one day at a time. Your check-ins stay attached to their dates."
          actions={
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              New routine
            </Button>
          }
        />

        <section className="nexora-panel space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {selectedDate === today ? "Today" : formatRoutineDate(selectedDate)}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check-ins are saved for the selected date and remain in your history.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="routine-checklist-date">Checklist date</Label>
              <Input
                id="routine-checklist-date"
                type="date"
                max={today}
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value || today)}
              />
            </div>
          </div>
          {routines.isLoading || selectedDay.isLoading ? (
            <LoadingState rows={3} />
          ) : routines.isError || selectedDay.isError ? (
            <ErrorState
              onRetry={() => void Promise.all([routines.refetch(), selectedDay.refetch()])}
            />
          ) : activeRoutines.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-5 w-5" />}
              title="No active routines"
              description="Create a routine to build a steady daily practice."
              actionLabel="Create a routine"
              onAction={openCreate}
            />
          ) : (
            <RoutineChecklist
              routines={activeRoutines}
              completions={selectedDay.data ?? []}
              completionDate={selectedDate}
            />
          )}
        </section>

        <section className="nexora-panel space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Manage routines</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Deactivating a routine preserves its completion history.
              </p>
            </div>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as RoutineFilter)}>
              <TabsList className="h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {routines.isLoading ? (
            <LoadingState rows={2} />
          ) : routines.isError ? (
            <ErrorState onRetry={() => void routines.refetch()} />
          ) : visibleRoutines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              {filter === "active"
                ? "No active routines."
                : filter === "inactive"
                  ? "No inactive routines."
                  : "No routines created yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleRoutines.map((routine) => (
                <li
                  key={routine.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-medium text-foreground">
                        {routine.name}
                      </span>
                      <Badge variant="outline" className="capitalize">
                        {routine.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {routine.description && (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {routine.description}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updateRoutine.isPending}
                      onClick={() =>
                        updateRoutine.mutate(
                          { id: routine.id, is_active: !routine.is_active },
                          {
                            onSuccess: () =>
                              toast.success(
                                routine.is_active ? "Routine deactivated" : "Routine activated",
                              ),
                            onError: () => toast.error("Couldn't update this routine"),
                          },
                        )
                      }
                    >
                      <Power className="mr-1 h-4 w-4" />
                      {routine.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${routine.name}`}
                      onClick={() => {
                        setEditing(routine);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${routine.name}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingDelete(routine)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="nexora-panel space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Routine history</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Daily check-ins are separate records; changing a routine never changes past dates.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">
                Selected date: {formatRoutineDate(selectedDate)}
              </span>
            </div>
          </div>
          {routines.isLoading || completions.isLoading || selectedDay.isLoading ? (
            <LoadingState rows={2} />
          ) : routines.isError || completions.isError || selectedDay.isError ? (
            <ErrorState
              onRetry={() =>
                void Promise.all([routines.refetch(), completions.refetch(), selectedDay.refetch()])
              }
            />
          ) : allRoutines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your completion history will appear here.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {formatRoutineDate(selectedDate)}
              </p>
              <ul className="space-y-2">
                {allRoutines.map((routine) => {
                  const completed = (selectedDay.data ?? []).some(
                    (completion) => completion.routine_id === routine.id,
                  );
                  return (
                    <li
                      key={routine.id}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-foreground">
                        {routine.name}
                      </span>
                      <span
                        className={
                          completed
                            ? "shrink-0 text-sm font-medium text-primary"
                            : "shrink-0 text-sm text-muted-foreground"
                        }
                      >
                        {completed ? "Completed" : "Not completed"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-2 border-t border-border pt-4">
                <h3 className="text-sm font-medium text-foreground">Recent 7 days</h3>
                {allRoutines.map((routine) => (
                  <article key={routine.id} className="rounded-lg bg-surface p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {routine.name}
                      </span>
                      {!routine.is_active && (
                        <Badge variant="outline" className="shrink-0">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {dates.map((date) => {
                        const completed = completionKeys.has(`${routine.id}:${date}`);
                        return (
                          <div
                            key={date}
                            className="min-w-0 text-center"
                            aria-label={`${formatRoutineDate(date)}: ${completed ? "completed" : "not completed"}`}
                          >
                            <p className="text-[10px] text-muted-foreground sm:text-xs">
                              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                                weekday: "short",
                              })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(`${date}T00:00:00`).getDate()}
                            </p>
                            <span
                              className={
                                completed
                                  ? "mx-auto mt-1 grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
                                  : "mx-auto mt-1 grid h-6 w-6 place-items-center rounded-full bg-background text-xs text-muted-foreground"
                              }
                              aria-hidden="true"
                            >
                              {completed ? "✓" : "·"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <RoutineDialog
        key={editing?.id ?? "new-routine"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        routine={editing}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={`Delete ${pendingDelete?.name ?? "routine"}?`}
        description="This permanently deletes its completion history. Deactivate the routine instead to keep its history."
        confirmLabel={deleteRoutine.isPending ? "Deleting…" : "Delete routine"}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}

function RoutineDialog({
  open,
  onOpenChange,
  routine,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine | null;
}) {
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const [name, setName] = useState(routine?.name ?? "");
  const [description, setDescription] = useState(routine?.description ?? "");
  const pending = createRoutine.isPending || updateRoutine.isPending;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: RoutineInput = { name: name.trim(), description: description.trim() || null };
    try {
      if (routine) {
        await updateRoutine.mutateAsync({ id: routine.id, ...input });
        toast.success("Routine updated");
      } else {
        await createRoutine.mutateAsync(input);
        toast.success("Routine created");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this routine");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{routine ? "Edit routine" : "New routine"}</DialogTitle>
          <DialogDescription>
            Keep it clear and easy to recognize in your daily checklist.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="routine-name">Routine name</Label>
            <Input
              id="routine-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
              autoFocus
              placeholder="Morning walk"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="routine-description">Description (optional)</Label>
            <Textarea
              id="routine-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="A few details to keep the routine clear."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : routine ? "Save changes" : "Create routine"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatRoutineDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
