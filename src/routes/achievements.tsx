import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AchievementDialog } from "@/components/achievement-dialog";
import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPlanningDate } from "@/lib/planning";
import { resolveAchievementReference } from "@/lib/achievement-links";
import {
  useAchievements,
  useDeleteAchievement,
  useGoals,
  useLearningItems,
  useProjects,
  useTasks,
  type Achievement,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Nexora" },
      { name: "description", content: "Keep a thoughtful record of meaningful milestones." },
      { property: "og:title", content: "Achievements — Nexora" },
      { property: "og:description", content: "Your accomplishments and personal milestones." },
    ],
  }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const achievements = useAchievements();
  const goals = useGoals();
  const projects = useProjects();
  const learningItems = useLearningItems();
  const tasks = useTasks();
  const deleteAchievement = useDeleteAchievement();
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Achievement | null>(null);
  const [category, setCategory] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [throughDate, setThroughDate] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const categories = [...new Set((achievements.data ?? []).map((item) => item.category))].sort(
    (left, right) => left.localeCompare(right),
  );
  const hasGoalLinks = (achievements.data ?? []).some((item) => item.goal_id);
  const hasProjectLinks = (achievements.data ?? []).some((item) => item.project_id);
  const hasLearningLinks = (achievements.data ?? []).some((item) => item.learning_item_id);
  const hasTaskLinks = (achievements.data ?? []).some((item) => item.task_id);
  const failedLinkedLookups =
    (hasGoalLinks && goals.isError) ||
    (hasProjectLinks && projects.isError) ||
    (hasLearningLinks && learningItems.isError) ||
    (hasTaskLinks && tasks.isError);
  const linkedLookupQueries = [
    ...(hasGoalLinks ? [goals] : []),
    ...(hasProjectLinks ? [projects] : []),
    ...(hasLearningLinks ? [learningItems] : []),
    ...(hasTaskLinks ? [tasks] : []),
  ];
  const visibleAchievements = useMemo(() => {
    const filtered = (achievements.data ?? []).filter(
      (item) =>
        (category === "all" || item.category === category) &&
        (!fromDate || item.achievement_date >= fromDate) &&
        (!throughDate || item.achievement_date <= throughDate),
    );
    return filtered.sort((left, right) =>
      newestFirst
        ? right.achievement_date.localeCompare(left.achievement_date) ||
          right.created_at.localeCompare(left.created_at)
        : left.achievement_date.localeCompare(right.achievement_date) ||
          left.created_at.localeCompare(right.created_at),
    );
  }, [achievements.data, category, fromDate, newestFirst, throughDate]);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteAchievement.mutateAsync(deleting.id);
      toast.success("Achievement deleted");
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete this achievement.");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Achievements"
          description="A thoughtful record of meaningful milestones, not everyday tasks."
          actions={
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Record achievement
            </Button>
          }
        />

        <section className="nexora-panel flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-40 flex-1 space-y-1.5">
            <label htmlFor="achievement-category-filter" className="text-xs text-muted-foreground">
              Category
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="achievement-category-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="achievement-from-date" className="text-xs text-muted-foreground">
              From
            </label>
            <Input
              id="achievement-from-date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="achievement-through-date" className="text-xs text-muted-foreground">
              Through
            </label>
            <Input
              id="achievement-through-date"
              type="date"
              value={throughDate}
              onChange={(event) => setThroughDate(event.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setNewestFirst((current) => !current)}>
            {newestFirst ? "Newest first" : "Oldest first"}
          </Button>
        </section>

        {failedLinkedLookups && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground"
          >
            <span>
              Some linked record names could not be loaded. Their links are still available.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void Promise.all(linkedLookupQueries.map((query) => query.refetch()))}
            >
              Retry linked records
            </Button>
          </div>
        )}
        {achievements.isLoading ? (
          <LoadingState rows={3} />
        ) : achievements.isError ? (
          <ErrorState onRetry={() => void achievements.refetch()} />
        ) : visibleAchievements.length === 0 ? (
          <EmptyState
            icon={<Award className="h-5 w-5" />}
            title={
              achievements.data?.length
                ? "No milestones match these filters"
                : "Your story starts here"
            }
            description={
              achievements.data?.length
                ? "Adjust the category or date range to see more."
                : "Record an achievement when you reach a meaningful milestone."
            }
            {...(!achievements.data?.length
              ? { actionLabel: "Record achievement", onAction: () => setAdding(true) }
              : {})}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleAchievements.map((achievement) => {
              const linkedRecord = resolveAchievementReference(achievement, {
                goals: goals.data ?? [],
                projects: projects.data ?? [],
                learningItems: learningItems.data ?? [],
                tasks: tasks.data ?? [],
              });
              return (
                <article key={achievement.id} className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words font-semibold text-foreground">
                        {achievement.title}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatPlanningDate(achievement.achievement_date, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {achievement.category}
                    </Badge>
                  </div>
                  {achievement.description && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {achievement.description}
                    </p>
                  )}
                  {achievement.notes && (
                    <p className="whitespace-pre-wrap border-l-2 border-border pl-3 text-sm text-muted-foreground">
                      {achievement.notes}
                    </p>
                  )}
                  {linkedRecord && (
                    <p className="text-xs text-muted-foreground">
                      Linked to: <LinkedRecord reference={linkedRecord} />
                      {!linkedRecord.title && failedLinkedLookups && " (name unavailable)"}
                    </p>
                  )}
                  <div className="flex justify-end gap-2 border-t border-border pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(achievement)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete ${achievement.title}`}
                      onClick={() => setDeleting(achievement)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <AchievementDialog
        open={adding || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        achievement={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this achievement?"
        description="This only removes the achievement record. Linked goals, projects, learning items, and tasks will remain unchanged."
        confirmLabel={deleteAchievement.isPending ? "Deleting…" : "Delete achievement"}
        onConfirm={() => void confirmDelete()}
      />
    </AppShell>
  );
}

function LinkedRecord({
  reference,
}: {
  reference: NonNullable<ReturnType<typeof resolveAchievementReference>>;
}) {
  const title = `${reference.kind}${reference.title ? ` · ${reference.title}` : ""}`;
  if (reference.kind === "Goal") {
    return (
      <Link
        to="/goals/$goalId"
        params={{ goalId: reference.id }}
        className="text-primary hover:underline"
      >
        {title}
      </Link>
    );
  }
  if (reference.kind === "Project") {
    return (
      <Link
        to="/projects/$projectId"
        params={{ projectId: reference.id }}
        search={{ goalId: undefined }}
        className="text-primary hover:underline"
      >
        {title}
      </Link>
    );
  }
  if (reference.kind === "Learning") {
    return (
      <Link
        to="/learning/$learningId"
        params={{ learningId: reference.id }}
        className="text-primary hover:underline"
      >
        {title}
      </Link>
    );
  }
  return (
    <Link to="/tasks" className="text-primary hover:underline">
      {title}
    </Link>
  );
}
