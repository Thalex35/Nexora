import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Coins,
  ListChecks,
  Target,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculatePeriodAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/finance";
import {
  addCalendarDays,
  dateRangeForPeriod,
  formatPlanningDate,
  shiftPlanningPeriod,
  startOfWeek,
} from "@/lib/planning";
import {
  todayISO,
  useDailyPlans,
  useDebts,
  useFutureExpenses,
  useGoals,
  useIncomeAllocations,
  useLearningItems,
  useLearningSessions,
  useProjects,
  useRoutineCompletions,
  useRoutines,
  useTasks,
  useTransactions,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Nexora" },
      {
        name: "description",
        content: "A focused view of your progress, routines, learning, and finances.",
      },
      { property: "og:title", content: "Analytics — Nexora" },
      { property: "og:description", content: "Understand your progress over time." },
    ],
  }),
  component: AnalyticsPage,
});

type PeriodPreset = "week" | "month" | "last_month" | "custom";

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function AnalyticsPage() {
  const [preset, setPreset] = useState<PeriodPreset>("week");
  const [customStart, setCustomStart] = useState(startOfWeek(todayISO()));
  const [customEnd, setCustomEnd] = useState(todayISO());
  const range = useMemo(() => {
    const today = todayISO();
    if (preset === "custom") return { start: customStart, end: customEnd };
    if (preset === "week") return dateRangeForPeriod("week", today);
    if (preset === "month") return dateRangeForPeriod("month", today);
    const previousMonth = shiftPlanningPeriod("month", today, -1);
    return dateRangeForPeriod("month", previousMonth);
  }, [customEnd, customStart, preset]);
  const tasks = useTasks();
  const plans = useDailyPlans(range.start, range.end);
  const goals = useGoals();
  const projects = useProjects();
  const routines = useRoutines();
  const routineCompletions = useRoutineCompletions(range.start, range.end);
  const learningItems = useLearningItems();
  const learningSessions = useLearningSessions();
  const transactions = useTransactions();
  const allocations = useIncomeAllocations();
  const futureExpenses = useFutureExpenses();
  const debts = useDebts();
  const queries = [
    tasks,
    plans,
    goals,
    projects,
    routines,
    routineCompletions,
    learningItems,
    learningSessions,
    transactions,
    allocations,
    futureExpenses,
    debts,
  ];
  const loading = queries.some((query) => query.isLoading);
  const failed = queries.some((query) => query.isError);
  const data = useMemo(
    () =>
      calculatePeriodAnalytics(range, {
        tasks: tasks.data ?? [],
        plans: plans.data ?? [],
        goals: goals.data ?? [],
        projects: projects.data ?? [],
        routines: routines.data ?? [],
        routineCompletions: routineCompletions.data ?? [],
        learningItems: learningItems.data ?? [],
        learningSessions: learningSessions.data ?? [],
        transactions: transactions.data ?? [],
        allocations: allocations.data ?? [],
        futureExpenses: futureExpenses.data ?? [],
        debts: debts.data ?? [],
      }),
    [
      range,
      tasks.data,
      plans.data,
      goals.data,
      projects.data,
      routines.data,
      routineCompletions.data,
      learningItems.data,
      learningSessions.data,
      transactions.data,
      allocations.data,
      futureExpenses.data,
      debts.data,
    ],
  );
  const retry = () => void Promise.all(queries.map((query) => query.refetch()));
  const rangeLabel = `${formatPlanningDate(range.start, { day: "numeric", month: "short", year: "numeric" })} – ${formatPlanningDate(range.end, { day: "numeric", month: "short", year: "numeric" })}`;

  function changePreset(value: PeriodPreset) {
    setPreset(value);
    if (value === "custom" && customEnd < customStart) setCustomEnd(customStart);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description={`Your progress from ${rangeLabel}.`}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/planning">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Planning
              </Link>
            </Button>
          }
        />

        <section className="nexora-panel flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Select value={preset} onValueChange={(value) => changePreset(value as PeriodPreset)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Analytics date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="analytics-start">
                Start date
              </label>
              <input
                id="analytics-start"
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(event) => setCustomStart(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <label className="sr-only" htmlFor="analytics-end">
                End date
              </label>
              <input
                id="analytics-end"
                type="date"
                value={customEnd}
                min={customStart}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          )}
        </section>

        {loading ? (
          <LoadingState rows={4} />
        ) : failed ? (
          <ErrorState onRetry={retry} />
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Tasks completed"
                value={`${data.completedTasks}`}
                detail={`${data.incompleteTasks} still open · ${data.completionRate}% completion`}
              />
              <MetricCard
                icon={<CalendarCheck className="h-4 w-4" />}
                label="Planning consistency"
                value={`${data.planningConsistency}%`}
                detail={`${data.plannedDays} of ${data.daysCount} days planned`}
              />
              <MetricCard
                icon={<ListChecks className="h-4 w-4" />}
                label="Routine consistency"
                value={`${data.routineConsistency}%`}
                detail={`${data.routineCompletions} of ${data.routineOpportunities} possible check-ins`}
              />
              <MetricCard
                icon={<BookOpen className="h-4 w-4" />}
                label="Learning activity"
                value={`${data.learningSessions} sessions`}
                detail={`${data.learningMinutes} minutes this period`}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <section className="nexora-panel space-y-4 p-4 sm:p-5">
                <div>
                  <h2 className="font-semibold text-foreground">Task completion trend</h2>
                  <p className="text-sm text-muted-foreground">
                    Tasks marked complete during this period.
                  </p>
                </div>
                <BarChart
                  rows={data.taskTrend.map((row) => ({ label: row.label, value: row.completed }))}
                  valueLabel="completed"
                />
              </section>
              <section className="nexora-panel space-y-4 p-4 sm:p-5">
                <div>
                  <h2 className="font-semibold text-foreground">Finance</h2>
                  <p className="text-sm text-muted-foreground">
                    Recorded income and actual expenses in this period.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <SmallMetric label="Income" value={formatMoney(data.income)} />
                  <SmallMetric label="Expenses" value={formatMoney(data.expenses)} />
                  <SmallMetric label="Allocated" value={formatMoney(data.allocated)} />
                </div>
                <FinanceTrend rows={data.financeTrend} />
                <Link to="/finance" className="text-xs text-primary hover:underline">
                  Open Finance
                </Link>
              </section>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <ProgressSummary
                icon={<Target className="h-4 w-4" />}
                title="Goals"
                count={data.goalsCount}
                progress={data.averageGoalProgress}
                href="/goals"
              />
              <ProgressSummary
                icon={<Target className="h-4 w-4" />}
                title="Projects"
                count={data.projectsCount}
                progress={data.averageProjectProgress}
                href="/projects"
              />
              <section className="nexora-panel space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Learning
                  </h2>
                  <Link to="/learning" className="text-xs text-primary hover:underline">
                    View
                  </Link>
                </div>
                {data.learningItemsInPeriod.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No target dates in this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.learningItemsInPeriod.slice(0, 3).map((item) => (
                      <li key={item.id}>
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate">{item.title}</span>
                          <span>{item.progress}%</span>
                        </div>
                        <Progress value={item.progress} className="mt-1 h-1.5" />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  {data.upcomingFutureExpenses} planned expenses · {data.outstandingDebts}{" "}
                  outstanding debts
                </p>
              </section>
            </section>

            <p className="text-xs text-muted-foreground">
              Progress is a current snapshot for goals, projects, and learning. Task, routine,
              session, planning, and finance activity is limited to the selected dates.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="nexora-panel min-w-0 p-4">
      <h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </h2>
      <p className="mt-2 truncate text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function BarChart({
  rows,
  valueLabel,
}: {
  rows: Array<{ label: string; value: number }>;
  valueLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const displayRows =
    rows.length > 14
      ? rows.filter(
          (_, index) => index % Math.ceil(rows.length / 14) === 0 || index === rows.length - 1,
        )
      : rows;
  return (
    <div className="flex min-h-40 items-end gap-1 border-b border-border px-1 pb-1">
      {displayRows.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">No activity in this period.</p>
      ) : (
        displayRows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${row.label}: ${row.value} ${valueLabel}`}
          >
            <span className="text-[10px] text-muted-foreground">{row.value || ""}</span>
            <div
              className="w-full max-w-8 rounded-t bg-primary/75"
              style={{ height: `${Math.max(row.value > 0 ? 5 : 1, (row.value / max) * 104)}px` }}
            />
            <span className="w-full truncate text-center text-[9px] text-muted-foreground">
              {row.label}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function FinanceTrend({
  rows,
}: {
  rows: Array<{ month: string; label: string; income: number; expenses: number }>;
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.income, row.expenses]));
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No transactions in this period.</p>;
  return (
    <ul className="space-y-3">
      {rows.slice(-6).map((row) => (
        <li key={row.month} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{row.label}</span>
            <span>
              +{formatMoney(row.income)} · −{formatMoney(row.expenses)}
            </span>
          </div>
          <div className="flex h-2 gap-1">
            <div
              className="rounded bg-success/80"
              style={{ width: `${Math.max(row.income ? 2 : 0, (row.income / max) * 100)}%` }}
            />
            <div
              className="rounded bg-primary/70"
              style={{ width: `${Math.max(row.expenses ? 2 : 0, (row.expenses / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
      <li className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="text-success">Income</span>
        <span className="text-primary">Actual expenses</span>
      </li>
    </ul>
  );
}

function ProgressSummary({
  icon,
  title,
  count,
  progress,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  progress: number;
  href: "/goals" | "/projects";
}) {
  return (
    <section className="nexora-panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-primary">{icon}</span>
          {title} in range
        </h2>
        <Link to={href} className="text-xs text-primary hover:underline">
          View
        </Link>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{count} items by date</span>
        <span>{progress}% avg progress</span>
      </div>
      <Progress
        value={progress}
        aria-label={`${progress}% average ${title.toLowerCase()} progress`}
      />
    </section>
  );
}
