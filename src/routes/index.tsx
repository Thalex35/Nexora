import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckSquare, FolderKanban, Target, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  todayISO,
  useGoals,
  useProfile,
  useProjects,
  useSaveTodayPlan,
  useTasks,
  useTodayPlan,
  useTransactions,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Nexora" },
      {
        name: "description",
        content:
          "Your Nexora Today view: the three priorities that matter, today's tasks, and a calm overview of goals, projects and finances.",
      },
      { property: "og:title", content: "Today — Nexora" },
      {
        property: "og:description",
        content: "The three priorities that matter, today's tasks, and your life at a glance.",
      },
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

function HomePage() {
  return (
    <AppShell>
      <Today />
    </AppShell>
  );
}

function Today() {
  const { data: profile } = useProfile();
  const tasks = useTasks();
  const goals = useGoals();
  const projects = useProjects();
  const transactions = useTransactions();

  const today = todayISO();
  const todaysTasks = (tasks.data ?? []).filter(
    (task) => task.status !== "done" && (!task.due_date || task.due_date <= today),
  );
  const openTasks = (tasks.data ?? []).filter((task) => task.status !== "done");
  const activeGoals = (goals.data ?? []).filter((goal) => goal.status === "active");
  const activeProjects = (projects.data ?? []).filter((project) =>
    ["planning", "active"].includes(project.status),
  );

  const income = (transactions.data ?? [])
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = (transactions.data ?? [])
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        description={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      />

      <TodaysPriorities />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="nexora-label">Today's tasks</h2>
          <Link to="/tasks" className="text-sm text-primary hover:underline">
            All tasks
          </Link>
        </div>
        {tasks.isLoading ? (
          <LoadingState rows={2} />
        ) : tasks.isError ? (
          <ErrorState onRetry={() => void tasks.refetch()} />
        ) : todaysTasks.length === 0 ? (
          <EmptyState
            title="Nothing due today"
            description="Add a task with today's date and it will show up here."
          />
        ) : (
          <div className="space-y-2">
            {todaysTasks.slice(0, 6).map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="nexora-label">Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewCard
            to="/tasks"
            icon={<CheckSquare className="h-4 w-4" />}
            label="Tasks"
            loading={tasks.isLoading}
            value={openTasks.length > 0 ? `${openTasks.length} open` : null}
            empty="No tasks yet"
          />
          <OverviewCard
            to="/goals"
            icon={<Target className="h-4 w-4" />}
            label="Goals"
            loading={goals.isLoading}
            value={activeGoals.length > 0 ? `${activeGoals.length} active` : null}
            empty="No goals yet"
          />
          <OverviewCard
            to="/projects"
            icon={<FolderKanban className="h-4 w-4" />}
            label="Projects"
            loading={projects.isLoading}
            value={activeProjects.length > 0 ? `${activeProjects.length} in motion` : null}
            empty="No projects yet"
          />
          <OverviewCard
            to="/finance"
            icon={<Wallet className="h-4 w-4" />}
            label="Finance"
            loading={transactions.isLoading}
            value={
              (transactions.data ?? []).length > 0
                ? `${(income - expenses).toFixed(2)} balance`
                : null
            }
            empty="No transactions yet"
          />
        </div>
      </section>
    </div>
  );
}

function TodaysPriorities() {
  const plan = useTodayPlan();
  const savePlan = useSaveTodayPlan();
  const [values, setValues] = useState<string[]>(["", "", ""]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (plan.data) {
      setValues([
        plan.data.priority_1 ?? "",
        plan.data.priority_2 ?? "",
        plan.data.priority_3 ?? "",
      ]);
    }
  }, [plan.data]);

  const filled = values.filter((value) => value.trim().length > 0);

  async function save() {
    try {
      await savePlan.mutateAsync({
        priority_1: values[0]?.trim() || null,
        priority_2: values[1]?.trim() || null,
        priority_3: values[2]?.trim() || null,
      });
      setEditing(false);
      toast.success("Priorities saved");
    } catch {
      toast.error("Couldn't save your priorities. Please try again.");
    }
  }

  return (
    <section className="nexora-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="nexora-label">Today's priorities</h2>
        {!plan.isLoading && (
          <Button variant="ghost" size="sm" onClick={() => setEditing((prev) => !prev)}>
            {editing ? "Cancel" : filled.length > 0 ? "Edit" : "Set"}
          </Button>
        )}
      </div>

      {plan.isLoading ? (
        <div className="mt-4">
          <LoadingState rows={1} />
        </div>
      ) : editing ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-sm text-muted-foreground">{index + 1}</span>
              <Input
                value={values[index] ?? ""}
                placeholder={`Priority ${index + 1}`}
                onChange={(event) => {
                  const next = [...values];
                  next[index] = event.target.value;
                  setValues(next);
                }}
              />
            </div>
          ))}
          <Button size="sm" onClick={() => void save()} disabled={savePlan.isPending}>
            {savePlan.isPending ? "Saving…" : "Save priorities"}
          </Button>
        </div>
      ) : filled.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No priorities set for today. Choose the three things that matter most.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {values.map((value, index) =>
            value.trim() ? (
              <li key={index} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-surface text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="min-w-0">{value}</span>
              </li>
            ) : null,
          )}
        </ol>
      )}
    </section>
  );
}

function OverviewCard({
  to,
  icon,
  label,
  value,
  empty,
  loading,
}: {
  to: "/tasks" | "/goals" | "/projects" | "/finance";
  icon: React.ReactNode;
  label: string;
  value: string | null;
  empty: string;
  loading: boolean;
}) {
  return (
    <Link
      to={to}
      className="nexora-panel flex flex-col gap-3 p-4 transition-colors hover:border-primary/50"
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </span>
      <span className="text-base font-semibold text-foreground">
        {loading ? "…" : (value ?? <span className="text-muted-foreground">{empty}</span>)}
      </span>
    </Link>
  );
}
