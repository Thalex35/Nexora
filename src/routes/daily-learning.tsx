import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Lightbulb,
  NotebookPen,
  Plus,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  todayISO,
  useCreateDailyLearningSession,
  useDailyHabitRecords,
  useDailyHabitSettings,
  useSaveDailyHabitTargets,
  useSaveDailyReflection,
  type DailyLearningSession,
  type DailyHabitTargetInput,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/daily-learning")({
  validateSearch: (search: Record<string, unknown>) => ({
    date:
      typeof search["date"] === "string" && isPastOrCurrentDate(search["date"])
        ? search["date"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Apprentissage quotidien — Nexora" },
      {
        name: "description",
        content: "Suivez vos séances, votre progression et vos notes d'apprentissage quotidiennes.",
      },
    ],
  }),
  component: DailyLearningPage,
});

type SessionDraft = {
  duration: string;
  topic: string;
  studied: string;
  understood: string;
  practiced: string;
  next: string;
  notes: string;
};

const emptySessionDraft: SessionDraft = {
  duration: "30",
  topic: "",
  studied: "",
  understood: "",
  practiced: "",
  next: "",
  notes: "",
};

type ReflectionDraft = {
  accomplished: string;
  learned: string;
  improve: string;
};

const emptyReflection: ReflectionDraft = {
  accomplished: "",
  learned: "",
  improve: "",
};

const EMPTY_LEARNING_SESSIONS: DailyLearningSession[] = [];

function isPastOrCurrentDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function shiftDate(date: string, offset: number) {
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + offset);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(
    shifted.getDate(),
  ).padStart(2, "0")}`;
}

function formatDay(date: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(`${date}T12:00:00`));
}

function formatDuration(minutes: number) {
  return `${minutes} min`;
}

function DailyLearningPage() {
  const today = todayISO();
  const { date: routeDate } = Route.useSearch();
  const [selectedDate, setSelectedDate] = useState(() => routeDate ?? today);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<DailyLearningSession | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(emptySessionDraft);
  const [reflectionDraft, setReflectionDraft] = useState<ReflectionDraft>(emptyReflection);

  const habitSettings = useDailyHabitSettings();
  const habitRecords = useDailyHabitRecords();
  const createLearningSession = useCreateDailyLearningSession();
  const saveHabitTargets = useSaveDailyHabitTargets();
  const saveReflectionMutation = useSaveDailyReflection();
  const learningTarget = habitSettings.data?.learning_target_minutes ?? 30;
  const allSessions = habitRecords.data?.learningSessions ?? EMPTY_LEARNING_SESSIONS;
  const sessionsForDay = allSessions.filter((session) => session.session_date === selectedDate);
  const totalMinutes = sessionsForDay.reduce(
    (total, session) => total + session.duration_minutes,
    0,
  );
  const progress = Math.min((totalMinutes / learningTarget) * 100, 100);
  const progressReached = totalMinutes >= learningTarget;
  const reflection = habitRecords.data?.reflections.find(
    (entry) => entry.reflection_date === selectedDate,
  );
  const noteSessions = allSessions.filter((session) =>
    [
      session.notes,
      session.studied,
      session.understood,
      session.practiced,
      session.next_steps,
    ].some((value) => Boolean(value?.trim())),
  );
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of allSessions) {
      const topic = session.topic?.trim();
      if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.entries()].sort(
      ([topicA, countA], [topicB, countB]) => countB - countA || topicA.localeCompare(topicB),
    );
  }, [allSessions]);
  const recentSessions = showAllHistory ? allSessions : allSessions.slice(0, 5);
  const recentNotes = showAllNotes ? noteSessions : noteSessions.slice(0, 3);
  const isLoading = habitSettings.isLoading || habitRecords.isLoading;
  const hasError = habitSettings.isError || habitRecords.isError;

  useEffect(() => {
    setTargetDraft(String(learningTarget));
  }, [learningTarget]);

  useEffect(() => {
    setReflectionDraft({
      accomplished: reflection?.accomplished ?? "",
      learned: reflection?.learned ?? "",
      improve: reflection?.improve ?? "",
    });
  }, [reflection?.accomplished, reflection?.learned, reflection?.improve, selectedDate]);

  async function saveTarget() {
    const value = Number(targetDraft);
    if (!Number.isInteger(value) || value < 1 || value > 1440) {
      toast.error("L'objectif doit être un nombre entier entre 1 et 1440 minutes.");
      setTargetDraft(String(learningTarget));
      return;
    }

    const savedSettings = habitSettings.data;
    if (!savedSettings) {
      toast.error("Impossible de charger les objectifs quotidiens.");
      return;
    }

    const input: DailyHabitTargetInput = {
      reading_target_minutes: savedSettings.reading_target_minutes,
      hydration_target_ml: savedSettings.hydration_target_ml,
      learning_target_minutes: value,
    };
    try {
      await saveHabitTargets.mutateAsync(input);
      setEditingTarget(false);
      toast.success("Objectif quotidien mis à jour");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer cet objectif");
    }
  }

  async function addSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const duration = Number(sessionDraft.duration);
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      toast.error("La durée doit être un nombre entier entre 1 et 1440 minutes.");
      return;
    }

    try {
      await createLearningSession.mutateAsync({
        session_date: selectedDate,
        duration_minutes: duration,
        topic: sessionDraft.topic.trim() || null,
        studied: sessionDraft.studied.trim() || null,
        understood: sessionDraft.understood.trim() || null,
        practiced: sessionDraft.practiced.trim() || null,
        next_steps: sessionDraft.next.trim() || null,
        notes: sessionDraft.notes.trim() || null,
      });
      setSessionDraft(emptySessionDraft);
      setSessionDialogOpen(false);
      toast.success("Séance d'apprentissage enregistrée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer la séance");
    }
  }

  async function saveReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await saveReflectionMutation.mutateAsync({
        reflection_date: selectedDate,
        accomplished: reflectionDraft.accomplished.trim(),
        learned: reflectionDraft.learned.trim(),
        improve: reflectionDraft.improve.trim(),
      });
      toast.success("Réflexion enregistrée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer la réflexion");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <BrainCircuit className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Apprentissage quotidien
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Consacrez chaque jour un peu de temps à apprendre quelque chose de nouveau.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-border bg-card p-2 sm:self-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Jour précédent"
              onClick={() => setSelectedDate((date) => shiftDate(date, -1))}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-32 text-center">
              <p className="text-sm font-semibold text-foreground">
                {selectedDate === today ? "Aujourd'hui" : formatDay(selectedDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDay(selectedDate, { weekday: "long" })}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Jour suivant"
              disabled={selectedDate >= today}
              onClick={() => setSelectedDate((date) => shiftDate(date, 1))}
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/routines">
              <ArrowLeft className="mr-1 size-4" />
              Retour aux routines
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/learning">
              Objectifs d'apprentissage à long terme
              <ChevronRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <LoadingState rows={5} />
        ) : hasError ? (
          <ErrorState
            onRetry={() => void Promise.all([habitSettings.refetch(), habitRecords.refetch()])}
          />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-3" aria-label="Progression quotidienne">
              <article className="nexora-panel flex min-h-32 items-center justify-between gap-3 p-4 sm:p-5">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="size-4 text-primary" />
                    <span>Objectif du jour</span>
                  </div>
                  {editingTarget ? (
                    <form
                      className="mt-3 flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveTarget();
                      }}
                    >
                      <Input
                        aria-label="Objectif quotidien en minutes"
                        type="number"
                        min={1}
                        max={1440}
                        value={targetDraft}
                        onChange={(event) => setTargetDraft(event.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">min</span>
                      <Button size="sm" type="submit" disabled={saveHabitTargets.isPending}>
                        <Check className="size-4" />
                        <span className="sr-only">Enregistrer l'objectif</span>
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {learningTarget} minutes
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Temps d'apprentissage</p>
                    </>
                  )}
                </div>
                {!editingTarget && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingTarget(true)}
                  >
                    Modifier
                  </Button>
                )}
              </article>

              <article className="nexora-panel flex min-h-32 items-center gap-4 p-4 sm:p-5">
                <div
                  className="relative grid size-20 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(var(--primary) ${progress}%, var(--muted) ${progress}% 100%)`,
                  }}
                  role="img"
                  aria-label={`${Math.round(progress)} % de l'objectif quotidien atteint`}
                >
                  <div className="grid size-[3.75rem] place-items-center rounded-full bg-card text-sm font-semibold text-foreground">
                    {Math.round(progress)}%
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Progression {selectedDate === today ? "d'aujourd'hui" : "du jour"}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {totalMinutes}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        / {learningTarget} min
                      </span>
                    </p>
                  </div>
                  <Progress value={progress} aria-label="Progression quotidienne" />
                  <p className="text-xs text-muted-foreground">
                    {progressReached
                      ? "Objectif quotidien atteint"
                      : totalMinutes > 0
                        ? "Continuez, vous avancez bien."
                        : "Pas encore commencé"}
                  </p>
                </div>
              </article>

              <article className="nexora-panel flex min-h-32 items-start gap-3 p-4 sm:p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Lightbulb className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Conseil du jour</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    « Ce n'est pas la quantité de temps qui compte, mais la qualité de ce que tu
                    apprends chaque jour. »
                  </p>
                </div>
              </article>
            </section>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(17rem,0.9fr)]">
              <div className="min-w-0 space-y-4">
                <article className="nexora-panel space-y-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                        <BookOpen className="size-5" />
                      </span>
                      <div>
                        <h2 className="font-semibold text-foreground">Ma séance d'apprentissage</h2>
                        <p className="text-sm text-muted-foreground">
                          Choisissez un sujet et notez ce que vous avez appris.
                        </p>
                      </div>
                    </div>
                    <Button type="button" size="sm" onClick={() => setSessionDialogOpen(true)}>
                      <Plus className="mr-1 size-4" />
                      Nouvelle session
                    </Button>
                  </div>

                  {sessionsForDay.length === 0 ? (
                    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/50 px-4 py-6 text-center">
                      <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                        <BookOpen className="size-7" />
                      </span>
                      <p className="mt-3 font-medium text-foreground">
                        Aucun apprentissage enregistré{" "}
                        {selectedDate === today ? "aujourd'hui" : "ce jour"}.
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Prenez quelques minutes pour apprendre quelque chose de nouveau.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3"
                        onClick={() => setSessionDialogOpen(true)}
                      >
                        <Plus className="mr-1 size-4" />
                        Démarrer une session
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {sessionsForDay.map((session) => (
                        <li key={session.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedSession(session)}
                            className="flex w-full items-center gap-3 rounded-lg border border-border bg-background/60 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                              <BookOpen className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-foreground">
                                {session.topic || session.studied || "Séance d'apprentissage"}
                              </span>
                              <span className="mt-1 block truncate text-xs text-muted-foreground">
                                {session.studied || session.notes || "Ouvrir les détails"}
                              </span>
                            </span>
                            <span className="shrink-0 text-sm text-muted-foreground">
                              {formatDuration(session.duration_minutes)}
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="nexora-panel space-y-3 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 text-primary" />
                      <h2 className="font-semibold text-foreground">Historique récent</h2>
                    </div>
                    {allSessions.length > 5 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAllHistory((show) => !show)}
                      >
                        {showAllHistory ? "Voir moins" : "Tout voir"}
                      </Button>
                    )}
                  </div>
                  {recentSessions.length === 0 ? (
                    <EmptyState
                      icon={<Clock3 className="size-5" />}
                      title="Aucune séance dans l'historique"
                      description="Vos séances enregistrées apparaîtront ici."
                    />
                  ) : (
                    <>
                      <div className="hidden grid-cols-[1fr_1.7fr_0.7fr_0.8fr] gap-3 border-b border-border px-2 pb-2 text-xs font-medium text-muted-foreground sm:grid">
                        <span>Date</span>
                        <span>Sujet</span>
                        <span>Durée</span>
                        <span>Résultat</span>
                      </div>
                      <ul className="divide-y divide-border">
                        {recentSessions.map((session) => (
                          <li key={session.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedSession(session)}
                              className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-2 py-3 text-left hover:bg-accent/40 sm:grid-cols-[1fr_1.7fr_0.7fr_0.8fr_auto]"
                            >
                              <span className="text-xs text-muted-foreground">
                                {formatDay(session.session_date)}
                              </span>
                              <span className="truncate text-sm font-medium text-foreground">
                                {session.topic || session.studied || "Séance d'apprentissage"}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatDuration(session.duration_minutes)}
                              </span>
                              <span className="col-span-2 flex items-center gap-1 text-xs text-primary sm:col-span-1">
                                <Check className="size-3.5" />
                                Enregistrée
                              </span>
                              <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </article>

                <article className="nexora-panel space-y-4 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <NotebookPen className="size-4 text-primary" />
                    <div>
                      <h2 className="font-semibold text-foreground">Réflexion du jour</h2>
                      <p className="text-sm text-muted-foreground">
                        Une courte réflexion pour retenir ce qui compte.
                      </p>
                    </div>
                  </div>
                  <form className="grid gap-3 md:grid-cols-3" onSubmit={saveReflection}>
                    <div className="space-y-2">
                      <Label htmlFor="daily-reflection-accomplished">Qu'ai-je accompli ?</Label>
                      <Textarea
                        id="daily-reflection-accomplished"
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
                      <Label htmlFor="daily-reflection-learned">Qu'ai-je appris ?</Label>
                      <Textarea
                        id="daily-reflection-learned"
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
                      <Label htmlFor="daily-reflection-improve">Que puis-je améliorer ?</Label>
                      <Textarea
                        id="daily-reflection-improve"
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
                    <div className="md:col-span-3 md:flex md:justify-end">
                      <Button type="submit" disabled={saveReflectionMutation.isPending}>
                        {saveReflectionMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                      </Button>
                    </div>
                  </form>
                </article>
              </div>

              <aside className="min-w-0 space-y-4">
                <article className="nexora-panel space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="size-4 text-primary" />
                    <h2 className="font-semibold text-foreground">Sujets d'apprentissage</h2>
                  </div>
                  {topics.length === 0 ? (
                    <p className="rounded-lg bg-background p-3 text-sm text-muted-foreground">
                      Les sujets apparaîtront ici à partir de vos séances enregistrées.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {topics.slice(0, 8).map(([topic, count]) => (
                        <li
                          key={topic}
                          className="flex items-center justify-between gap-3 rounded-lg bg-background p-3"
                        >
                          <span className="min-w-0 truncate text-sm font-medium text-foreground">
                            {topic}
                          </span>
                          <Badge variant="outline">
                            {count} {count === 1 ? "séance" : "séances"}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Basé uniquement sur les sujets de vos séances enregistrées.
                  </p>
                </article>

                <article className="nexora-panel space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <NotebookPen className="size-4 text-primary" />
                      <h2 className="font-semibold text-foreground">Notes récentes</h2>
                    </div>
                    {noteSessions.length > 3 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAllNotes((show) => !show)}
                      >
                        {showAllNotes ? "Voir moins" : "Tout voir"}
                      </Button>
                    )}
                  </div>
                  {recentNotes.length === 0 ? (
                    <p className="rounded-lg bg-background p-3 text-sm text-muted-foreground">
                      Les notes apparaîtront ici lorsque vous en ajouterez à une séance.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {recentNotes.map((session) => (
                        <li key={session.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedSession(session)}
                            className="w-full rounded-lg border border-border bg-background p-3 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {session.topic || session.studied || "Séance d'apprentissage"}
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatDay(session.session_date)}
                              </span>
                            </span>
                            <span className="mt-2 line-clamp-3 block text-xs leading-5 text-muted-foreground">
                              {session.notes ||
                                session.studied ||
                                session.understood ||
                                session.practiced ||
                                session.next_steps}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </aside>
            </div>
          </>
        )}
      </div>

      <Dialog
        open={sessionDialogOpen}
        onOpenChange={(open) => {
          setSessionDialogOpen(open);
          if (!open) setSessionDraft(emptySessionDraft);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nouvelle séance d'apprentissage</DialogTitle>
            <DialogDescription>
              {formatDay(selectedDate)} · Décrivez ce que vous avez étudié et retenu.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={addSession}>
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <div className="space-y-2">
                <Label htmlFor="daily-learning-topic">Sujet ou thème</Label>
                <Input
                  id="daily-learning-topic"
                  value={sessionDraft.topic}
                  onChange={(event) =>
                    setSessionDraft((current) => ({ ...current, topic: event.target.value }))
                  }
                  placeholder="TypeScript, anglais, entrepreneuriat..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="daily-learning-duration">Durée (minutes)</Label>
                <Input
                  id="daily-learning-duration"
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  required
                  value={sessionDraft.duration}
                  onChange={(event) =>
                    setSessionDraft((current) => ({ ...current, duration: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-learning-studied">Qu'avez-vous étudié ?</Label>
              <Textarea
                id="daily-learning-studied"
                rows={2}
                value={sessionDraft.studied}
                onChange={(event) =>
                  setSessionDraft((current) => ({ ...current, studied: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-learning-understood">Qu'avez-vous compris ?</Label>
              <Textarea
                id="daily-learning-understood"
                rows={2}
                value={sessionDraft.understood}
                onChange={(event) =>
                  setSessionDraft((current) => ({ ...current, understood: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-learning-practiced">Exercice ou pratique réalisée</Label>
              <Textarea
                id="daily-learning-practiced"
                rows={2}
                value={sessionDraft.practiced}
                onChange={(event) =>
                  setSessionDraft((current) => ({ ...current, practiced: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-learning-next">Prochaine étape</Label>
              <Input
                id="daily-learning-next"
                value={sessionDraft.next}
                onChange={(event) =>
                  setSessionDraft((current) => ({ ...current, next: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-learning-notes">Notes personnelles (facultatif)</Label>
              <Textarea
                id="daily-learning-notes"
                rows={3}
                value={sessionDraft.notes}
                onChange={(event) =>
                  setSessionDraft((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </div>
            <Button className="w-full" type="submit" disabled={createLearningSession.isPending}>
              {createLearningSession.isPending ? "Enregistrement..." : "Enregistrer la séance"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedSession !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSession?.topic || selectedSession?.studied || "Séance d'apprentissage"}
            </DialogTitle>
            <DialogDescription>
              {selectedSession &&
                `${formatDay(selectedSession.session_date)} · ${formatDuration(selectedSession.duration_minutes)}`}
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <dl className="space-y-4">
              {(
                [
                  ["Qu'avez-vous étudié ?", selectedSession.studied],
                  ["Qu'avez-vous compris ?", selectedSession.understood],
                  ["Exercice ou pratique", selectedSession.practiced],
                  ["Prochaine étape", selectedSession.next_steps],
                  ["Notes personnelles", selectedSession.notes],
                ] as const
              ).map(([label, value]) =>
                value ? (
                  <div key={label} className="space-y-1">
                    <dt className="text-sm font-medium text-foreground">{label}</dt>
                    <dd className="whitespace-pre-wrap text-sm text-muted-foreground">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
