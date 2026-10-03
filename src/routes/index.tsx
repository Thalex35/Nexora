import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FolderKanban,
  Plus,
  Target,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecentMilestones } from "@/components/recent-milestones";
import { RecentNotes } from "@/components/recent-notes";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TaskRow } from "@/components/task-row";
import { TodayRoutines } from "@/components/today-routines";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  dateOffsetISO,
  timestampDateISO,
  todayISO,
  useDailyPlans,
  useDailyPlan,
  useGoals,
  useLearningItems,
  useProfile,
  useProjects,
  useTasks,
} from "@/lib/nexora-data";
import type { Task } from "@/lib/nexora-data";
import { dateRangeForPeriod, getDayPlanPriorities } from "@/lib/planning";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Nexora" },
      {
        name: "description",
        content: "Your three priorities, today's tasks, and a clear next step.",
      },
      { property: "og:title", content: "Today — Nexora" },
      { property: "og:description", content: "Your daily workspace for what matters today." },
    ],
  }),
  component: HomePage,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function completedToday(task: Task, today: string) {
  return task.status === "done" && timestampDateISO(task.updated_at) === today;
}

function HomePage() {
  const { data: profile } = useProfile();
  const tasks = useTasks();
  const goals = useGoals();
  const projects = useProjects();
  const learning = useLearningItems();
  const today = todayISO();
  const weekRange = dateRangeForPeriod("week", today);
  const weeklyPlans = useDailyPlans(weekRange.start, weekRange.end);
  const todayPlan = useDailyPlan(today);
  const tomorrowPlan = useDailyPlan(dateOffsetISO(1));
  const name = profile?.full_name?.split(" ")[0];
  const allTasks = tasks.data ?? [];
  const todaysTasks = allTasks.filter(
    (task) =>
      task.due_date === today ||
      completedToday(task, today) ||
      (task.status !== "done" && task.due_date === null),
  );
  const overdueTasks = allTasks.filter(
    (task) => task.status !== "done" && task.due_date !== null && task.due_date < today,
  );
  const completedCount = todaysTasks.filter((task) => task.status === "done").length;
  const progress = todaysTasks.length ? Math.round((completedCount / todaysTasks.length) * 100) : 0;
  const priorities = getDayPlanPriorities(todayPlan.data);
  const tomorrowPriorities = getDayPlanPriorities(tomorrowPlan.data);
  const activeGoals = (goals.data ?? []).filter((goal) => goal.status === "active").slice(0, 3);
  const activeProjects = (projects.data ?? [])
    .filter((project) => project.status === "active" || project.status === "planning")
    .slice(0, 3);
  const currentLearning = (learning.data ?? [])
    .filter((item) => item.status === "in_progress")
    .slice(0, 3);
  const weekTasks = allTasks.filter(
    (task) => task.due_date !== null && task.due_date >= weekRange.start && task.due_date <= today,
  );
  const weekCompletedTasks = weekTasks.filter((task) => task.status === "done").length;
  const weekProgress = weekTasks.length
    ? Math.round((weekCompletedTasks / weekTasks.length) * 100)
    : 0;

  return (
    <AppShell>
      <div className="space-y-7">
        <PageHeader
          title={`${greeting()}${name ? `, ${name}` : ""}`}
          description={new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          actions={
            <Button size="sm" asChild>
              <Link to="/tasks">
                <Plus className="mr-1 h-4 w-4" />
                Add task
              </Link>
            </Button>
          }
        />

        <section className="nexora-panel border-primary/25 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="nexora-label">Today's priorities</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The few things that matter most today.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/planning">Edit today's plan</Link>
            </Button>
          </div>
          {todayPlan.isLoading ? (
            <div className="mt-4">
              <LoadingState rows={1} />
            </div>
          ) : todayPlan.isError ? (
            <div className="mt-4">
              <ErrorState onRetry={() => void todayPlan.refetch()} />
            </div>
          ) : priorities.length === 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Choose what matters today, or leave the list empty.
              </p>
              <Button size="sm" asChild>
                <Link to="/planning">Set today's priorities</Link>
              </Button>
            </div>
          ) : (
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {priorities.map((priority, index) => (
                <li
                  key={`${priority}-${index}`}
                  className="flex min-h-16 items-start gap-3 rounded-lg bg-surface p-3 text-sm"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-foreground">{priority}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Today's tasks</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tasks.isLoading
                  ? "Loading your list…"
                  : `${completedCount} of ${todaysTasks.length} completed`}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tasks">All tasks</Link>
            </Button>
          </div>
          {!tasks.isLoading && !tasks.isError && (
            <Progress value={progress} aria-label={`${progress}% of today's tasks completed`} />
          )}
          {tasks.isLoading ? (
            <LoadingState rows={3} />
          ) : tasks.isError ? (
            <ErrorState onRetry={() => void tasks.refetch()} />
          ) : todaysTasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="A clear day"
              description="Add a task for today or leave space for what matters."
            />
          ) : (
            <div className="space-y-2">
              {todaysTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>

        {overdueTasks.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CircleAlert className="h-4 w-4 text-warning" />
              <h2 className="text-base font-semibold text-foreground">Overdue</h2>
              <span className="text-sm text-muted-foreground">{overdueTasks.length}</span>
            </div>
            <div className="space-y-2">
              {overdueTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </section>
        )}

        <TodayRoutines />

        <section className="nexora-panel flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">This week</h2>
              <span className="text-xs text-muted-foreground">
                {weekCompletedTasks}/{weekTasks.length} scheduled tasks complete
              </span>
            </div>
            <Progress value={weekProgress} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              {weeklyPlans.isLoading
                ? "Checking your plans…"
                : weeklyPlans.isError
                  ? "Couldn't load weekly planning consistency."
                  : `${weeklyPlans.data?.filter((plan) => getDayPlanPriorities(plan).length > 0).length ?? 0} of 7 days have priorities set`}
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link to="/planning" className="text-xs font-medium text-primary hover:underline">
              Plan week
            </Link>
            <Link to="/analytics" className="text-xs font-medium text-primary hover:underline">
              Insights
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <CompactProgressList
            title="Active goals"
            icon={<Target className="h-4 w-4" />}
            to="/goals"
            empty="No active goals yet."
            loading={goals.isLoading}
            error={goals.isError}
            onRetry={() => void goals.refetch()}
            items={activeGoals.map((goal) => ({
              id: goal.id,
              title: goal.title,
              progress: goal.progress,
              to: "/goals/$goalId" as const,
              params: { goalId: goal.id },
            }))}
          />
          <CompactProgressList
            title="Active projects"
            icon={<FolderKanban className="h-4 w-4" />}
            to="/projects"
            empty="No active projects yet."
            loading={projects.isLoading}
            error={projects.isError}
            onRetry={() => void projects.refetch()}
            items={activeProjects.map((project) => ({
              id: project.id,
              title: project.name,
              progress: project.progress,
              to: "/projects/$projectId" as const,
              params: { projectId: project.id },
            }))}
          />
          <LearningCompactList
            items={currentLearning}
            loading={learning.isLoading}
            error={learning.isError}
            onRetry={() => void learning.refetch()}
          />
        </section>

        <RecentMilestones />
        <RecentNotes />

        <section className="nexora-panel flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-medium text-foreground">Plan for tomorrow</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tomorrowPlan.isLoading
                  ? "Loading tomorrow's plan…"
                  : tomorrowPriorities.length > 0
                    ? `${tomorrowPriorities.length} ${tomorrowPriorities.length === 1 ? "priority is" : "priorities are"} ready for tomorrow.`
                    : "Before you finish today, decide what matters tomorrow."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/planning">Plan tomorrow</Link>
          </Button>
        </section>
      </div>
    </AppShell>
  );
}

function LearningCompactList({
  items,
  loading,
  error,
  onRetry,
}: {
  items: Array<{ id: string; title: string; progress: number }>;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="nexora-panel min-w-0 space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="h-4 w-4 text-primary" />
          Learning now
        </h2>
        <Link to="/learning" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Couldn't load learning.</p>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No learning in progress.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <Link
                  to="/learning/$learningId"
                  params={{ learningId: item.id }}
                  className="min-w-0 truncate text-sm text-foreground hover:text-primary"
                >
                  {item.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{item.progress}%</span>
              </div>
              <Progress value={item.progress} className="mt-1.5 h-1.5" />
              <div className="mt-1 text-right">
                <Link
                  to="/learning/$learningId"
                  params={{ learningId: item.id }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Continue
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompactProgressList({
  title,
  icon,
  to,
  empty,
  items,
  loading,
  error,
  onRetry,
}: {
  title: string;
  icon: React.ReactNode;
  to: "/goals" | "/projects";
  empty: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  items: Array<{
    id: string;
    title: string;
    progress: number;
    to: "/goals/$goalId" | "/projects/$projectId";
    params: { goalId: string } | { projectId: string };
  }>;
}) {
  return (
    <section className="nexora-panel min-w-0 space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        <Link to={to} className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Couldn't load this list.</p>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <Link
                  to={item.to}
                  params={item.params}
                  className="min-w-0 truncate text-sm text-foreground hover:text-primary"
                >
                  {item.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{item.progress}%</span>
              </div>
              <Progress value={item.progress} className="mt-1.5 h-1.5" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
