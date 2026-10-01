import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";

import { FoundationPage } from "@/components/foundation-page";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Nexora" },
      {
        name: "description",
        content: "The Nexora Notes module will hold your personal notes and ideas.",
      },
      { property: "og:title", content: "Notes — Nexora" },
      { property: "og:description", content: "A personal space for your notes and ideas." },
    ],
  }),
  component: () => (
    <FoundationPage
      title="Notes"
      description="A personal space for thinking."
      icon={<NotebookPen className="h-5 w-5" />}
      upcoming={[
        "Quick notes captured anywhere in Nexora",
        "Ideas you want to return to later",
        "Notes linked to goals, projects and tasks",
      ]}
    />
  ),
});
