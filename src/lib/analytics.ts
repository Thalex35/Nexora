import type {
  DailyPlan,
  Debt,
  FutureExpense,
  Goal,
  IncomeAllocation,
  LearningItem,
  LearningSession,
  Project,
  Routine,
  RoutineCompletion,
  Task,
  Transaction,
} from "@/lib/nexora-data";
import { dateKeyInRange, datesInRange, formatPlanningDate, type DateRange } from "@/lib/planning";

export function calculatePeriodAnalytics(
  range: DateRange,
  data: {
    tasks: Task[];
    plans: DailyPlan[];
    goals: Goal[];
    projects: Project[];
    routines: Routine[];
    routineCompletions: RoutineCompletion[];
    learningItems: LearningItem[];
    learningSessions: LearningSession[];
    transactions: Transaction[];
    allocations: IncomeAllocation[];
    futureExpenses: FutureExpense[];
    debts: Debt[];
  },
) {
  const days = datesInRange(range);
  const periodTasks = data.tasks.filter(
    (task) =>
      dateKeyInRange(task.due_date, range) || dateKeyInRange(task.created_at.slice(0, 10), range),
  );
  const incompleteTasks = periodTasks.filter((task) => task.status !== "done");
  const completedTasks = data.tasks.filter(
    (task) => task.status === "done" && dateKeyInRange(task.updated_at.slice(0, 10), range),
  );
  const taskCount = incompleteTasks.length + completedTasks.length;
  const activeRoutines = data.routines.filter((routine) => routine.is_active);
  const routineCompletions = data.routineCompletions.filter((completion) =>
    dateKeyInRange(completion.completion_date, range),
  );
  const learningSessions = data.learningSessions.filter((session) =>
    dateKeyInRange(session.session_date, range),
  );
  const periodGoals = data.goals.filter((goal) =>
    dateKeyInRange(goal.target_date ?? goal.created_at.slice(0, 10), range),
  );
  const periodProjects = data.projects.filter((project) =>
    dateKeyInRange(
      project.deadline ?? project.start_date ?? project.created_at.slice(0, 10),
      range,
    ),
  );
  const periodTransactions = data.transactions.filter((transaction) =>
    dateKeyInRange(transaction.transaction_date, range),
  );
  const plannedDays = new Set(
    data.plans
      .filter((plan) => dateKeyInRange(plan.plan_date, range))
      .map((plan) => plan.plan_date),
  );

  const taskTrend = days.map((date) => {
    const completed = completedTasks.filter((task) => task.updated_at.slice(0, 10) === date).length;
    return {
      date,
      label: formatPlanningDate(date, { weekday: "short", day: "numeric" }),
      completed,
    };
  });
  const financeMonths = [
    ...new Set(periodTransactions.map((transaction) => transaction.transaction_date.slice(0, 7))),
  ].sort();
  const financeTrend = financeMonths.map((month) => {
    const monthTransactions = periodTransactions.filter((transaction) =>
      transaction.transaction_date.startsWith(`${month}-`),
    );
    return {
      month,
      label: new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: "short" }),
      income: sum(
        monthTransactions
          .filter((transaction) => transaction.type === "income")
          .map((row) => row.amount),
      ),
      expenses: sum(
        monthTransactions
          .filter((transaction) => transaction.type === "expense")
          .map((row) => row.amount),
      ),
    };
  });
  const rangeIncomeIds = new Set(
    periodTransactions
      .filter((transaction) => transaction.type === "income")
      .map((transaction) => transaction.id),
  );
  const allocated = sum(
    data.allocations
      .filter((allocation) => rangeIncomeIds.has(allocation.income_id))
      .map((allocation) => {
        const income = periodTransactions.find(
          (transaction) => transaction.id === allocation.income_id,
        );
        return allocation.allocation_type === "percentage"
          ? (Number(income?.amount ?? 0) * allocation.value) / 100
          : allocation.value;
      }),
  );
  const average = (values: number[]) =>
    values.length
      ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
      : 0;

  return {
    daysCount: days.length,
    plannedTasks: taskCount,
    completedTasks: completedTasks.length,
    incompleteTasks: incompleteTasks.length,
    completionRate: taskCount ? Math.round((completedTasks.length / taskCount) * 100) : 0,
    taskTrend,
    averageGoalProgress: average(periodGoals.map((goal) => goal.progress)),
    goalsCount: periodGoals.length,
    averageProjectProgress: average(periodProjects.map((project) => project.progress)),
    projectsCount: periodProjects.length,
    routineCompletions: routineCompletions.length,
    routineOpportunities: activeRoutines.length * days.length,
    routineConsistency: activeRoutines.length
      ? Math.round((routineCompletions.length / (activeRoutines.length * days.length)) * 100)
      : 0,
    learningSessions: learningSessions.length,
    learningMinutes: learningSessions.reduce(
      (total, session) => total + session.duration_minutes,
      0,
    ),
    learningItemsInPeriod: data.learningItems.filter((item) =>
      dateKeyInRange(item.target_date ?? item.created_at.slice(0, 10), range),
    ),
    income: sum(periodTransactions.filter((row) => row.type === "income").map((row) => row.amount)),
    expenses: sum(
      periodTransactions.filter((row) => row.type === "expense").map((row) => row.amount),
    ),
    allocated,
    financeTrend,
    plannedDays: plannedDays.size,
    planningConsistency: days.length ? Math.round((plannedDays.size / days.length) * 100) : 0,
    upcomingFutureExpenses: data.futureExpenses.filter(
      (expense) => expense.status === "planned" && dateKeyInRange(expense.planned_date, range),
    ).length,
    outstandingDebts: data.debts.filter(
      (debt) => debt.status === "unpaid" && dateKeyInRange(debt.debt_date, range),
    ).length,
  };
}

function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + Number(value), 0) * 100) / 100;
}

export type AnalyticsSummary = ReturnType<typeof calculatePeriodAnalytics>;
