import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DailyPlanEditor } from "@/components/daily-plan-editor";
import { PageHeader } from "@/components/page-header";
import { DailyReview } from "@/components/daily-review";
import { Button } from "@/components/ui/button";
import { dateOffsetISO, todayISO } from "@/lib/nexora-data";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning & Review — Nexora" },
      {
        name: "description",
        content: "Set your priorities for today and tomorrow, then close the day with a review.",
      },
    ],
  }),
  component: PlanningPage,
});

function PlanningPage() {
  const today = todayISO();
  const tomorrow = dateOffsetISO(1);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Plan & review"
          description="Choose what matters tomorrow, then reflect on how today went."
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Today
              </Link>
            </Button>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <DailyPlanEditor
            planDate={today}
            label="Today"
            description="Keep today's three priorities in view."
          />
          <DailyPlanEditor
            planDate={tomorrow}
            label="Tomorrow"
            description="Before you finish today, decide what matters tomorrow."
          />
        </div>
        <DailyReview />
      </div>
    </AppShell>
  );
}
