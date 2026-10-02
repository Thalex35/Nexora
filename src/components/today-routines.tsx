import { Link } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/states";
import { RoutineChecklist } from "@/components/routine-checklist";
import { Button } from "@/components/ui/button";
import { todayISO, useRoutineCompletions, useRoutines } from "@/lib/nexora-data";

export function TodayRoutines() {
  const today = todayISO();
  const routines = useRoutines();
  const completions = useRoutineCompletions(today, today);
  const activeRoutines = (routines.data ?? []).filter((routine) => routine.is_active);
  const visibleRoutines = activeRoutines.slice(0, 4);

  return (
    <section className="nexora-panel min-w-0 space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="h-4 w-4 text-primary" />
          Today's routines
        </h2>
        <Link to="/routines" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {routines.isLoading || completions.isLoading ? (
        <LoadingState rows={2} />
      ) : routines.isError || completions.isError ? (
        <ErrorState onRetry={() => void Promise.all([routines.refetch(), completions.refetch()])} />
      ) : visibleRoutines.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Create a routine to add a steady rhythm.</p>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/routines">Create routine</Link>
          </Button>
        </div>
      ) : (
        <>
          <RoutineChecklist
            routines={visibleRoutines}
            completions={completions.data ?? []}
            completionDate={today}
          />
          {activeRoutines.length > visibleRoutines.length && (
            <p className="text-xs text-muted-foreground">
              Showing {visibleRoutines.length} of {activeRoutines.length} active routines.
            </p>
          )}
        </>
      )}
    </section>
  );
}
