import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { FoundationPage } from "@/components/foundation-page";

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title: "Learning — Nexora" },
      {
        name: "description",
        content: "The Nexora Learning module will track your skills, courses, topics and progress.",
      },
      { property: "og:title", content: "Learning — Nexora" },
      { property: "og:description", content: "Skills, courses, topics and learning progress." },
    ],
  }),
  component: () => (
    <FoundationPage
      title="Learning"
      description="Where your skills and study will live."
      icon={<BookOpen className="h-5 w-5" />}
      upcoming={[
        "Skills you are developing, with levels and momentum",
        "Courses and study resources in progress",
        "Topics you want to explore next",
        "Learning progress over time",
      ]}
    />
  ),
});
