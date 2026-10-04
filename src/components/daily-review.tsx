import { Link } from "@tanstack/react-router";

import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import {
  dateOffsetISO,
  timestampDateISO,
  todayISO,
  useDailyPlan,
  useLearningSessions,
  useRoutineCompletions,
  useRoutines,
  useTasks,
} from "@/lib/nexora-data";
import { getDayPlanPriorities } from "@/lib/planning";
import type { Task } from "@/lib/nexora-data";

function completedToday(task: Task, today: string) {
  return task.status === "done" && timestampDateISO(task.updated_at) === today;
}

function priorityWasCompleted(priority: string, tasks: Task[], today: string) {
  const normalized = priority.trim().toLocaleLowerCase();
  return tasks.some(
    (task) => task.title.trim().toLocaleLowerCase() === normalized && completedToday(task, today),
  );
}

export function DailyReview() {
  const today = todayISO();
  const tomorrow = dateOffsetISO(1);
  const plan = useDailyPlan(today);
  const tomorrowPlan = useDailyPlan(tomorrow);
  const tasksQuery = useTasks();
  const routinesQuery = useRoutines();
  const routineCompletionsQuery = useRoutineCompletions(today, today);
  const learningSessionsQuery = useLearningSessions();
  const tasks = tasksQuery.data ?? [];
  const todayTasks = tasks.filter(
    (task) =>
      task.due_date === today ||
      (task.status !== "done" && task.due_date !== null && task.due_date < today) ||
      completedToday(task, today) ||
      (task.status !== "done" && task.due_date === null),
  );
  const completed = todayTasks.filter((task) => completedToday(task, today));
  const incomplete = todayTasks.filter((task) => task.status !== "done");
  const priorities = getDayPlanPriorities(plan.data);
  const tasksLoading =
    plan.isLoading ||
    tasksQuery.isLoading ||
    tomorrowPlan.isLoading ||
    routinesQuery.isLoading ||
    routineCompletionsQuery.isLoading ||
    learningSessionsQuery.isLoading;
  const suggestions = [
    ...incomplete.filter((task) => task.due_date !== null && task.due_date <= today),
    ...tasks.filter((task) => task.status !== "done" && task.due_date === tomorrow),
  ]
    .filter((task, index, all) => all.findIndex((item) => item.id === task.id) === index)
    .sort((left, right) => (left.due_date ?? tomorrow).localeCompare(right.due_date ?? tomorrow));
  const activeRoutines = (routinesQuery.data ?? []).filter((routine) => routine.is_active);
  const activeRoutineIds = new Set(activeRoutines.map((routine) => routine.id));
  const completedRoutineIds = new Set(
    (routineCompletionsQuery.data ?? [])
      .map((completion) => completion.routine_id)
      .filter((routineId) => activeRoutineIds.has(routineId)),
  );
  const learningSessions = (learningSessionsQuery.data ?? []).filter(
    (session) => session.session_date === today,
  );
  const tomorrowPriorities = getDayPlanPriorities(tomorrowPlan.data);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Evening review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A short look at what moved today and what can wait.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tasks">View all tasks</Link>
        </Button>
      </div>

      {tasksLoading ? (
        <LoadingState rows={2} />
      ) : plan.isError ||
        tomorrowPlan.isError ||
        tasksQuery.isError ||
        routinesQuery.isError ||
        routineCompletionsQuery.isError ||
        learningSessionsQuery.isError ? (
        <ErrorState
          onRetry={() =>
            void Promise.all([
              plan.refetch(),
              tomorrowPlan.refetch(),
              tasksQuery.refetch(),
              routinesQuery.refetch(),
              routineCompletionsQuery.refetch(),
              learningSessionsQuery.refetch(),
            ])
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="nexora-panel space-y-3 p-5">
              <h3 className="nexora-label">Today's priorities</h3>
              {priorities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No priorities were set today.</p>
              ) : (
                <ul className="space-y-2">
                  {priorities.map((priority, index) => {
                    const done = priorityWasCompleted(priority, tasks, today);
                    return (
                      <li key={`${priority}-${index}`} className="flex items-start gap-2 text-sm">
                        <span
                          className={done ? "text-primary" : "text-muted-foreground"}
                          aria-label={done ? "Completed" : "Incomplete"}
                        >
                          {done ? "✓" : "○"}
                        </span>
                        <span className={done ? "text-muted-foreground line-through" : ""}>
                          {priority}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Priority completion is matched to a completed task with the same title.
              </p>
            </div>

            <div className="nexora-panel space-y-4 p-5">
              <div>
                <h3 className="nexora-label">Tasks completed today</h3>
                {completed.length === 0 ? (
                  <EmptyState
                    title="No completed tasks yet"
                    description="Completed tasks will appear here during today's review."
                  />
                ) : (
                  <div className="mt-3 space-y-2">
                    {completed.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="nexora-label">Still to do</h3>
                {incomplete.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nothing left on today's list.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {incomplete.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="nexora-panel space-y-2 p-5">
              <h3 className="nexora-label">Routines and learning</h3>
              <p className="text-sm text-muted-foreground">
                {activeRoutines.length > 0
                  ? `${completedRoutineIds.size} of ${activeRoutines.length} active routines completed today.`
                  : "No active routines to review."}
              </p>
              {learningSessions.length > 0 ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {learningSessions.slice(0, 3).map((session) => (
                    <li key={session.id}>
                      {session.learning_item_title} · {session.duration_minutes} min
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No learning sessions logged today.</p>
              )}
              <Link
                to="/learning"
                className="inline-block text-xs font-medium text-primary hover:underline"
              >
                View learning
              </Link>
            </div>
            <div className="nexora-panel space-y-2 p-5">
              <h3 className="nexora-label">Consider for tomorrow</h3>
              {tomorrowPriorities.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Your plan already has {tomorrowPriorities.length}{" "}
                  {tomorrowPriorities.length === 1 ? "priority" : "priorities"}.
                </p>
              )}
              {suggestions.length > 0 ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {suggestions.slice(0, 4).map((task) => (
                    <li key={task.id}>
                      <span className="text-muted-foreground">
                        {task.due_date !== null && task.due_date <= today
                          ? "Carry forward: "
                          : "Due tomorrow: "}
                      </span>
                      {task.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No unfinished today or tomorrow-due tasks stand out.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Suggestions only — your plan will not change unless you choose to edit it.
              </p>
              <Link
                to="/planning"
                className="inline-block text-xs font-medium text-primary hover:underline"
              >
                Open tomorrow's plan
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
