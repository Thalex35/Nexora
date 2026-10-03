import type {
  DailyPlan,
  Debt,
  FutureExpense,
  Goal,
  LearningItem,
  LearningSession,
  Project,
  Routine,
  RoutineCompletion,
  Task,
} from "@/lib/nexora-data";

export type DateRange = { start: string; end: string };

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function addCalendarDays(dateISO: string, amount: number) {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return localDate(date);
}

export function startOfWeek(dateISO: string) {
  const date = new Date(`${dateISO}T12:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return localDate(date);
}

export function monthRange(month: string): DateRange {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`Invalid month: ${month}`);
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function shiftPlanningPeriod(
  period: "day" | "week" | "month",
  anchor: string,
  offset: number,
) {
  if (period === "day") return addCalendarDays(anchor, offset);
  if (period === "week") return addCalendarDays(startOfWeek(anchor), offset * 7);
  const [year, month] = anchor.slice(0, 7).split("-").map(Number) as [number, number];
  return localDate(new Date(year, month - 1 + offset, 1));
}

export function dateRangeForPeriod(period: "week" | "month", anchor: string): DateRange {
  if (period === "month") return monthRange(anchor.slice(0, 7));
  const start = startOfWeek(anchor);
  return { start, end: addCalendarDays(start, 6) };
}

export function datesInRange(range: DateRange) {
  const dates: string[] = [];
  for (let date = range.start; date <= range.end; date = addCalendarDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function formatPlanningDate(dateISO: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString(undefined, options);
}

export function getDayPlanPriorities(plan: DailyPlan | null | undefined) {
  const priorities =
    (plan?.priorities?.length ? plan.priorities : null) ??
    [plan?.priority_1, plan?.priority_2, plan?.priority_3].filter((priority): priority is string =>
      Boolean(priority?.trim()),
    );
  return priorities.filter((priority): priority is string => Boolean(priority?.trim()));
}

export function dayPlanningData(
  date: string,
  tasks: Task[],
  plans: DailyPlan[],
  routines: Routine[],
  completions: RoutineCompletion[],
  sessions: LearningSession[],
) {
  const dayTasks = tasks.filter((task) => task.due_date === date);
  const dayPlan = plans.find((plan) => plan.plan_date === date);
  const dayRoutines = routines.filter((routine) => routine.is_active);
  const completedRoutineIds = new Set(
    completions
      .filter((completion) => completion.completion_date === date)
      .map((completion) => completion.routine_id),
  );
  return {
    tasks: dayTasks,
    completedTasks: dayTasks.filter((task) => task.status === "done").length,
    priorities: getDayPlanPriorities(dayPlan),
    routines: dayRoutines.map((routine) => ({
      routine,
      completed: completedRoutineIds.has(routine.id),
    })),
    sessions: sessions.filter((session) => session.session_date === date),
  };
}

export function monthPlanningItems(
  date: string,
  tasks: Task[],
  goals: Goal[],
  projects: Project[],
  learningItems: LearningItem[],
  futureExpenses: FutureExpense[],
  debts: Debt[],
) {
  return {
    tasks: tasks.filter((task) => task.due_date === date && task.status !== "done"),
    goals: goals.filter((goal) => goal.target_date === date && goal.status !== "completed"),
    projects: projects.filter(
      (project) =>
        project.deadline === date &&
        project.status !== "completed" &&
        project.status !== "archived",
    ),
    learning: learningItems.filter(
      (item) => item.target_date === date && item.status !== "completed",
    ),
    futureExpenses: futureExpenses.filter(
      (expense) => expense.planned_date === date && expense.status === "planned",
    ),
    debts: debts.filter((debt) => debt.due_date === date && debt.status === "unpaid"),
  };
}

export function dateKeyInRange(date: string | null | undefined, range: DateRange) {
  return Boolean(date && date >= range.start && date <= range.end);
}
