import { createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";

import { FoundationPage } from "@/components/foundation-page";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — Nexora" },
      {
        name: "description",
        content: "The Nexora Achievements module will keep your accomplishments and milestones.",
      },
      { property: "og:title", content: "Achievements — Nexora" },
      { property: "og:description", content: "Your accomplishments and personal milestones." },
    ],
  }),
  component: () => (
    <FoundationPage
      title="Achievements"
      description="A record of what you have accomplished."
      icon={<Award className="h-5 w-5" />}
      upcoming={[
        "Personal accomplishments worth remembering",
        "Milestones reached on goals and projects",
        "Streaks and consistency over time",
      ]}
    />
  ),
});
