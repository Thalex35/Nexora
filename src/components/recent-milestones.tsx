import { Link } from "@tanstack/react-router";
import { History } from "lucide-react";

import { LifeHistoryList } from "@/components/life-history-list";
import { Button } from "@/components/ui/button";
import { useLifeHistory } from "@/lib/life-history";

export function RecentMilestones() {
  const history = useLifeHistory();

  return (
    <section className="nexora-panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="h-4 w-4 text-primary" />
          Recent milestones
        </h2>
        <Link to="/life-history" className="text-xs font-medium text-primary hover:underline">
          View life history
        </Link>
      </div>
      {history.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading milestones…</p>
      ) : history.isError ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Couldn't load milestones.</p>
          <Button variant="ghost" size="sm" onClick={() => void history.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <LifeHistoryList
          events={history.events.filter((event) => !event.id.startsWith("task:"))}
          limit={3}
        />
      )}
    </section>
  );
}
