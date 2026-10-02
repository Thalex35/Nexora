import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { useSetRoutineCompletion, type Routine, type RoutineCompletion } from "@/lib/nexora-data";

export function RoutineChecklist({
  routines,
  completions,
  completionDate,
}: {
  routines: Routine[];
  completions: RoutineCompletion[];
  completionDate: string;
}) {
  const setCompletion = useSetRoutineCompletion();
  const completedRoutineIds = new Set(
    completions
      .filter((completion) => completion.completion_date === completionDate)
      .map((completion) => completion.routine_id),
  );

  return (
    <ul className="space-y-2">
      {routines.map((routine) => {
        const completed = completedRoutineIds.has(routine.id);
        return (
          <li key={routine.id}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg bg-surface px-3 py-2">
              <Checkbox
                checked={completed}
                disabled={setCompletion.isPending}
                aria-label={`${completed ? "Mark incomplete" : "Complete"} ${routine.name}`}
                className="h-5 w-5"
                onCheckedChange={(checked) =>
                  setCompletion.mutate(
                    {
                      routineId: routine.id,
                      completionDate,
                      completed: checked === true,
                    },
                    {
                      onError: () => toast.error("Couldn't update this routine completion"),
                    },
                  )
                }
              />
              <span
                className={
                  completed
                    ? "min-w-0 flex-1 truncate text-sm text-muted-foreground line-through"
                    : "min-w-0 flex-1 truncate text-sm text-foreground"
                }
              >
                {routine.name}
              </span>
              {completed && <span className="text-xs text-primary">Done</span>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
