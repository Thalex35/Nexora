import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/states";
import { getDayPlanPriorities } from "@/lib/planning";
import { todayISO, useDailyPlan, useSaveDailyPlan } from "@/lib/nexora-data";

export function DailyPlanEditor({
  planDate,
  label,
  description,
}: {
  planDate: string;
  label: string;
  description: string;
}) {
  const plan = useDailyPlan(planDate);
  const savePlan = useSaveDailyPlan();
  const [values, setValues] = useState<string[]>([]);
  const [initializedDate, setInitializedDate] = useState<string | null>(null);
  const [today, setToday] = useState(todayISO);
  const readOnly = planDate < today;

  useEffect(() => {
    if (plan.isSuccess && initializedDate !== planDate) {
      setValues(getDayPlanPriorities(plan.data));
      setInitializedDate(planDate);
    }
  }, [initializedDate, plan.data, plan.isSuccess, planDate]);

  useEffect(() => {
    let timeout: number;
    const scheduleLocalMidnightUpdate = () => {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 50);
      timeout = window.setTimeout(
        () => {
          setToday(todayISO());
          scheduleLocalMidnightUpdate();
        },
        Math.max(0, nextMidnight.getTime() - Date.now()),
      );
    };
    const refreshToday = () => setToday(todayISO());

    scheduleLocalMidnightUpdate();
    window.addEventListener("focus", refreshToday);
    document.addEventListener("visibilitychange", refreshToday);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("focus", refreshToday);
      document.removeEventListener("visibilitychange", refreshToday);
    };
  }, []);

  async function save() {
    if (planDate < todayISO()) {
      setToday(todayISO());
      toast.error("Past daily priorities are read-only");
      return;
    }
    const priorities = values.map((value) => value.trim()).filter(Boolean);
    try {
      await savePlan.mutateAsync({
        plan_date: planDate,
        priorities,
        priority_1: priorities[0] ?? null,
        priority_2: priorities[1] ?? null,
        priority_3: priorities[2] ?? null,
      });
      setValues(priorities);
      toast.success(`${label} priorities are ready`);
    } catch {
      toast.error("Couldn't save the plan. Please try again.");
    }
  }

  function updateValue(index: number, value: string) {
    setValues((current) =>
      current.map((priority, currentIndex) => (currentIndex === index ? value : priority)),
    );
  }

  function moveValue(index: number, offset: -1 | 1) {
    setValues((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      const [priority] = next.splice(index, 1);
      if (priority === undefined) return current;
      next.splice(target, 0, priority);
      return next;
    });
  }

  return (
    <section className="nexora-panel p-5">
      <div>
        <h2 className="nexora-label">{label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {readOnly
            ? "Past priorities are saved for reference and cannot be changed."
            : `${planDate === today ? "Today is editable." : "Future dates are editable."} ${description}`}
        </p>
      </div>
      {plan.isLoading ? (
        <div className="mt-4">
          <LoadingState rows={1} />
        </div>
      ) : plan.isError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Couldn't load this plan. Refresh the page and try again.
        </p>
      ) : readOnly ? (
        <div className="mt-4">
          {getDayPlanPriorities(plan.data).length === 0 ? (
            <p className="text-sm text-muted-foreground">No priorities were saved for this date.</p>
          ) : (
            <ol className="space-y-2">
              {getDayPlanPriorities(plan.data).map((priority, index) => (
                <li
                  key={`${priority}-${index}`}
                  className="flex items-start gap-3 text-sm text-foreground"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="pt-1">{priority}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {values.length === 0 ? (
            <p className="text-sm text-muted-foreground">No priorities added yet.</p>
          ) : (
            values.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <Input
                  aria-label={`Priority ${index + 1}`}
                  value={value}
                  placeholder={`Priority ${index + 1}`}
                  onChange={(event) => updateValue(index, event.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move priority ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => moveValue(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move priority ${index + 1} down`}
                  disabled={index === values.length - 1}
                  onClick={() => moveValue(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove priority ${index + 1}`}
                  onClick={() =>
                    setValues((current) =>
                      current.filter((_, currentIndex) => currentIndex !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setValues((current) => [...current, ""])}
            >
              <Plus className="mr-1 h-4 w-4" /> Add priority
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={savePlan.isPending}>
              {savePlan.isPending ? "Saving…" : `Save ${label.toLowerCase()} plan`}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
