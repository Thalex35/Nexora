import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Droplets,
  ListChecks,
  Pencil,
  Plus,
  Power,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import {
  dateOffsetISO,
  todayISO,
  useCreateDailyHydrationLog,
  useCreateDailyLearningSession,
  useCreateDailyReadingSession,
  useCreateRoutine,
  useDailyHabitRecords,
  useDailyHabitSettings,
  useDeleteRoutine,
  useImportDailyHabitData,
  useRoutineCompletions,
  useRoutines,
  useSaveDailyHabitTargets,
  useSaveDailyReflection,
  useUpdateRoutine,
  type DailyHabitImportInput,
  type DailyHabitTargetInput,
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

const LEGACY_DAILY_ROUTINE_STORAGE_KEY = "nexora-daily-routine-dashboard-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function legacyRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid saved routine data in ${context}.`);
  return value;
}

function legacyString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`Invalid "${key}" value in saved routine data.`);
  return value;
}

function legacyId(record: Record<string, unknown>): string {
  const id = legacyString(record, "id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("A saved routine entry has an invalid identifier.");
  }
  return id;
}

function legacyDate(record: Record<string, unknown>): string {
  const date = legacyString(record, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("A saved routine entry has an invalid date.");
  }
  return date;
}

function legacyNumber(record: Record<string, unknown>, key: string, minimum: number): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new Error(`Invalid "${key}" value in saved routine data.`);
  }
  return value;
}

