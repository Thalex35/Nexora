import { Link } from "@tanstack/react-router";

import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { timestampDateISO, todayISO, useDailyPlan, useTasks } from "@/lib/nexora-data";
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
  const plan = useDailyPlan(today);
  const tasksQuery = useTasks();
  const tasks = tasksQuery.data ?? [];
  const todayTasks = tasks.filter(
    (task) =>
      task.due_date === today ||
      completedToday(task, today) ||
      (task.status !== "done" && task.due_date === null),
  );
  const completed = todayTasks.filter((task) => completedToday(task, today));
  const incomplete = todayTasks.filter((task) => task.status !== "done");
  const priorities = [plan.data?.priority_1, plan.data?.priority_2, plan.data?.priority_3].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  const tasksLoading = plan.isLoading || tasksQuery.isLoading;

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
      ) : plan.isError || tasksQuery.isError ? (
        <ErrorState onRetry={() => void Promise.all([plan.refetch(), tasksQuery.refetch()])} />
      ) : (
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
                <p className="mt-2 text-sm text-muted-foreground">Nothing left on today's list.</p>
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
      )}
    </section>
  );
}
