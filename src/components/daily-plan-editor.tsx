import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/states";
import { useDailyPlan, useSaveDailyPlan } from "@/lib/nexora-data";

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
  const [values, setValues] = useState(["", "", ""]);
  const [initializedDate, setInitializedDate] = useState<string | null>(null);

  useEffect(() => {
    if (plan.isSuccess && initializedDate !== planDate) {
      setValues([
        plan.data?.priority_1 ?? "",
        plan.data?.priority_2 ?? "",
        plan.data?.priority_3 ?? "",
      ]);
      setInitializedDate(planDate);
    }
  }, [initializedDate, plan.data, plan.isSuccess, planDate]);

  async function save() {
    if (values.some((value) => !value.trim())) {
      toast.error("Add all three priorities before saving");
      return;
    }
    try {
      await savePlan.mutateAsync({
        plan_date: planDate,
        priority_1: values[0].trim(),
        priority_2: values[1].trim(),
        priority_3: values[2].trim(),
      });
      toast.success(`${label} priorities are ready`);
    } catch {
      toast.error("Couldn't save the plan. Please try again.");
    }
  }

  return (
    <section className="nexora-panel p-5">
      <div>
        <h2 className="nexora-label">{label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {plan.isLoading ? (
        <div className="mt-4">
          <LoadingState rows={1} />
        </div>
      ) : plan.isError ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Couldn't load this plan. Refresh the page and try again.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {values.map((value, index) => (
            <label key={index} className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <Input
                required
                aria-label={`Priority ${index + 1}`}
                value={value}
                placeholder={`Priority ${index + 1}`}
                onChange={(event) => {
                  const next = [...values];
                  next[index] = event.target.value;
                  setValues(next);
                }}
              />
            </label>
          ))}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={savePlan.isPending || values.some((value) => !value.trim())}
          >
            {savePlan.isPending ? "Saving…" : `Save ${label.toLowerCase()} plan`}
          </Button>
        </div>
      )}
    </section>
  );
}