function legacyRows<T>(value: unknown, key: string, parse: (entry: unknown) => T): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Invalid "${key}" list in saved routine data.`);
  return value.map(parse);
}

function parseLegacyDailyHabitData(raw: string): DailyHabitImportInput {
  const parsed: unknown = JSON.parse(raw);
  const store = legacyRecord(parsed, "browser storage");
  const readingTarget = store["readingTarget"] ?? 20;
  const hydrationTarget = store["hydrationTarget"] ?? 2000;
  const learningTarget = store["learningTarget"] ?? 30;
  const targets: DailyHabitTargetInput = {
    reading_target_minutes: legacyNumber({ target: readingTarget }, "target", 1),
    hydration_target_ml: legacyNumber({ target: hydrationTarget }, "target", 1),
    learning_target_minutes: legacyNumber({ target: learningTarget }, "target", 1),
  };
  if (targets.reading_target_minutes > 1440 || targets.learning_target_minutes > 1440) {
    throw new Error(
      "Saved reading or learning targets exceed one day; adjust them before importing.",
    );
  }

  return {
    targets,
    readingSessions: legacyRows(store["readingSessions"], "readingSessions", (value) => {
      const entry = legacyRecord(value, "reading session");
      return {
        id: legacyId(entry),
        session_date: legacyDate(entry),
        duration_minutes: legacyNumber(entry, "minutes", 0),
        pages_read: legacyNumber(entry, "pages", 0),
        book_title: legacyString(entry, "book") || null,
        notes: legacyString(entry, "notes") || null,
      };
    }),
    hydrationLogs: legacyRows(store["hydrationLogs"], "hydrationLogs", (value) => {
      const entry = legacyRecord(value, "hydration log");
      return {
        id: legacyId(entry),
        logged_date: legacyDate(entry),
        amount_ml: legacyNumber(entry, "amount", 1),
      };
    }),
    learningSessions: legacyRows(store["learningSessions"], "learningSessions", (value) => {
      const entry = legacyRecord(value, "learning session");
      return {
        id: legacyId(entry),
        session_date: legacyDate(entry),
        duration_minutes: legacyNumber(entry, "duration", 1),
        topic: legacyString(entry, "topic") || null,
        studied: legacyString(entry, "studied") || null,
        understood: legacyString(entry, "understood") || null,
        practiced: legacyString(entry, "practiced") || null,
        notes: legacyString(entry, "notes") || null,
        next_steps: legacyString(entry, "next") || null,
      };
    }),
    reflections: legacyRows(store["reflections"], "reflections", (value) => {
      const entry = legacyRecord(value, "daily reflection");
      return {
        reflection_date: legacyDate(entry),
        accomplished: legacyString(entry, "accomplished"),
        learned: legacyString(entry, "learned"),
        improve: legacyString(entry, "improve"),
      };
    }),
  };
}

function formatProgressLabel(current: number, target: number) {
  return `${Math.min(current, target)} / ${target}`;
}

function RoutinesPage() {
  const { user } = useAuth();
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
  const habitSettings = useDailyHabitSettings();
  const habitRecords = useDailyHabitRecords();
  const saveHabitTargets = useSaveDailyHabitTargets();
  const importDailyHabitData = useImportDailyHabitData();
  const createReadingSession = useCreateDailyReadingSession();
  const createHydrationLog = useCreateDailyHydrationLog();
  const createLearningSession = useCreateDailyLearningSession();
  const saveReflectionMutation = useSaveDailyReflection();
  const [targetDraft, setTargetDraft] = useState({
    reading: "20",
    hydration: "2000",
    learning: "30",
  });
  const [readingDraft, setReadingDraft] = useState({
    book: "",
    pages: "",
    minutes: "20",
    notes: "",
  });
  const [hydrationQuickAmount, setHydrationQuickAmount] = useState(250);
  const [learningDraft, setLearningDraft] = useState({
    topic: "",
    duration: "30",
    studied: "",
    understood: "",
    practiced: "",
    notes: "",
    next: "",
  });
  const [reflectionDraft, setReflectionDraft] = useState({
    accomplished: "",
    learned: "",
    improve: "",
  });
  const [hasLocalRoutineData, setHasLocalRoutineData] = useState(false);

  useEffect(() => {
    if (!habitSettings.data) return;
    setTargetDraft({
      reading: String(habitSettings.data.reading_target_minutes),
      hydration: String(habitSettings.data.hydration_target_ml),
      learning: String(habitSettings.data.learning_target_minutes),
    });
  }, [habitSettings.data]);

  useEffect(() => {
    const reflection = habitRecords.data?.reflections.find(
      (entry) => entry.reflection_date === selectedDate,
    );
    setReflectionDraft({
      accomplished: reflection?.accomplished ?? "",
      learned: reflection?.learned ?? "",
      improve: reflection?.improve ?? "",
    });
  }, [habitRecords.data?.reflections, selectedDate]);

  useEffect(() => {
    if (!user) {
      setHasLocalRoutineData(false);
      return;
    }
    try {
      const imported = window.localStorage.getItem(
        `${LEGACY_DAILY_ROUTINE_STORAGE_KEY}-imported-${user.id}`,
      );
      setHasLocalRoutineData(
        imported !== "true" &&
          window.localStorage.getItem(LEGACY_DAILY_ROUTINE_STORAGE_KEY) !== null,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't check browser-saved activity");
    }
  }, [user]);

  const readingSessions = habitRecords.data?.readingSessions ?? [];
  const hydrationLogs = habitRecords.data?.hydrationLogs ?? [];
  const learningSessions = habitRecords.data?.learningSessions ?? [];
  const readingsForDay = readingSessions.filter((entry) => entry.session_date === selectedDate);
  const hydrationForDay = hydrationLogs.filter((entry) => entry.logged_date === selectedDate);
  const learningForDay = learningSessions.filter((entry) => entry.session_date === selectedDate);
  const dailyReadingMinutes = readingsForDay.reduce(
    (total, entry) => total + entry.duration_minutes,
    0,
  );
  const dailyReadingPages = readingsForDay.reduce((total, entry) => total + entry.pages_read, 0);
  const dailyHydrationAmount = hydrationForDay.reduce((total, entry) => total + entry.amount_ml, 0);
  const dailyLearningMinutes = learningForDay.reduce(
    (total, entry) => total + entry.duration_minutes,
    0,
  );
  const readingTarget = Number(targetDraft.reading) || 20;
  const hydrationTarget = Number(targetDraft.hydration) || 2000;
  const learningTarget = Number(targetDraft.learning) || 30;
  const readingProgress = Math.min((dailyReadingMinutes / readingTarget) * 100, 100);
  const hydrationProgress = Math.min((dailyHydrationAmount / hydrationTarget) * 100, 100);
  const learningProgress = Math.min((dailyLearningMinutes / learningTarget) * 100, 100);
  const completedHabitCount = [
    dailyReadingMinutes >= readingTarget,
    dailyHydrationAmount >= hydrationTarget,
    dailyLearningMinutes >= learningTarget,
  ].filter(Boolean).length;
  const habitHistoryDates = Array.from({ length: 7 }, (_, index) => dateOffsetISO(index - 6));
  const dailyActivitySummary = habitHistoryDates.map((date) => {
    const readings = readingSessions.filter((entry) => entry.session_date === date);
    const readingMinutes = readings.reduce((total, entry) => total + entry.duration_minutes, 0);
    const readingPages = readings.reduce((total, entry) => total + entry.pages_read, 0);
    const hydrationMl = hydrationLogs
      .filter((entry) => entry.logged_date === date)
      .reduce((total, entry) => total + entry.amount_ml, 0);
    const learningMinutes = learningSessions
      .filter((entry) => entry.session_date === date)
      .reduce((total, entry) => total + entry.duration_minutes, 0);
    return {
      date,
      readingMinutes,
      readingPages,
      hydrationMl,
      learningMinutes,
      active: readingMinutes > 0 || readingPages > 0 || hydrationMl > 0 || learningMinutes > 0,
    };
  });
  const activeHabitDays = dailyActivitySummary.filter((day) => day.active).length;
  const weeklyTotals = dailyActivitySummary.reduce(
    (totals, day) => ({
      readingMinutes: totals.readingMinutes + day.readingMinutes,
      readingPages: totals.readingPages + day.readingPages,
      hydrationMl: totals.hydrationMl + day.hydrationMl,
      learningMinutes: totals.learningMinutes + day.learningMinutes,
    }),
    { readingMinutes: 0, readingPages: 0, hydrationMl: 0, learningMinutes: 0 },
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

  function saveTarget(key: keyof typeof targetDraft) {
    const enteredValue = Number(targetDraft[key]);
    if (!Number.isInteger(enteredValue) || enteredValue < 1) {
      toast.error("Daily targets must be a positive whole number.");
      const savedTargets = habitSettings.data;
      if (savedTargets) {
        setTargetDraft({
          reading: String(savedTargets.reading_target_minutes),
          hydration: String(savedTargets.hydration_target_ml),
          learning: String(savedTargets.learning_target_minutes),
        });
      }
      return;
    }

    const normalizedValue = key === "hydration" ? enteredValue : Math.min(enteredValue, 1440);
    setTargetDraft((current) => ({ ...current, [key]: String(normalizedValue) }));
    const input: DailyHabitTargetInput = {
      reading_target_minutes: Math.max(1, Number(targetDraft.reading) || 20),
      hydration_target_ml: Math.max(1, Number(targetDraft.hydration) || 2000),
      learning_target_minutes: Math.max(1, Number(targetDraft.learning) || 30),
    };
    if (key === "reading") input.reading_target_minutes = normalizedValue;
    if (key === "hydration") input.hydration_target_ml = normalizedValue;
    if (key === "learning") input.learning_target_minutes = normalizedValue;
    saveHabitTargets.mutate(input, {
      onSuccess: () => toast.success("Daily targets updated"),
      onError: (error) => {
        toast.error(error.message || "Couldn't save your daily targets");
        const savedTargets = habitSettings.data;
        if (savedTargets) {
          setTargetDraft((current) => ({
            ...current,
            [key]: String(
              key === "reading"
                ? savedTargets.reading_target_minutes
                : key === "hydration"
                  ? savedTargets.hydration_target_ml
                  : savedTargets.learning_target_minutes,
            ),
          }));
        }
      },
    });
  }

  async function addReadingSession() {
    const minutes = Number(readingDraft.minutes || 0);
    const pages = Number(readingDraft.pages || 0);
    if (!Number.isInteger(minutes) || !Number.isInteger(pages) || minutes < 0 || pages < 0) {
      toast.error("Reading time and pages must be non-negative whole numbers.");
      return;
    }
    if (!readingDraft.book.trim() && minutes <= 0 && pages <= 0) {
      toast.error("Add a session detail or book before saving.");
      return;
    }

    try {
      await createReadingSession.mutateAsync({
        session_date: selectedDate,
        duration_minutes: Math.max(0, minutes),
        pages_read: Math.max(0, pages),
        book_title: readingDraft.book.trim() || null,
        notes: readingDraft.notes.trim() || null,
      });
      setReadingDraft({ book: "", pages: "", minutes: "20", notes: "" });
      toast.success("Reading session saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this reading session");
    }
  }

  async function addHydrationAmount(amount: number) {
    const numeric = Number(amount);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      toast.error("Enter a positive whole amount of water in milliliters.");
      return;
    }

    try {
      await createHydrationLog.mutateAsync({ logged_date: selectedDate, amount_ml: numeric });
      setHydrationQuickAmount(250);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record this hydration entry");
    }
  }

  async function addLearningSession() {
    const duration = Number(learningDraft.duration || 0);
    if (!Number.isInteger(duration) || duration <= 0) {
      toast.error("Learning session duration must be a positive whole number of minutes.");
      return;
    }

    try {
      await createLearningSession.mutateAsync({
        session_date: selectedDate,
        duration_minutes: Math.max(0, duration),
        topic: learningDraft.topic.trim() || null,
        studied: learningDraft.studied.trim() || null,
        understood: learningDraft.understood.trim() || null,
        practiced: learningDraft.practiced.trim() || null,
        notes: learningDraft.notes.trim() || null,
        next_steps: learningDraft.next.trim() || null,
      });
      setLearningDraft({
        topic: "",
        duration: "30",
        studied: "",
        understood: "",
        practiced: "",
        notes: "",
        next: "",
      });
      toast.success("Daily learning session saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this learning session");
    }
  }

  async function saveReflection() {
    try {
      await saveReflectionMutation.mutateAsync({
        reflection_date: selectedDate,
        accomplished: reflectionDraft.accomplished.trim(),
        learned: reflectionDraft.learned.trim(),
        improve: reflectionDraft.improve.trim(),
      });
      toast.success("Reflection saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this reflection");
    }
  }

  async function importLocalHabitData() {
    if (!user) {
      toast.error("Sign in before importing browser-saved routine activity.");
      return;
    }

    try {
      const raw = window.localStorage.getItem(LEGACY_DAILY_ROUTINE_STORAGE_KEY);
      if (!raw) {
        setHasLocalRoutineData(false);
        toast.info("No browser-saved routine activity was found.");
        return;
      }
      const legacyData = parseLegacyDailyHabitData(raw);
      await importDailyHabitData.mutateAsync(legacyData);
      window.localStorage.setItem(
        `${LEGACY_DAILY_ROUTINE_STORAGE_KEY}-imported-${user.id}`,
        "true",
      );
      setHasLocalRoutineData(false);
      toast.success("Browser-saved routine activity imported. The local copy was kept.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't import browser-saved activity",
      );
    }
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
              <h2 className="text-base font-semibold text-foreground">Daily habit dashboard</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep the three daily habits simple: reading, hydration, and learning.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="habit-dashboard-date">Habit date</Label>
              <Input
                id="habit-dashboard-date"
                type="date"
                max={today}
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value || today)}
              />
            </div>
          </div>

          {habitSettings.isLoading || habitRecords.isLoading ? (
            <LoadingState rows={3} />
          ) : habitSettings.isError || habitRecords.isError ? (
            <ErrorState
              onRetry={() => void Promise.all([habitSettings.refetch(), habitRecords.refetch()])}
            />
          ) : (
            <>
              {hasLocalRoutineData && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Browser-saved routine activity found
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Import its targets, sessions, and reflections to your account. The browser
                      copy will be kept.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={importDailyHabitData.isPending}
                    onClick={() => void importLocalHabitData()}
                  >
                    {importDailyHabitData.isPending ? "Importing..." : "Import browser activity"}
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
                <div>
                  <p className="text-sm text-muted-foreground">Today&apos;s date</p>
                  <p className="text-lg font-semibold text-foreground">
                    {selectedDate === today ? "Today" : formatRoutineDate(selectedDate)}
                  </p>
                </div>
                <Badge variant={completedHabitCount >= 3 ? "default" : "secondary"}>
                  {completedHabitCount} of 3 habits complete
                </Badge>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <article className="space-y-4 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-foreground">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <h3 className="font-medium">Reading</h3>
                    </div>
                    <Badge variant={dailyReadingMinutes >= readingTarget ? "default" : "outline"}>
                      {dailyReadingMinutes >= readingTarget ? "Done" : "In progress"}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reading-target">Daily target (minutes)</Label>
                    <Input
                      id="reading-target"
                      type="number"
                      min={1}
                      step={1}
                      max={1440}
                      value={targetDraft.reading}
                      onChange={(event) =>
                        setTargetDraft((current) => ({ ...current, reading: event.target.value }))
                      }
                      onBlur={() => saveTarget("reading")}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Progress</span>
                      <span>{formatProgressLabel(dailyReadingMinutes, readingTarget)} min</span>
                    </div>
                    <Progress value={readingProgress} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reading-book">Book</Label>
                      <Input
                        id="reading-book"
                        value={readingDraft.book}
                        onChange={(event) =>
                          setReadingDraft((current) => ({ ...current, book: event.target.value }))
                        }
                        placeholder="Deep Work"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reading-pages">Pages</Label>
                      <Input
                        id="reading-pages"
                        type="number"
                        min={0}
                        step={1}
                        value={readingDraft.pages}
                        onChange={(event) =>
                          setReadingDraft((current) => ({ ...current, pages: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reading-minutes">Minutes</Label>
                      <Input
                        id="reading-minutes"
                        type="number"
                        min={0}
                        step={1}
                        value={readingDraft.minutes}
                        onChange={(event) =>
                          setReadingDraft((current) => ({
                            ...current,
                            minutes: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reading-notes">Notes</Label>
                      <Input
                        id="reading-notes"
                        value={readingDraft.notes}
                        onChange={(event) =>
                          setReadingDraft((current) => ({ ...current, notes: event.target.value }))
                        }
                        placeholder="Learning notes"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={createReadingSession.isPending}
                    onClick={addReadingSession}
                  >
                    {createReadingSession.isPending ? "Saving..." : "Save reading session"}
                  </Button>
                  <div className="space-y-2 text-sm">
                    {readingsForDay.length === 0 ? (
                      <p className="text-muted-foreground">No reading logged for this date yet.</p>
                    ) : (
                      readingsForDay.slice(0, 3).map((entry) => (
                        <div key={entry.id} className="rounded-lg bg-background p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">
                              {entry.book_title || "Reading session"}
                            </span>
                            <span className="text-muted-foreground">
                              {entry.duration_minutes} min
                            </span>
                          </div>
                          {entry.pages_read > 0 && (
                            <p className="mt-1 text-muted-foreground">{entry.pages_read} pages</p>
                          )}
                          {entry.notes && (
                            <p className="mt-1 text-muted-foreground">{entry.notes}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="space-y-4 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-foreground">
                      <Droplets className="h-4 w-4 text-sky-500" />
                      <h3 className="font-medium">Hydration</h3>
                    </div>
                    <Badge
                      variant={dailyHydrationAmount >= hydrationTarget ? "default" : "outline"}
                    >
                      {dailyHydrationAmount >= hydrationTarget ? "Hydrated" : "On track"}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hydration-target">Daily target (mL)</Label>
                    <Input
                      id="hydration-target"
                      type="number"
                      min={1}
                      step={1}
                      value={targetDraft.hydration}
                      onChange={(event) =>
                        setTargetDraft((current) => ({ ...current, hydration: event.target.value }))
                      }
                      onBlur={() => saveTarget("hydration")}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Progress</span>
                      <span>{formatProgressLabel(dailyHydrationAmount, hydrationTarget)} mL</span>
                    </div>
                    <Progress value={hydrationProgress} />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Quick add</p>
                    <div className="flex flex-wrap gap-2">
                      {[250, 500, 750, 1000].map((amount) => (
                        <Button
                          key={amount}
                          variant={hydrationQuickAmount === amount ? "default" : "outline"}
                          size="sm"
                          disabled={createHydrationLog.isPending}
                          onClick={() => {
                            setHydrationQuickAmount(amount);
                            void addHydrationAmount(amount);
                          }}
                        >
                          +{amount} mL
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={hydrationQuickAmount}
                        onChange={(event) =>
                          setHydrationQuickAmount(Number(event.target.value || 0))
                        }
                      />
                      <Button
                        variant="secondary"
                        disabled={createHydrationLog.isPending || hydrationQuickAmount <= 0}
                        onClick={() => void addHydrationAmount(hydrationQuickAmount)}
                      >
                        {createHydrationLog.isPending ? "Saving..." : "Add"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {hydrationForDay.length === 0 ? (
                      <p className="text-muted-foreground">No hydration entries yet.</p>
                    ) : (
                      hydrationForDay.slice(0, 4).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-lg bg-background p-2 text-muted-foreground"
                        >
                          <span>Logged</span>
                          <span className="font-medium text-foreground">{entry.amount_ml} mL</span>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="space-y-4 rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-foreground">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <h3 className="font-medium">Daily learning</h3>
                    </div>
                    <Badge variant={dailyLearningMinutes >= learningTarget ? "default" : "outline"}>
                      {dailyLearningMinutes >= learningTarget ? "Complete" : "Practice"}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="learning-target">Daily target (minutes)</Label>
                    <Input
                      id="learning-target"
                      type="number"
                      min={1}
                      step={1}
                      max={1440}
                      value={targetDraft.learning}
                      onChange={(event) =>
                        setTargetDraft((current) => ({ ...current, learning: event.target.value }))
                      }
                      onBlur={() => saveTarget("learning")}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Progress</span>
                      <span>{formatProgressLabel(dailyLearningMinutes, learningTarget)} min</span>
                    </div>
                    <Progress value={learningProgress} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="learning-topic">Topic</Label>
                      <Input
                        id="learning-topic"
                        value={learningDraft.topic}
                        onChange={(event) =>
                          setLearningDraft((current) => ({ ...current, topic: event.target.value }))
                        }
                        placeholder="TypeScript"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="learning-duration">Minutes</Label>
                      <Input
                        id="learning-duration"
                        type="number"
                        min={1}
                        step={1}
                        value={learningDraft.duration}
                        onChange={(event) =>
                          setLearningDraft((current) => ({
                            ...current,
                            duration: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="learning-studied">What did you study?</Label>
                    <Input
                      id="learning-studied"
                      value={learningDraft.studied}
                      onChange={(event) =>
                        setLearningDraft((current) => ({ ...current, studied: event.target.value }))
                      }
                      placeholder="Interfaces and generics"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="learning-understood">What did you understand?</Label>
                    <Input
                      id="learning-understood"
                      value={learningDraft.understood}
                      onChange={(event) =>
                        setLearningDraft((current) => ({
                          ...current,
                          understood: event.target.value,
                        }))
                      }
                      placeholder="How inference works"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="learning-practiced">What did you practice?</Label>
                    <Input
                      id="learning-practiced"
                      value={learningDraft.practiced}
                      onChange={(event) =>
                        setLearningDraft((current) => ({
                          ...current,
                          practiced: event.target.value,
                        }))
                      }
                      placeholder="Small exercises"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="learning-notes">Notes</Label>
                    <Textarea
                      id="learning-notes"
                      value={learningDraft.notes}
                      onChange={(event) =>
                        setLearningDraft((current) => ({ ...current, notes: event.target.value }))
                      }
                      rows={2}
                      placeholder="Additional reflections"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="learning-next">Next to learn</Label>
                    <Input
                      id="learning-next"
                      value={learningDraft.next}
                      onChange={(event) =>
                        setLearningDraft((current) => ({ ...current, next: event.target.value }))
                      }
                      placeholder="Type narrowing and mapped types"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={createLearningSession.isPending}
                    onClick={addLearningSession}
                  >
                    {createLearningSession.isPending ? "Saving..." : "Save learning session"}
                  </Button>
                  <div className="space-y-2 text-sm">
                    {learningForDay.length === 0 ? (
                      <p className="text-muted-foreground">No learning sessions yet.</p>
                    ) : (
                      learningForDay.slice(0, 3).map((entry) => (
                        <div key={entry.id} className="rounded-lg bg-background p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground">
                              {entry.topic || "Learning"}
                            </span>
                            <span className="text-muted-foreground">
                              {entry.duration_minutes} min
                            </span>
                          </div>
                          {entry.studied && (
                            <p className="mt-1 text-muted-foreground">Studied: {entry.studied}</p>
                          )}
                          {entry.understood && (
                            <p className="mt-1 text-muted-foreground">
                              Understood: {entry.understood}
                            </p>
                          )}
                          {entry.next_steps && (
                            <p className="mt-1 text-muted-foreground">Next: {entry.next_steps}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <article className="space-y-3 rounded-xl border border-border bg-surface p-4">
                  <div>
                    <h3 className="font-medium text-foreground">Daily summary</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Compare actual progress against each daily target without forcing a failed
                      day.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg bg-background p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Reading time
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {dailyReadingMinutes}m
                      </p>
                    </div>
                    <div className="rounded-lg bg-background p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Pages read
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {dailyReadingPages}
                      </p>
                    </div>
                    <div className="rounded-lg bg-background p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Hydration
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {dailyHydrationAmount}mL
                      </p>
                    </div>
                    <div className="rounded-lg bg-background p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Learning
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {dailyLearningMinutes}m
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Weekly consistency</span>
                      <span>{activeHabitDays} days with activity</span>
                    </div>
                    <p className="rounded-lg bg-background p-2 text-sm text-foreground">
                      7-day totals: {weeklyTotals.readingMinutes} min reading ·{" "}
                      {weeklyTotals.readingPages} pages · {weeklyTotals.hydrationMl} mL ·{" "}
                      {weeklyTotals.learningMinutes} min learning
                    </p>
                    {dailyActivitySummary.map((day) => {
                      return (
                        <div
                          key={day.date}
                          className="flex items-center justify-between rounded-lg bg-background p-2 text-sm"
                        >
                          <span>{formatRoutineDate(day.date)}</span>
                          <span
                            className={day.active ? "text-foreground" : "text-muted-foreground"}
                          >
                            {day.active
                              ? `${day.readingMinutes}m, ${day.readingPages}p / ${day.hydrationMl}mL / ${day.learningMinutes}m`
                              : "No data"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="space-y-3 rounded-xl border border-border bg-surface p-4">
                  <div>
                    <h3 className="font-medium text-foreground">Daily reflection</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Keep it short and useful for tomorrow&apos;s focus.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reflection-accomplished">What did I accomplish today?</Label>
                    <Textarea
                      id="reflection-accomplished"
                      rows={3}
                      value={reflectionDraft.accomplished}
                      onChange={(event) =>
                        setReflectionDraft((current) => ({
                          ...current,
                          accomplished: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reflection-learned">What did I learn today?</Label>
                    <Textarea
                      id="reflection-learned"
                      rows={3}
                      value={reflectionDraft.learned}
                      onChange={(event) =>
                        setReflectionDraft((current) => ({
                          ...current,
                          learned: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reflection-improve">What should I improve tomorrow?</Label>
                    <Textarea
                      id="reflection-improve"
                      rows={3}
                      value={reflectionDraft.improve}
                      onChange={(event) =>
                        setReflectionDraft((current) => ({
                          ...current,
                          improve: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={saveReflectionMutation.isPending}
                    onClick={saveReflection}
                  >
                    {saveReflectionMutation.isPending ? "Saving..." : "Save reflection"}
                  </Button>
                </article>
              </div>
            </>
          )}
        </section>

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
        key={`${editing?.id ?? "new-routine"}-${dialogOpen}`}
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
