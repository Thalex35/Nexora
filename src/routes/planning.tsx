import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  ListChecks,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DailyPlanEditor } from "@/components/daily-plan-editor";
import { DailyReview } from "@/components/daily-review";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  todayISO,
  useDailyPlans,
  useDebts,
  useFutureExpenses,
  useGoals,
  useLearningItems,
  useLearningSessions,
  useProjects,
  useRoutineCompletions,
  useRoutines,
  useTasks,
} from "@/lib/nexora-data";
import {
  dateRangeForPeriod,
  dayPlanningData,
  datesInRange,
  formatPlanningDate,
  getDayPlanPriorities,
  monthPlanningItems,
  shiftPlanningPeriod,
  startOfWeek,
} from "@/lib/planning";
import type { DateRange } from "@/lib/planning";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning — Nexora" },
      {
        name: "description",
        content: "Plan your days, review the week, and see important dates in one place.",
      },
      { property: "og:title", content: "Planning — Nexora" },
      { property: "og:description", content: "A clear day, week, and month view for Nexora." },
    ],
  }),
  component: PlanningPage,
});

type PlanningPeriod = "day" | "week" | "month";

function PlanningPage() {
  const [period, setPeriod] = useState<PlanningPeriod>("day");
  const [anchor, setAnchor] = useState(todayISO());
  const range =
    period === "day" ? { start: anchor, end: anchor } : dateRangeForPeriod(period, anchor);
  const tasks = useTasks();
  const plans = useDailyPlans(range.start, range.end);
  const routines = useRoutines();
  const completions = useRoutineCompletions(range.start, range.end);
  const sessions = useLearningSessions();
  const learningItems = useLearningItems();
  const goals = useGoals();
  const projects = useProjects();
  const futureExpenses = useFutureExpenses();
  const debts = useDebts();
  const queries = [
    tasks,
    plans,
    routines,
    completions,
    sessions,
    learningItems,
    goals,
    projects,
    futureExpenses,
    debts,
  ];
  const loading = queries.some((query) => query.isLoading);
  const failed = queries.some((query) => query.isError);
  const retry = () => void Promise.all(queries.map((query) => query.refetch()));
  const activeRoutines = (routines.data ?? []).filter((routine) => routine.is_active);

  function navigate(offset: number) {
    setAnchor((value) => shiftPlanningPeriod(period, value, offset));
  }

  function setPeriodAndNormalize(value: PlanningPeriod) {
    setPeriod(value);
    if (value === "week") setAnchor(startOfWeek(anchor));
  }

  const rangeLabel =
    period === "day"
      ? formatPlanningDate(anchor, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : period === "week"
        ? `${formatPlanningDate(range.start, { day: "numeric", month: "short" })} – ${formatPlanningDate(range.end, { day: "numeric", month: "short", year: "numeric" })}`
        : new Date(`${range.start}T12:00:00`).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Planning"
          description="Keep priorities, commitments, and important dates in view."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/analytics">Analytics</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Today
                </Link>
              </Button>
            </div>
          }
        />

        <section className="nexora-panel flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-4">
          <Tabs
            value={period}
            onValueChange={(value) => setPeriodAndNormalize(value as PlanningPeriod)}
          >
            <TabsList className="h-auto w-full sm:w-auto">
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous period"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-44 text-center text-sm font-medium text-foreground">
                {rangeLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next period"
                onClick={() => navigate(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {period === "month" ? (
              <input
                type="month"
                aria-label="Planning month"
                value={anchor.slice(0, 7)}
                onChange={(event) => event.target.value && setAnchor(`${event.target.value}-01`)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            ) : (
              <input
                type="date"
                aria-label="Planning date"
                value={period === "week" ? range.start : anchor}
                onChange={(event) => event.target.value && setAnchor(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            )}
            <Button variant="outline" size="sm" onClick={() => setAnchor(todayISO())}>
              Today
            </Button>
          </div>
        </section>

        {loading ? (
          <LoadingState rows={4} />
        ) : failed ? (
          <ErrorState onRetry={retry} />
        ) : period === "day" ? (
          <DayPlanning
            date={anchor}
            tasks={tasks.data ?? []}
            plans={plans.data ?? []}
            routines={activeRoutines}
            completions={completions.data ?? []}
            sessions={sessions.data ?? []}
          />
        ) : period === "week" ? (
          <WeekPlanning
            range={range}
            tasks={tasks.data ?? []}
            plans={plans.data ?? []}
            routines={activeRoutines}
            completions={completions.data ?? []}
            sessions={sessions.data ?? []}
            goals={goals.data ?? []}
            projects={projects.data ?? []}
          />
        ) : (
          <MonthPlanning
            range={range}
            tasks={tasks.data ?? []}
            goals={goals.data ?? []}
            projects={projects.data ?? []}
            learningItems={learningItems.data ?? []}
            futureExpenses={futureExpenses.data ?? []}
            debts={debts.data ?? []}
          />
        )}

        {period === "day" && anchor === todayISO() && <DailyReview />}
      </div>
    </AppShell>
  );
}

function DayPlanning({
  date,
  tasks,
  plans,
  routines,
  completions,
  sessions,
}: {
  date: string;
  tasks: NonNullable<ReturnType<typeof useTasks>["data"]>;
  plans: NonNullable<ReturnType<typeof useDailyPlans>["data"]>;
  routines: NonNullable<ReturnType<typeof useRoutines>["data"]>;
  completions: NonNullable<ReturnType<typeof useRoutineCompletions>["data"]>;
  sessions: NonNullable<ReturnType<typeof useLearningSessions>["data"]>;
}) {
  const summary = dayPlanningData(date, tasks, plans, routines, completions, sessions);
  return (
    <div className="space-y-4">
      <DailyPlanEditor
        planDate={date}
        label={date === todayISO() ? "Today's priorities" : "Daily priorities"}
        description="Three clear priorities make the day easier to navigate."
      />
      {summary.tasks.length > 0 && (
        <section className="nexora-panel space-y-3 p-4 sm:p-5">
          <SectionHeading icon={<CalendarDays className="h-4 w-4" />} title="Scheduled tasks">
            {summary.completedTasks}/{summary.tasks.length} complete
          </SectionHeading>
          <Progress
            value={summary.tasks.length ? (summary.completedTasks / summary.tasks.length) * 100 : 0}
          />
          <ul className="divide-y divide-border">
            {summary.tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link to="/tasks" className="min-w-0 truncate text-foreground hover:text-primary">
                  {task.title}
                </Link>
                <Badge variant={task.status === "done" ? "secondary" : "outline"}>
                  {task.status.replace("_", " ")}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="grid gap-4 md:grid-cols-2">
        <section className="nexora-panel space-y-3 p-4 sm:p-5">
          <SectionHeading icon={<ListChecks className="h-4 w-4" />} title="Routines">
            {summary.routines.filter((item) => item.completed).length}/{summary.routines.length}
          </SectionHeading>
          {summary.routines.length ? (
            <ul className="space-y-2">
              {summary.routines.slice(0, 6).map(({ routine, completed }) => (
                <li key={routine.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-foreground">{routine.name}</span>
                  <Badge variant={completed ? "secondary" : "outline"}>
                    {completed ? "Done" : "Open"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No active routines.</p>
          )}
          <Link to="/routines" className="inline-block text-xs text-primary hover:underline">
            Manage routines
          </Link>
        </section>
        <section className="nexora-panel space-y-3 p-4 sm:p-5">
          <SectionHeading icon={<BookOpen className="h-4 w-4" />} title="Learning sessions">
            {summary.sessions.length}
          </SectionHeading>
          {summary.sessions.length ? (
            <ul className="space-y-2">
              {summary.sessions.slice(0, 5).map((session) => (
                <li
                  key={session.id}
                  className="flex min-w-0 items-start justify-between gap-2 text-sm"
                >
                  {session.learning_item_id ? (
                    <Link
                      to="/learning/$learningId"
                      params={{ learningId: session.learning_item_id }}
                      className="min-w-0 truncate text-foreground hover:text-primary"
                    >
                      {session.learning_item_title}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate text-foreground">
                      {session.learning_item_title}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {session.duration_minutes} min
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No sessions logged for this day.</p>
          )}
          <Link to="/learning" className="inline-block text-xs text-primary hover:underline">
            Open Learning
          </Link>
        </section>
      </section>
    </div>
  );
}

function WeekPlanning({
  range,
  tasks,
  plans,
  routines,
  completions,
  sessions,
  goals,
  projects,
}: {
  range: DateRange;
  tasks: NonNullable<ReturnType<typeof useTasks>["data"]>;
  plans: NonNullable<ReturnType<typeof useDailyPlans>["data"]>;
  routines: NonNullable<ReturnType<typeof useRoutines>["data"]>;
  completions: NonNullable<ReturnType<typeof useRoutineCompletions>["data"]>;
  sessions: NonNullable<ReturnType<typeof useLearningSessions>["data"]>;
  goals: NonNullable<ReturnType<typeof useGoals>["data"]>;
  projects: NonNullable<ReturnType<typeof useProjects>["data"]>;
}) {
  const weekDates = datesInRange(range);
  const totals = weekDates.reduce(
    (result, date) => {
      const day = dayPlanningData(date, tasks, plans, routines, completions, sessions);
      result.completed += day.completedTasks;
      result.tasks += day.tasks.length;
      result.routines += day.routines.filter((routine) => routine.completed).length;
      result.routineCount += day.routines.length;
      result.sessions += day.sessions.length;
      return result;
    },
    { completed: 0, tasks: 0, routines: 0, routineCount: 0, sessions: 0 },
  );
  return (
    <div className="space-y-4">
      <section className="nexora-panel grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <MiniMetric label="Tasks complete" value={`${totals.completed}/${totals.tasks}`} />
        <MiniMetric label="Routine check-ins" value={`${totals.routines}/${totals.routineCount}`} />
        <MiniMetric label="Learning sessions" value={String(totals.sessions)} />
        <MiniMetric
          label="Planned days"
          value={`${plans.filter((plan) => getDayPlanPriorities(plan).length > 0).length}/7`}
        />
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        {weekDates.map((date) => {
          const day = dayPlanningData(date, tasks, plans, routines, completions, sessions);
          return (
            <article key={date} className="nexora-panel min-w-0 space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-foreground">
                  {formatPlanningDate(date, { weekday: "long", day: "numeric" })}
                </h2>
                <span className="text-xs text-muted-foreground">{day.tasks.length} tasks</span>
              </div>
              {day.priorities.length > 0 && (
                <ol className="space-y-1 text-sm text-muted-foreground">
                  {day.priorities.map((priority, index) => (
                    <li key={`${priority}-${index}`}>
                      {index + 1}. {priority}
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-xs text-muted-foreground">
                {day.completedTasks}/{day.tasks.length} tasks ·{" "}
                {day.routines.filter((routine) => routine.completed).length}/{day.routines.length}{" "}
                routines · {day.sessions.length} learning sessions
              </p>
              {day.tasks.length > 0 && (
                <ul className="space-y-1">
                  {day.tasks.slice(0, 4).map((task) => (
                    <li key={task.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${task.status === "done" ? "bg-success" : "bg-primary"}`}
                      />
                      <span
                        className={`min-w-0 truncate ${task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}
                      >
                        {task.title}
                      </span>
                    </li>
                  ))}
                  {day.tasks.length > 4 && (
                    <li className="text-xs text-muted-foreground">
                      +{day.tasks.length - 4} more tasks
                    </li>
                  )}
                </ul>
              )}
              {day.routines.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">
                  Routines:{" "}
                  {day.routines
                    .slice(0, 3)
                    .map(({ routine, completed }) => `${routine.name}${completed ? " ✓" : ""}`)
                    .join(" · ")}
                </p>
              )}
              {day.sessions.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">
                  Learning:{" "}
                  {day.sessions
                    .slice(0, 2)
                    .map((session) => session.learning_item_title)
                    .join(" · ")}
                </p>
              )}
              {day.priorities.length === 0 &&
                day.tasks.length === 0 &&
                day.routines.length === 0 &&
                day.sessions.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing planned yet.</p>
                )}
            </article>
          );
        })}
      </div>
      <section className="grid gap-3 sm:grid-cols-2">
        <PeriodProgressList
          title="Goals in focus"
          href="/goals"
          items={goals
            .filter((goal) => goal.status === "active")
            .slice(0, 3)
            .map((goal) => ({ id: goal.id, title: goal.title, progress: goal.progress }))}
        />
        <PeriodProgressList
          title="Projects in focus"
          href="/projects"
          items={projects
            .filter((project) => project.status === "active" || project.status === "planning")
            .slice(0, 3)
            .map((project) => ({
              id: project.id,
              title: project.name,
              progress: project.progress,
            }))}
        />
      </section>
    </div>
  );
}

function MonthPlanning({
  range,
  tasks,
  goals,
  projects,
  learningItems,
  futureExpenses,
  debts,
}: {
  range: DateRange;
  tasks: NonNullable<ReturnType<typeof useTasks>["data"]>;
  goals: NonNullable<ReturnType<typeof useGoals>["data"]>;
  projects: NonNullable<ReturnType<typeof useProjects>["data"]>;
  learningItems: NonNullable<ReturnType<typeof useLearningItems>["data"]>;
  futureExpenses: NonNullable<ReturnType<typeof useFutureExpenses>["data"]>;
  debts: NonNullable<ReturnType<typeof useDebts>["data"]>;
}) {
  const dates = datesInRange(range);
  const firstWeekday = (new Date(`${range.start}T12:00:00`).getDay() + 6) % 7;
  const cells = [...Array(firstWeekday).fill(null), ...dates];
  const importantDates = dates.filter((date) =>
    Object.values(
      monthPlanningItems(date, tasks, goals, projects, learningItems, futureExpenses, debts),
    ).some((items) => items.length > 0),
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((date, index) => {
          if (!date)
            return (
              <div
                key={`blank-${index}`}
                className="min-h-20 rounded-lg bg-transparent sm:min-h-28"
              />
            );
          const items = monthPlanningItems(
            date,
            tasks,
            goals,
            projects,
            learningItems,
            futureExpenses,
            debts,
          );
          const count = Object.values(items).reduce((total, rows) => total + rows.length, 0);
          const shownCount = Object.values(items).filter((rows) => rows.length > 0).length;
          return (
            <article
              key={date}
              className={`min-h-20 min-w-0 rounded-lg border p-1.5 sm:min-h-28 sm:p-2 ${date === todayISO() ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}
            >
              <p className="text-xs font-semibold text-foreground">{Number(date.slice(-2))}</p>
              <div className="mt-1 space-y-0.5">
                {items.tasks.slice(0, 1).map((task) => (
                  <CalendarItem key={task.id} label={task.title} tone="primary" />
                ))}
                {items.goals.slice(0, 1).map((goal) => (
                  <CalendarItem key={goal.id} label={goal.title} tone="success" />
                ))}
                {items.projects.slice(0, 1).map((project) => (
                  <CalendarItem key={project.id} label={project.name} tone="success" />
                ))}
                {items.learning.slice(0, 1).map((item) => (
                  <CalendarItem key={item.id} label={item.title} tone="muted" />
                ))}
                {items.futureExpenses.slice(0, 1).map((expense) => (
                  <CalendarItem key={expense.id} label={expense.title} tone="warning" />
                ))}
                {items.debts.slice(0, 1).map((debt) => (
                  <CalendarItem key={debt.id} label={`Due: ${debt.creditor}`} tone="warning" />
                ))}
                {count > shownCount && (
                  <p className="text-[10px] text-muted-foreground">+{count - shownCount} more</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <section className="nexora-panel space-y-3 p-4 sm:p-5">
        <SectionHeading icon={<Flag className="h-4 w-4" />} title="Important dates">
          {importantDates.length}
        </SectionHeading>
        {importantDates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No deadlines or planned expenses this month.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {importantDates.map((date) => {
              const items = monthPlanningItems(
                date,
                tasks,
                goals,
                projects,
                learningItems,
                futureExpenses,
                debts,
              );
              return (
                <li
                  key={date}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4"
                >
                  <time
                    dateTime={date}
                    className="shrink-0 text-xs font-medium text-muted-foreground"
                  >
                    {formatPlanningDate(date, { weekday: "short", day: "numeric", month: "short" })}
                  </time>
                  <div className="flex flex-wrap gap-2">
                    {items.tasks.map((task) => (
                      <Badge key={task.id} variant="outline">
                        {task.title}
                      </Badge>
                    ))}
                    {items.goals.map((goal) => (
                      <Badge key={goal.id} variant="secondary">
                        Goal · {goal.title}
                      </Badge>
                    ))}
                    {items.projects.map((project) => (
                      <Badge key={project.id} variant="secondary">
                        Project · {project.name}
                      </Badge>
                    ))}
                    {items.learning.map((item) => (
                      <Badge key={item.id} variant="outline">
                        Learning · {item.title}
                      </Badge>
                    ))}
                    {items.futureExpenses.map((expense) => (
                      <Badge key={expense.id} variant="outline">
                        <Wallet className="mr-1 h-3 w-3" />
                        {expense.title}
                      </Badge>
                    ))}
                    {items.debts.map((debt) => (
                      <Badge key={debt.id} variant="outline">
                        Debt due · {debt.creditor}
                      </Badge>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function CalendarItem({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "success" | "muted" | "warning";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    muted: "text-muted-foreground",
    warning: "text-warning",
  }[tone];
  return <p className={`truncate text-[10px] leading-tight sm:text-xs ${toneClass}`}>{label}</p>;
}

function SectionHeading({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {children && <span className="shrink-0 text-xs text-muted-foreground">{children}</span>}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="nexora-label">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PeriodProgressList({
  title,
  href,
  items,
}: {
  title: string;
  href: "/goals" | "/projects";
  items: Array<{ id: string; title: string; progress: number }>;
}) {
  return (
    <section className="nexora-panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Link to={href} className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing active right now.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between gap-2 text-xs">
                <span className="truncate text-foreground">{item.title}</span>
                <span className="shrink-0 text-muted-foreground">{item.progress}%</span>
              </div>
              <Progress value={item.progress} className="mt-1 h-1" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
