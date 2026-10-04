import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BrainCircuit } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/states";
import {
  useDailyPlan,
  useGoals,
  useLearningSessions,
  useProjects,
  useRoutineCompletions,
  useRoutines,
  useTasks,
  todayISO,
} from "@/lib/nexora-data";
import { getDayPlanPriorities } from "@/lib/planning";
import { buildFocusRecommendations } from "@/lib/intelligence";

export function DailyIntelligence() {
  const today = todayISO();
  const tasks = useTasks();
  const plan = useDailyPlan(today);
  const goals = useGoals();
  const projects = useProjects();
  const routines = useRoutines();
  const routineCompletions = useRoutineCompletions(today, today);
  const learningSessions = useLearningSessions();
  const queries = [tasks, plan, goals, projects, routines, routineCompletions, learningSessions];
  const failed = queries.some((query) => query.isError);
  const loading = queries.some((query) => query.isLoading);
  const priorities = getDayPlanPriorities(plan.data);
  const allTasks = tasks.data ?? [];
  const recommendations = buildFocusRecommendations({
    today,
    priorities,
    tasks: allTasks,
    goals: goals.data ?? [],
    projects: projects.data ?? [],
  });
  const overdueCount = allTasks.filter(
    (task) => task.status !== "done" && task.due_date !== null && task.due_date < today,
  ).length;
  const upcomingCount = allTasks.filter(
    (task) =>
      task.status !== "done" &&
      task.due_date !== null &&
      task.due_date >= today &&
      task.due_date <= addDays(today, 3),
  ).length;
  const activeGoalCount = (goals.data ?? []).filter((goal) => goal.status === "active").length;
  const activeProjectCount = (projects.data ?? []).filter(
    (project) => project.status === "active" || project.status === "planning",
  ).length;
  const activeRoutines = (routines.data ?? []).filter((routine) => routine.is_active);
  const activeRoutineIds = new Set(activeRoutines.map((routine) => routine.id));
  const completedRoutineIds = new Set(
    (routineCompletions.data ?? [])
      .map((completion) => completion.routine_id)
      .filter((routineId) => activeRoutineIds.has(routineId)),
  );
  const todaysSessions = (learningSessions.data ?? []).filter(
    (session) => session.session_date === today,
  );
  const completedSessions = todaysSessions.length;

  return (
    <section
      className="nexora-panel space-y-4 p-4 sm:p-5"
      aria-labelledby="daily-intelligence-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="daily-intelligence-title"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <BrainCircuit className="h-4 w-4 text-primary" />
            Daily briefing
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Practical suggestions from your Nexora data; your priorities stay in control.
          </p>
        </div>
        <Link to="/planning" className="text-xs font-medium text-primary hover:underline">
          Review today
        </Link>
      </div>

      {loading ? (
        <LoadingState rows={1} />
      ) : failed ? (
        <ErrorState onRetry={() => void Promise.all(queries.map((query) => query.refetch()))} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {overdueCount > 0
              ? `${overdueCount} overdue ${overdueCount === 1 ? "task" : "tasks"}`
              : "No overdue tasks"}
            {" · "}
            {upcomingCount} task{upcomingCount === 1 ? "" : "s"} due today or in the next 3 days
            {" · "}
            {activeGoalCount} active {activeGoalCount === 1 ? "goal" : "goals"}
            {" · "}
            {activeProjectCount} active {activeProjectCount === 1 ? "project" : "projects"}
          </p>
          {(activeRoutines.length > 0 || completedSessions > 0) && (
            <p className="text-xs text-muted-foreground">
              {activeRoutines.length > 0
                ? `${completedRoutineIds.size} of ${activeRoutines.length} routines completed`
                : ""}
              {activeRoutines.length > 0 && completedSessions > 0 ? " · " : ""}
              {completedSessions > 0
                ? `${completedSessions} learning ${completedSessions === 1 ? "session" : "sessions"} logged today`
                : ""}
            </p>
          )}

          <div className="border-t border-border pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What to focus on
            </h3>
            {priorities.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {priorities.map((priority, index) => (
                  <li
                    key={`${priority}-${index}`}
                    className="rounded-md bg-primary/10 px-2.5 py-1 text-xs text-foreground"
                  >
                    Your priority: {priority}
                  </li>
                ))}
              </ul>
            )}
            {recommendations.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {priorities.length > 0
                  ? "Stay with the priorities you chose. No other time-sensitive items stand out."
                  : "Nothing time-sensitive stands out. Choose a priority or keep the day open."}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {recommendations.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      className="group flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {item.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">{item.reason}</span>
                      </span>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function addDays(dateISO: string, count: number) {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
