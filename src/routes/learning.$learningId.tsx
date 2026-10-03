import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock3, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LearningItemDialog } from "@/components/learning-item-dialog";
import { LearningSessionDialog } from "@/components/learning-session-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatLearningDate,
  learningStateFromProgress,
  learningStateFromStatus,
  learningStatusLabel,
} from "@/lib/learning";
import {
  useDeleteLearningItem,
  useGoals,
  useLearningItems,
  useLearningSessions,
  useProjects,
  useTasks,
  useUpdateLearningItem,
  type LearningItem,
  type LearningSession,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/learning/$learningId")({
  head: () => ({
    meta: [
      { title: "Learning item — Nexora" },
      { name: "description", content: "Continue learning and keep a record of every session." },
    ],
  }),
  component: LearningDetailPage,
});

function LearningDetailPage() {
  const { learningId } = Route.useParams();
  const navigate = useNavigate();
  const items = useLearningItems();
  const sessions = useLearningSessions();
  const goals = useGoals();
  const projects = useProjects();
  const tasks = useTasks();
  const updateItem = useUpdateLearningItem();
  const deleteItem = useDeleteLearningItem();
  const [editOpen, setEditOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const item = (items.data ?? []).find((row) => row.id === learningId);
  const itemSessions = (sessions.data ?? []).filter(
    (session) => session.learning_item_id === learningId,
  );
  const loading =
    items.isLoading ||
    sessions.isLoading ||
    goals.isLoading ||
    projects.isLoading ||
    tasks.isLoading;
  const failed =
    items.isError || sessions.isError || goals.isError || projects.isError || tasks.isError;
  const relatedGoal = (goals.data ?? []).find((goal) => goal.id === item?.goal_id);
  const relatedProject = (projects.data ?? []).find((project) => project.id === item?.project_id);
  const relatedTask = (tasks.data ?? []).find((task) => task.id === item?.task_id);

  useEffect(() => {
    if (item) setProgress(item.progress);
  }, [item]);

  async function saveProgress() {
    if (!item) return;
    try {
      await updateItem.mutateAsync({ id: item.id, ...learningStateFromProgress(progress) });
      toast.success("Learning progress updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update progress");
    }
  }

  async function changeStatus(status: LearningItem["status"]) {
    if (!item) return;
    try {
      await updateItem.mutateAsync({
        id: item.id,
        ...learningStateFromStatus(status, item.progress),
      });
      toast.success(`Learning marked ${learningStatusLabel(status).toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update learning status");
    }
  }

  async function confirmDelete() {
    if (!item) return;
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success("Learning item deleted; session history was kept");
      void navigate({ to: "/learning" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete this learning item");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingState rows={3} />
      </AppShell>
    );
  }
  if (failed) {
    return (
      <AppShell>
        <ErrorState
          onRetry={() =>
            void Promise.all([
              items.refetch(),
              sessions.refetch(),
              goals.refetch(),
              projects.refetch(),
              tasks.refetch(),
            ])
          }
        />
      </AppShell>
    );
  }
  if (!item) {
    return (
      <AppShell>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">This learning item could not be found.</p>
          <Button variant="outline" asChild>
            <Link to="/learning">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Learning
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={item.title}
          description={item.category || "Your learning space"}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/learning">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Learning
              </Link>
            </Button>
          }
        />

        <section className="nexora-panel space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.status === "completed" ? "secondary" : "outline"}>
                {learningStatusLabel(item.status)}
              </Badge>
              {item.category && <Badge variant="outline">{item.category}</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setSessionOpen(true)}>
                <Clock3 className="mr-1 h-4 w-4" />
                Log session
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete learning item"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {item.description && (
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {item.description}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="learning-detail-progress" className="text-sm font-medium">
                Progress: {progress}%
              </label>
              <Select
                value={item.status}
                onValueChange={(value) => void changeStatus(value as LearningItem["status"])}
              >
                <SelectTrigger className="w-40" aria-label="Learning status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Progress value={progress} aria-label={`${progress}% complete`} />
            <div className="flex flex-wrap items-center gap-3">
              <input
                id="learning-detail-progress"
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(event) => setProgress(Number(event.target.value))}
                className="min-w-36 flex-1 accent-primary"
                aria-label="Learning progress percentage"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={updateItem.isPending || progress === item.progress}
                onClick={() => void saveProgress()}
              >
                {updateItem.isPending ? "Saving…" : "Save progress"}
              </Button>
            </div>
          </div>

          <dl className="grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Target date</dt>
              <dd className="mt-1 inline-flex items-center gap-1 text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                {item.target_date ? formatLearningDate(item.target_date) : "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Connections</dt>
              <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {relatedGoal && (
                  <Link
                    to="/goals/$goalId"
                    params={{ goalId: relatedGoal.id }}
                    className="text-primary hover:underline"
                  >
                    Goal: {relatedGoal.title}
                  </Link>
                )}
                {relatedProject && (
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: relatedProject.id }}
                    search={{ goalId: undefined }}
                    className="text-primary hover:underline"
                  >
                    Project: {relatedProject.name}
                  </Link>
                )}
                {relatedTask && (
                  <Link to="/tasks" className="text-primary hover:underline">
                    Task: {relatedTask.title}
                  </Link>
                )}
                {!relatedGoal && !relatedProject && !relatedTask && (
                  <span className="text-foreground">None</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Learning sessions</h2>
              <p className="text-sm text-muted-foreground">
                {itemSessions.length} {itemSessions.length === 1 ? "session" : "sessions"} ·{" "}
                {itemSessions.reduce((total, session) => total + session.duration_minutes, 0)}{" "}
                minutes total
              </p>
            </div>
            <Button size="sm" onClick={() => setSessionOpen(true)}>
              Log session
            </Button>
          </div>
          {itemSessions.length === 0 ? (
            <p className="nexora-panel p-4 text-sm text-muted-foreground">
              No sessions yet. Record a session to start building your learning history.
            </p>
          ) : (
            <ul className="nexora-panel divide-y divide-border px-4">
              {itemSessions.map((session) => (
                <LearningSessionRow key={session.id} session={session} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <LearningItemDialog open={editOpen} item={item} onOpenChange={setEditOpen} />
      <LearningSessionDialog open={sessionOpen} item={item} onOpenChange={setSessionOpen} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this learning item?"
        description="The item will be removed. Its recorded learning sessions will remain in history under the item name."
        confirmLabel="Delete learning item"
        onConfirm={() => void confirmDelete()}
      />
    </AppShell>
  );
}

function LearningSessionRow({ session }: { session: LearningSession }) {
  return (
    <li className="flex min-w-0 items-start gap-3 py-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Clock3 className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <time dateTime={session.session_date} className="text-sm font-medium text-foreground">
            {formatLearningDate(session.session_date)}
          </time>
          <span className="text-xs text-muted-foreground">{session.duration_minutes} minutes</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
          {session.studied}
        </p>
        {session.notes && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {session.notes}
          </p>
        )}
      </div>
    </li>
  );
}
