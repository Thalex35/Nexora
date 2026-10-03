import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, Clock3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LearningItemDialog } from "@/components/learning-item-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLearningDate, learningStatusLabel } from "@/lib/learning";
import {
  useDeleteLearningItem,
  useLearningItems,
  useLearningSessions,
  type LearningItem,
  type LearningSession,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title: "Learning — Nexora" },
      {
        name: "description",
        content: "Build skills and knowledge with focused learning items and session history.",
      },
      { property: "og:title", content: "Learning — Nexora" },
      {
        property: "og:description",
        content: "Build skills and knowledge with focused learning items and session history.",
      },
    ],
  }),
  component: LearningPage,
});

type LearningFilter = "active" | "completed" | "all";

function LearningPage() {
  const isLearningDetail = useRouterState({
    select: (router) => router.matches.some((match) => match.routeId === "/learning/$learningId"),
  });
  if (isLearningDetail) return <Outlet />;
  return <LearningListPage />;
}

function LearningListPage() {
  const items = useLearningItems();
  const sessions = useLearningSessions();
  const deleteItem = useDeleteLearningItem();
  const [filter, setFilter] = useState<LearningFilter>("active");
  const [category, setCategory] = useState("all");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LearningItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LearningItem | null>(null);
  const rows = items.data ?? [];
  const categories = [
    ...new Set(
      rows.map((item) => item.category).filter((value): value is string => Boolean(value)),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const visible = rows.filter((item) => {
    const matchesStatus =
      filter === "all" ||
      (filter === "completed" ? item.status === "completed" : item.status !== "completed");
    return matchesStatus && (category === "all" || item.category === category);
  });
  const allSessions = sessions.data ?? [];
  const recentSessions = showAllSessions ? allSessions : allSessions.slice(0, 5);
  const loading = items.isLoading || sessions.isLoading;
  const failed = items.isError || sessions.isError;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditing(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteItem.mutateAsync(pendingDelete.id);
      toast.success("Learning item deleted; session history was kept");
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete this learning item");
      setPendingDelete(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Learning"
          description="Build knowledge one focused session at a time."
          actions={
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              New learning item
            </Button>
          }
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as LearningFilter)}>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select
            value={category === "all" ? "all" : `category:${category}`}
            onValueChange={(value) =>
              setCategory(value === "all" ? "all" : value.slice("category:".length))
            }
          >
            <SelectTrigger className="w-full sm:w-52" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((value) => (
                <SelectItem key={value} value={`category:${value}`}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <LoadingState rows={3} />
        ) : failed ? (
          <ErrorState onRetry={() => void Promise.all([items.refetch(), sessions.refetch()])} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title={
              filter === "active"
                ? "No active learning items"
                : filter === "completed"
                  ? "No completed learning yet"
                  : "No learning items yet"
            }
            description={
              filter === "active"
                ? "Add a topic or skill you want to keep moving forward."
                : "Your learning items will remain here as your history grows."
            }
            actionLabel="Create learning item"
            onAction={openCreate}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((item) => (
              <LearningItemCard
                key={item.id}
                item={item}
                onEdit={() => {
                  setEditing(item);
                  setDialogOpen(true);
                }}
                onDelete={() => setPendingDelete(item)}
              />
            ))}
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Recent sessions</h2>
              <p className="text-sm text-muted-foreground">
                Your learning activity, kept as history.
              </p>
            </div>
            {allSessions.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllSessions((value) => !value)}
              >
                {showAllSessions ? "Show recent" : `View all (${allSessions.length})`}
              </Button>
            )}
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading sessions…</p>
          ) : failed ? null : recentSessions.length === 0 ? (
            <p className="nexora-panel p-4 text-sm text-muted-foreground">
              Completed learning sessions will appear here.
            </p>
          ) : (
            <ul className="nexora-panel divide-y divide-border px-4">
              {recentSessions.map((session) => (
                <RecentSessionRow key={session.id} session={session} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <LearningItemDialog open={dialogOpen} item={editing} onOpenChange={closeDialog} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this learning item?"
        description="The item will be removed. Its recorded learning sessions will remain in history under the item name."
        confirmLabel="Delete learning item"
        onConfirm={() => void confirmDelete()}
      />
    </AppShell>
  );
}

function LearningItemCard({
  item,
  onEdit,
  onDelete,
}: {
  item: LearningItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="nexora-panel min-w-0 space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/learning/$learningId"
            params={{ learningId: item.id }}
            className="break-words font-semibold text-foreground hover:text-primary"
          >
            {item.title}
          </Link>
          {item.description && (
            <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
        <Badge variant={item.status === "completed" ? "secondary" : "outline"} className="shrink-0">
          {learningStatusLabel(item.status)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {item.category && <span>{item.category}</span>}
        {item.target_date && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Target {formatLearningDate(item.target_date)}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{item.progress}%</span>
        </div>
        <Progress value={item.progress} aria-label={`${item.progress}% complete`} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/learning/$learningId" params={{ learningId: item.id }}>
            {item.status === "completed" ? "Review" : "Continue"}
          </Link>
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${item.title}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function RecentSessionRow({ session }: { session: LearningSession }) {
  const content = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Clock3 className="h-4 w-4 text-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {session.learning_item_title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatLearningDate(session.session_date)} · {session.duration_minutes} min ·{" "}
          {session.studied}
        </span>
        {!session.learning_item_id && (
          <span className="block text-xs text-muted-foreground">Original item deleted</span>
        )}
      </span>
    </>
  );
  return (
    <li className="flex min-w-0 items-center gap-3 py-3">
      {session.learning_item_id ? (
        <Link
          to="/learning/$learningId"
          params={{ learningId: session.learning_item_id }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
      )}
    </li>
  );
}
