import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Clock3,
  Droplet,
  Droplets,
  Lightbulb,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  todayISO,
  useCreateDailyHydrationLog,
  useCreateDailyHydrationScheduleSlot,
  useDailyHabitRecords,
  useDailyHabitSettings,
  useDeleteDailyHydrationScheduleSlot,
  useSaveDailyHabitTargets,
  useSetDailyHydrationScheduleCompletion,
  type DailyHabitTargetInput,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/daily-hydration")({
  validateSearch: (search: Record<string, unknown>) => ({
    date:
      typeof search["date"] === "string" && isPastOrCurrentDate(search["date"])
        ? search["date"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Hydratation quotidienne — Nexora" },
      {
        name: "description",
        content: "Suivez votre consommation d'eau et vos rappels d'hydratation.",
      },
    ],
  }),
  component: DailyHydrationPage,
});

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

function formatHydrationTime(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":");
  return `${Number(hours)}h${minutes === "00" ? "" : minutes}`;
}

function formatEntryTime(timestamp: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(timestamp),
  );
}

function DailyHydrationPage() {
  const today = todayISO();
  const { date: routeDate } = Route.useSearch();
  const [selectedDate, setSelectedDate] = useState(() => routeDate ?? today);
  const [targetDraft, setTargetDraft] = useState("");
  const [editingTarget, setEditingTarget] = useState(false);
  const [amountDraft, setAmountDraft] = useState("250");
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [showAllHistory, setShowAllHistory] = useState(false);

  const habitSettings = useDailyHabitSettings();
  const habitRecords = useDailyHabitRecords();
  const saveHabitTargets = useSaveDailyHabitTargets();
  const createHydrationLog = useCreateDailyHydrationLog();
  const createScheduleSlot = useCreateDailyHydrationScheduleSlot();
  const deleteScheduleSlot = useDeleteDailyHydrationScheduleSlot();
  const setScheduleCompletion = useSetDailyHydrationScheduleCompletion();
  const hydrationTarget = habitSettings.data?.hydration_target_ml ?? 2000;
  const hydrationLogs = habitRecords.data?.hydrationLogs ?? [];
  const dailyEntries = hydrationLogs.filter((entry) => entry.logged_date === selectedDate);
  const dailyTotal = dailyEntries.reduce((total, entry) => total + entry.amount_ml, 0);
  const safeTarget = Number.isFinite(hydrationTarget) && hydrationTarget > 0 ? hydrationTarget : 0;
  const progress = safeTarget > 0 ? Math.min((dailyTotal / safeTarget) * 100, 100) : 0;
  const targetReached = safeTarget > 0 && dailyTotal >= safeTarget;
  const scheduleSlots = habitRecords.data?.hydrationScheduleSlots ?? [];
  const scheduleCompletions = habitRecords.data?.hydrationScheduleCompletions ?? [];
  const isLoading = habitSettings.isLoading || habitRecords.isLoading;
  const hasError = habitSettings.isError || habitRecords.isError;
  const weeklyDays = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(selectedDate, index - 6);
    const amount = hydrationLogs
      .filter((entry) => entry.logged_date === date)
      .reduce((total, entry) => total + entry.amount_ml, 0);
    return { date, amount };
  });
  const maxWeeklyAmount = Math.max(safeTarget, ...weeklyDays.map((day) => day.amount), 1);
  const entries = showAllHistory ? hydrationLogs : hydrationLogs.slice(0, 5);

  useEffect(() => {
    setTargetDraft(String(hydrationTarget));
  }, [hydrationTarget]);

  async function saveTarget() {
    const value = Number(targetDraft);
    if (!Number.isSafeInteger(value) || value < 1) {
      toast.error("L'objectif doit être un nombre entier supérieur à zéro.");
      setTargetDraft(String(hydrationTarget));
      return;
    }
    const savedSettings = habitSettings.data;
    if (!savedSettings) {
      toast.error("Impossible de charger les objectifs quotidiens.");
      return;
    }
    const input: DailyHabitTargetInput = {
      reading_target_minutes: savedSettings.reading_target_minutes,
      hydration_target_ml: value,
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

  async function addHydrationEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(amountDraft);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      toast.error("Saisissez une quantité en mL supérieure à zéro.");
      return;
    }
    try {
      await createHydrationLog.mutateAsync({ logged_date: selectedDate, amount_ml: amount });
      toast.success("Consommation d'eau enregistrée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer cette entrée");
    }
  }

  async function addReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduleTime)) {
      toast.error("Choisissez une heure valide pour ce rappel.");
      return;
    }
    if (scheduleSlots.some((slot) => slot.time.slice(0, 5) === scheduleTime)) {
      toast.error("Ce rappel existe déjà.");
      return;
    }
    try {
      await createScheduleSlot.mutateAsync(scheduleTime);
      toast.success("Rappel ajouté");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'ajouter ce rappel");
    }
  }

  async function toggleReminder(slotId: string, completed: boolean) {
    try {
      await setScheduleCompletion.mutateAsync({
        slotId,
        date: selectedDate,
        completed,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de modifier ce rappel");
    }
  }

  async function removeReminder(slotId: string) {
    try {
      await deleteScheduleSlot.mutateAsync(slotId);
      toast.success("Rappel supprimé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de supprimer ce rappel");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <Droplet className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Hydratation quotidienne
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Suivez votre consommation d'eau et vos rappels au fil de la journée.
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
        </div>

        {isLoading ? (
          <LoadingState rows={5} />
        ) : hasError ? (
          <ErrorState
            onRetry={() => void Promise.all([habitSettings.refetch(), habitRecords.refetch()])}
          />
        ) : (
          <>
            <section
              className="grid gap-4 lg:grid-cols-[0.9fr_1.2fr]"
              aria-label="Objectif et progrès"
            >
              <article className="nexora-panel flex min-h-32 items-center justify-between gap-3 p-4 sm:p-5">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Droplet className="size-4 text-primary" />
                    <span>Objectif quotidien (mL)</span>
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
                        aria-label="Objectif quotidien en millilitres"
                        type="number"
                        min={1}
                        step={1}
                        value={targetDraft}
                        onChange={(event) => setTargetDraft(event.target.value)}
                        className="w-32"
                      />
                      <Button size="sm" type="submit" disabled={saveHabitTargets.isPending}>
                        <Check className="size-4" />
                        <span className="sr-only">Enregistrer l'objectif</span>
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {hydrationTarget.toLocaleString("fr-FR")} mL
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Votre objectif d'hydratation quotidien
                      </p>
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
                  aria-label={`${Math.round(progress)} % de l'objectif d'hydratation atteint`}
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
                      {dailyTotal.toLocaleString("fr-FR")}{" "}
                      <span className="text-sm font-normal text-muted-foreground">
                        / {safeTarget.toLocaleString("fr-FR")} mL
                      </span>
                    </p>
                  </div>
                  <Progress value={progress} aria-label="Progression quotidienne d'hydratation" />
                  <p className="text-xs text-muted-foreground">
                    {targetReached
                      ? "Objectif quotidien atteint"
                      : dailyTotal > 0
                        ? "Objectif en cours..."
                        : "Pas encore commencé"}
                  </p>
                </div>
              </article>
            </section>

            <article className="nexora-panel space-y-3 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                  <Droplets className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-foreground">Enregistrer une consommation</h2>
                  <p className="text-sm text-muted-foreground">
                    Ajoutez la quantité d'eau que vous venez de boire.
                  </p>
                </div>
              </div>
              <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addHydrationEntry}>
                <div className="relative min-w-0 flex-1">
                  <Label className="sr-only" htmlFor="hydration-amount">
                    Quantité d'eau en millilitres
                  </Label>
                  <Input
                    id="hydration-amount"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={amountDraft}
                    onChange={(event) => setAmountDraft(event.target.value)}
                    className="pr-14"
                    aria-describedby="hydration-amount-unit"
                  />
                  <span
                    id="hydration-amount-unit"
                    className="absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                  >
                    mL
                  </span>
                </div>
                <Button type="submit" disabled={createHydrationLog.isPending}>
                  <Plus className="mr-1 size-4" />
                  {createHydrationLog.isPending ? "Enregistrement..." : "Ajouter"}
                </Button>
              </form>
            </article>

            <article className="nexora-panel space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                    <Bell className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-foreground">Rappels</h2>
                    <p className="text-sm text-muted-foreground">
                      Gérez vos heures et cochez celles réalisées ce jour.
                    </p>
                  </div>
                </div>
              </div>
              <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={addReminder}>
                <div className="min-w-40 flex-1 space-y-2">
                  <Label htmlFor="hydration-reminder-time">Ajouter une heure</Label>
                  <Input
                    id="hydration-reminder-time"
                    type="time"
                    value={scheduleTime}
                    onChange={(event) => setScheduleTime(event.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={createScheduleSlot.isPending}>
                  <Plus className="mr-1 size-4" />
                  Ajouter un rappel
                </Button>
              </form>
              {scheduleSlots.length === 0 ? (
                <p className="rounded-lg bg-background p-3 text-sm text-muted-foreground">
                  Aucun rappel. Ajoutez les heures auxquelles vous souhaitez penser à boire.
                </p>
              ) : (
                <ul className="divide-y divide-border" aria-label="Rappels d'hydratation">
                  {scheduleSlots.map((slot) => {
                    const completed = scheduleCompletions.some(
                      (entry) => entry.slot_id === slot.id && entry.completed_date === selectedDate,
                    );
                    return (
                      <li key={slot.id} className="flex min-h-12 items-center gap-3 py-2">
                        <Clock3 className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                          {formatHydrationTime(slot.time)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-pressed={completed}
                          aria-label={`${completed ? "Désactiver" : "Marquer comme terminé"} le rappel de ${formatHydrationTime(slot.time)}`}
                          disabled={setScheduleCompletion.isPending}
                          onClick={() => void toggleReminder(slot.id, !completed)}
                          className={
                            completed
                              ? "text-emerald-500 hover:text-emerald-600"
                              : "text-muted-foreground"
                          }
                        >
                          <Check className="mr-1 size-4" />
                          {completed ? "Terminé" : "À faire"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Supprimer le rappel de ${formatHydrationTime(slot.time)}`}
                          disabled={deleteScheduleSlot.isPending}
                          onClick={() => void removeReminder(slot.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>

            <section className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
              <article className="nexora-panel space-y-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Droplet className="size-4 text-primary" />
                    <h2 className="font-semibold text-foreground">Historique d'hydratation</h2>
                  </div>
                  {hydrationLogs.length > 5 && (
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
                {entries.length === 0 ? (
                  <EmptyState
                    icon={<Droplet className="size-5" />}
                    title="Aucune entrée d'hydratation"
                    description="Ajoutez votre consommation d'eau pour voir votre progression ici."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Droplet className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {formatDate(entry.logged_date)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Enregistré à {formatEntryTime(entry.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {entry.amount_ml.toLocaleString("fr-FR")} mL
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="nexora-panel space-y-4 p-4 sm:p-5">
                <div>
                  <h2 className="font-semibold text-foreground">Cette semaine</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Totaux calculés à partir de vos entrées enregistrées.
                  </p>
                </div>
                {weeklyDays.some((day) => day.amount > 0) ? (
                  <ul className="space-y-3">
                    {weeklyDays.map((day) => {
                      const height =
                        day.amount > 0 ? Math.max((day.amount / maxWeeklyAmount) * 100, 5) : 0;
                      const reached = safeTarget > 0 && day.amount >= safeTarget;
                      return (
                        <li
                          key={day.date}
                          className="grid grid-cols-[4.5rem_minmax(0,1fr)_5rem] items-center gap-3"
                        >
                          <span className="text-xs text-muted-foreground">
                            {day.date === today
                              ? "Aujourd'hui"
                              : formatDate(day.date, { weekday: "short", day: "numeric" })}
                          </span>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-muted"
                            aria-label={`${day.amount} mL`}
                          >
                            <div
                              className={`h-full rounded-full ${reached ? "bg-primary" : "bg-primary/60"}`}
                              style={{ width: `${height}%` }}
                            />
                          </div>
                          <span className="text-right text-xs text-foreground">
                            {day.amount.toLocaleString("fr-FR")} mL
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-lg bg-background p-3 text-sm text-muted-foreground">
                    Pas encore de consommation enregistrée sur cette période.
                  </p>
                )}
              </article>
            </section>

            <article className="nexora-panel space-y-3 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Lightbulb className="size-4 text-primary" />
                <h2 className="font-semibold text-foreground">Conseils</h2>
              </div>
              <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  Buvez régulièrement au fil de la journée.
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  Gardez de l'eau à portée de main.
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  Soyez attentif à vos sensations.
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  Adaptez vos habitudes à vos activités et à votre environnement.
                </li>
              </ul>
            </article>
          </>
        )}
      </div>
    </AppShell>
  );
}
