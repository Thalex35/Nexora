import { Link } from "@tanstack/react-router";
import { Award, BookOpen, CheckCircle2, History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatPlanningDate } from "@/lib/planning";
import type { LifeHistoryEvent } from "@/lib/life-history";

export function LifeHistoryList({ events, limit }: { events: LifeHistoryEvent[]; limit?: number }) {
  const visibleEvents = limit ? events.slice(0, limit) : events;
  if (visibleEvents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Milestones will appear here as they happen.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {visibleEvents.map((event) => (
        <li key={event.id} className="flex min-w-0 gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            {event.source === "Achievement" ? (
              <Award className="h-4 w-4" />
            ) : event.id.startsWith("learning-session:") ? (
              <BookOpen className="h-4 w-4" />
            ) : event.id.startsWith("routine-streak:") ? (
              <History className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <EventLink event={event}>
                <span className="text-sm font-medium text-foreground">{event.title}</span>
              </EventLink>
              <Badge variant="outline" className="text-[10px]">
                {event.source}
              </Badge>
            </div>
            {event.detail && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{event.detail}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatPlanningDate(event.date, { day: "numeric", month: "short", year: "numeric" })}
              {event.dateNote && <span> · {event.dateNote}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function EventLink({ event, children }: { event: LifeHistoryEvent; children: React.ReactNode }) {
  switch (event.link.type) {
    case "achievement":
      return (
        <Link to="/achievements" className="min-w-0 hover:text-primary">
          {children}
        </Link>
      );
    case "goal":
      return (
        <Link
          to="/goals/$goalId"
          params={{ goalId: event.link.id }}
          className="min-w-0 hover:text-primary"
        >
          {children}
        </Link>
      );
    case "project":
      return (
        <Link
          to="/projects/$projectId"
          params={{ projectId: event.link.id }}
          search={{ goalId: undefined }}
          className="min-w-0 hover:text-primary"
        >
          {children}
        </Link>
      );
    case "learning":
      return (
        <Link
          to="/learning/$learningId"
          params={{ learningId: event.link.id }}
          className="min-w-0 hover:text-primary"
        >
          {children}
        </Link>
      );
    case "learning-list":
      return (
        <Link to="/learning" className="min-w-0 hover:text-primary">
          {children}
        </Link>
      );
    case "task":
      return (
        <Link to="/tasks" className="min-w-0 hover:text-primary">
          {children}
        </Link>
      );
    case "routine":
      return (
        <Link to="/routines" className="min-w-0 hover:text-primary">
          {children}
        </Link>
      );
  }
}
