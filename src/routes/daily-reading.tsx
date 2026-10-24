import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Lightbulb,
  NotebookPen,
  Plus,
  Quote,
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
import {
  todayISO,
  useCreateDailyReadingSession,
  useDailyHabitRecords,
  useDailyHabitSettings,
  useSaveDailyHabitTargets,
  type DailyHabitTargetInput,
  type DailyReadingSession,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/daily-reading")({
  validateSearch: (search: Record<string, unknown>) => ({
    date:
      typeof search["date"] === "string" && isPastOrCurrentDate(search["date"])
        ? search["date"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Lecture quotidienne — Nexora" },
      {
        name: "description",
        content: "Suivez vos séances de lecture, le temps consacré et les pages lues.",
      },
    ],
  }),
  component: DailyReadingPage,
});

type ReadingDraft = {
  book: string;
  duration: string;
  pages: string;
  notes: string;
};

const EMPTY_READING_DRAFT: ReadingDraft = {
  book: "",
  duration: "20",
  pages: "",
  notes: "",
};

const EMPTY_READING_SESSIONS: DailyReadingSession[] = [];

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

function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(`${date}T12:00:00`));
}

function normalizeBookTitle(title: string) {
  return title.trim().toLocaleLowerCase();
}

function DailyReadingPage() {
  const today = todayISO();
  const { date: routeDate } = Route.useSearch();
  const [selectedDate, setSelectedDate] = useState(() => routeDate ?? today);
  const [targetDraft, setTargetDraft] = useState("");
  const [editingTarget, setEditingTarget] = useState(false);
  const [readingDraft, setReadingDraft] = useState<ReadingDraft>(EMPTY_READING_DRAFT);
  const [selectedSession, setSelectedSession] = useState<DailyReadingSession | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

  const habitSettings = useDailyHabitSettings();
  const habitRecords = useDailyHabitRecords();
  const createReadingSession = useCreateDailyReadingSession();
  const saveHabitTargets = useSaveDailyHabitTargets();
  const readingTarget = habitSettings.data?.reading_target_minutes ?? 20;
  const allSessions = habitRecords.data?.readingSessions ?? EMPTY_READING_SESSIONS;
  const sessionsForDay = allSessions.filter((session) => session.session_date === selectedDate);
  const totalMinutes = sessionsForDay.reduce(
    (total, session) => total + session.duration_minutes,
    0,
  );
  const totalPagesToday = sessionsForDay.reduce((total, session) => total + session.pages_read, 0);
  const progress = Math.min((totalMinutes / readingTarget) * 100, 100);
  const targetReached = totalMinutes >= readingTarget;
  const noteSessions = allSessions.filter((session) => Boolean(session.notes?.trim()));
  const recentSessions = showAllHistory ? allSessions : allSessions.slice(0, 5);
  const recentNotes = showAllNotes ? noteSessions : noteSessions.slice(0, 3);
  const books = useMemo(() => {
    const grouped = new Map<
      string,
      { title: string; sessions: number; pagesRead: number; latestDate: string }
    >();
    for (const session of allSessions) {
      const title = session.book_title?.trim();
      if (!title) continue;
      const key = normalizeBookTitle(title);
      const existing = grouped.get(key);
      if (existing) {
        existing.sessions += 1;
        existing.pagesRead += session.pages_read;
      } else {
        grouped.set(key, {
          title,
          sessions: 1,
          pagesRead: session.pages_read,
          latestDate: session.session_date,
        });
      }
    }
    return [...grouped.values()];
  }, [allSessions]);
  const currentBook = books[0] ?? null;
  const isLoading = habitSettings.isLoading || habitRecords.isLoading;
  const hasError = habitSettings.isError || habitRecords.isError;

  useEffect(() => {
    setTargetDraft(String(readingTarget));
  }, [readingTarget]);

  function startSession(bookTitle?: string) {
    setReadingDraft({
      ...EMPTY_READING_DRAFT,
      book: bookTitle ?? currentBook?.title ?? "",
    });
    document.getElementById("reading-session-book")?.focus();
  }

  async function saveTarget() {
    const value = Number(targetDraft);
    if (!Number.isInteger(value) || value < 1 || value > 1440) {
      toast.error("L'objectif doit être un nombre entier entre 1 et 1440 minutes.");
      setTargetDraft(String(readingTarget));
      return;
    }
    const savedSettings = habitSettings.data;
    if (!savedSettings) {
      toast.error("Impossible de charger les objectifs quotidiens.");
      return;
    }
    const input: DailyHabitTargetInput = {
      reading_target_minutes: value,
      hydration_target_ml: savedSettings.hydration_target_ml,
      learning_target_minutes: savedSettings.learning_target_minutes,
    };
    try {
      await saveHabitTargets.mutateAsync(input);
      setEditingTarget(false);
      toast.success("Objectif quotidien mis à jour");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer cet objectif");
    }
  }

  async function addReadingSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const duration = Number(readingDraft.duration || 0);
    const pages = Number(readingDraft.pages || 0);
    if (!Number.isInteger(duration) || !Number.isInteger(pages) || duration < 0 || pages < 0) {
      toast.error(
        "La durée et le nombre de pages doivent être des nombres entiers positifs ou nuls.",
      );
      return;
    }
    if (!readingDraft.book.trim() && duration <= 0 && pages <= 0) {
      toast.error("Ajoutez un livre, une durée ou un nombre de pages avant d'enregistrer.");
      return;
    }

    try {
      await createReadingSession.mutateAsync({
        session_date: selectedDate,
        duration_minutes: duration,
        pages_read: pages,
        book_title: readingDraft.book.trim() || null,
        notes: readingDraft.notes.trim() || null,
      });
      setReadingDraft(EMPTY_READING_DRAFT);
      toast.success("Séance de lecture enregistrée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer la séance");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <BookOpen className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Lecture quotidienne
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Consacrez chaque jour un peu de temps pour lire et enrichir votre esprit.
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
                {selectedDate === today ? "Aujourd'hui" : formatDate(selectedDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(selectedDate, { weekday: "long" })}
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
            <Link to="/daily-learning" search={{ date: selectedDate }}>
              Apprentissage quotidien
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
            <section className="grid gap-4 lg:grid-cols-3" aria-label="Progression de lecture">
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
                        aria-label="Objectif quotidien de lecture en minutes"
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
                        {readingTarget} minutes
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Temps de lecture</p>
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
                  aria-label={`${Math.round(progress)} % de l'objectif de lecture atteint`}
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
                        / {readingTarget} min
                      </span>
                    </p>
                  </div>
                  <Progress value={progress} aria-label="Progression quotidienne de lecture" />
                  <p className="text-xs text-muted-foreground">
                    {targetReached
                      ? "Objectif de lecture atteint"
                      : totalMinutes > 0
                        ? "Objectif en cours..."
                        : "Pas encore commencé"}
                  </p>
                </div>
              </article>

              <article className="nexora-panel flex min-h-32 items-start gap-3 p-4 sm:p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Quote className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Citation du jour</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    « Un bon livre est un outil pour mieux penser, mieux comprendre et mieux vivre.
                    »
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">— Inconnu</p>
                </div>
              </article>
            </section>

            <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,1fr)]">
              <div className="min-w-0 space-y-4">
                <article className="nexora-panel space-y-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                        <NotebookPen className="size-5" />
                      </span>
                      <div>
                        <h2 className="font-semibold text-foreground">
                          Nouvelle séance de lecture
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Enregistrez votre session de lecture du jour.
                        </p>
                      </div>
                    </div>
                  </div>
                  <form className="space-y-4" onSubmit={addReadingSession}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="reading-session-book">Livre (facultatif)</Label>
                        <Input
                          id="reading-session-book"
                          value={readingDraft.book}
                          onChange={(event) =>
                            setReadingDraft((current) => ({ ...current, book: event.target.value }))
                          }
                          placeholder="Ex. Deep Work"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reading-session-duration">Durée (minutes)</Label>
                        <Input
                          id="reading-session-duration"
                          type="number"
                          min={0}
                          step={1}
                          value={readingDraft.duration}
                          onChange={(event) =>
                            setReadingDraft((current) => ({
                              ...current,
                              duration: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="reading-session-pages">Pages lues (facultatif)</Label>
                        <Input
                          id="reading-session-pages"
                          type="number"
                          min={0}
                          step={1}
                          value={readingDraft.pages}
                          onChange={(event) =>
                            setReadingDraft((current) => ({
                              ...current,
                              pages: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reading-session-notes">Notes (facultatif)</Label>
                        <Input
                          id="reading-session-notes"
                          value={readingDraft.notes}
                          onChange={(event) =>
                            setReadingDraft((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Vos notes, idées ou apprentissages..."
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createReadingSession.isPending}
                    >
                      <BookOpen className="mr-2 size-4" />
                      {createReadingSession.isPending
                        ? "Enregistrement..."
                        : "Enregistrer la séance"}
                    </Button>
                  </form>
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
                        {showAllHistory ? "Voir moins" : "Voir tout"}
                      </Button>
                    )}
                  </div>
                  {recentSessions.length === 0 ? (
                    <EmptyState
                      icon={<BookOpen className="size-5" />}
                      title="Aucune séance de lecture"
                      description="Vos séances enregistrées apparaîtront ici."
                    />
                  ) : (
                    <>
                      <div className="hidden grid-cols-[1fr_1.6fr_0.7fr_0.8fr] gap-3 border-b border-border px-2 pb-2 text-xs font-medium text-muted-foreground sm:grid">
                        <span>Date</span>
                        <span>Livre</span>
                        <span>Durée</span>
                        <span>État</span>
                      </div>
                      <ul className="divide-y divide-border">
                        {recentSessions.map((session) => (
                          <li key={session.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedSession(session)}
                              className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-2 py-3 text-left hover:bg-accent/40 sm:grid-cols-[1fr_1.6fr_0.7fr_0.8fr_auto]"
                            >
                              <span className="text-xs text-muted-foreground">
                                {formatDate(session.session_date)}
                              </span>
                              <span className="truncate text-sm font-medium text-foreground">
                                {session.book_title || "Lecture libre"}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {session.duration_minutes} min
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
              </div>

              <aside className="min-w-0 space-y-4">
                <article className="nexora-panel space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="size-4 text-primary" />
                      <h2 className="font-semibold text-foreground">Livre actuel</h2>
                    </div>
                    {currentBook && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => startSession()}
                      >
                        Modifier
                      </Button>
                    )}
                  </div>
                  {currentBook ? (
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="font-medium text-foreground">{currentBook.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {currentBook.pagesRead} pages consignées dans{" "}
                        {currentBook.sessions === 1
                          ? "1 séance enregistrée"
                          : `${currentBook.sessions} séances enregistrées`}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Le nombre total de pages du livre n'est pas enregistré.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => startSession(currentBook.title)}
                      >
                        <Plus className="mr-1 size-4" />
                        Enregistrer une lecture
                      </Button>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<BookOpen className="size-5" />}
                      title="Aucun livre sélectionné"
                      description="Ajoutez un titre à votre prochaine séance pour le retrouver ici."
                      actionLabel="Ajouter un livre"
                      onAction={() => startSession()}
                    />
                  )}
                  {totalPagesToday > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aujourd'hui : {totalPagesToday}{" "}
                      {totalPagesToday === 1 ? "page lue" : "pages lues"}.
                    </p>
                  )}
                </article>

                <article className="nexora-panel space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-primary" />
                    <h2 className="font-semibold text-foreground">Mes livres lus</h2>
                  </div>
                  {books.length === 0 ? (
                    <p className="rounded-lg bg-background p-3 text-sm text-muted-foreground">
                      Les livres apparaîtront ici à partir de vos séances enregistrées.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {books.slice(0, 6).map((book) => (
                        <li key={normalizeBookTitle(book.title)}>
                          <button
                            type="button"
                            onClick={() => startSession(book.title)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg bg-background p-3 text-left hover:bg-accent/40"
                          >
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">
                              {book.title}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {book.pagesRead} {book.pagesRead === 1 ? "page" : "pages"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Pages et séances comptabilisées depuis vos données réelles.
                  </p>
                </article>

                <article className="nexora-panel space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <NotebookPen className="size-4 text-primary" />
                      <h2 className="font-semibold text-foreground">Mes notes récentes</h2>
                    </div>
                    {noteSessions.length > 3 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAllNotes((show) => !show)}
                      >
                        {showAllNotes ? "Voir moins" : "Voir tout"}
                      </Button>
                    )}
                  </div>
                  {recentNotes.length === 0 ? (
                    <p className="rounded-lg bg-background p-3 text-sm text-muted-foreground">
                      Les notes apparaîtront ici lorsque vous en ajouterez à une séance.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {recentNotes.map((session) => (
                        <li key={session.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedSession(session)}
                            className="w-full py-3 text-left hover:bg-accent/40"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {session.book_title || "Lecture libre"}
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatDate(session.session_date)}
                              </span>
                            </span>
                            <span className="mt-1 line-clamp-3 block text-xs leading-5 text-muted-foreground">
                              {session.notes}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="nexora-panel space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="size-4 text-primary" />
                    <h2 className="font-semibold text-foreground">Rappel / Conseils</h2>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      Privilégiez la lecture le matin.
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      Commencez par quelques pages si vous débutez.
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      La qualité compte plus que la quantité.
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      Prenez des notes sur les idées importantes.
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      Soyez régulier, pas parfait.
                    </li>
                  </ul>
                </article>
              </aside>
            </section>
          </>
        )}
      </div>

      <Dialog
        open={selectedSession !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSession?.book_title || "Séance de lecture"}</DialogTitle>
            <DialogDescription>
              {selectedSession &&
                `${formatDate(selectedSession.session_date)} · ${selectedSession.duration_minutes} min · ${selectedSession.pages_read} pages`}
            </DialogDescription>
          </DialogHeader>
          {selectedSession?.notes ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {selectedSession.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune note pour cette séance.</p>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
