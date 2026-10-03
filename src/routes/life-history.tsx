import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { History } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { LifeHistoryList } from "@/components/life-history-list";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLifeHistory } from "@/lib/life-history";

export const Route = createFileRoute("/life-history")({
  head: () => ({
    meta: [
      { title: "Life History — Nexora" },
      { name: "description", content: "A chronological view of your achievements and milestones." },
      { property: "og:title", content: "Life History — Nexora" },
      { property: "og:description", content: "A chronological view of meaningful events." },
    ],
  }),
  component: LifeHistoryPage,
});

function LifeHistoryPage() {
  const history = useLifeHistory();
  const [source, setSource] = useState("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const events = useMemo(() => {
    const filtered = history.events.filter(
      (event) =>
        source === "all" ||
        (source === "achievements"
          ? event.source === "Achievement"
          : event.source === "From your records"),
    );
    return newestFirst ? filtered : [...filtered].reverse();
  }, [history.events, newestFirst, source]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Life History"
          description="A timeline of the milestones you recorded and the progress already in Nexora."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/achievements">Manage achievements</Link>
            </Button>
          }
        />

        <section className="nexora-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-1">
            <h2 className="text-sm font-medium text-foreground">Your timeline</h2>
            <p className="text-xs text-muted-foreground">
              Manually recorded achievements are distinguished from events derived from Nexora.
              Completed records without a completion date use their last-updated date, which is
              identified on the event.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-40" aria-label="Filter timeline source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="achievements">Achievements</SelectItem>
                <SelectItem value="records">Nexora records</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewestFirst((current) => !current)}
            >
              {newestFirst ? "Newest first" : "Oldest first"}
            </Button>
          </div>
        </section>

        <section className="nexora-panel p-4 sm:p-6">
          {history.isLoading ? (
            <LoadingState rows={4} />
          ) : history.isError ? (
            <ErrorState onRetry={() => void history.refetch()} />
          ) : events.length === 0 ? (
            <div className="py-6 text-center">
              <History className="mx-auto h-6 w-6 text-muted-foreground" />
              <h2 className="mt-3 font-medium text-foreground">No milestones to show yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Record a meaningful achievement or keep using Nexora to build your history.
              </p>
              <Button className="mt-4" size="sm" asChild>
                <Link to="/achievements">Record an achievement</Link>
              </Button>
            </div>
          ) : (
            <LifeHistoryList events={events} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
