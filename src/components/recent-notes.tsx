import { Link } from "@tanstack/react-router";
import { NotebookPen, Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNotes } from "@/lib/nexora-data";

export function RecentNotes() {
  const notesQuery = useNotes();
  const recentNotes = (notesQuery.data ?? [])
    .filter((note) => note.archived_at === null)
    .sort(
      (left, right) =>
        Number(right.is_pinned) - Number(left.is_pinned) ||
        right.updated_at.localeCompare(left.updated_at),
    )
    .slice(0, 3);

  return (
    <section className="nexora-panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <NotebookPen className="h-4 w-4 text-primary" />
          Notes
        </h2>
        <Link
          to="/notes"
          search={{ noteId: undefined }}
          className="text-xs font-medium text-primary hover:underline"
        >
          All notes
        </Link>
      </div>
      {notesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : notesQuery.isError ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Couldn't load notes.</p>
          <Button variant="ghost" size="sm" onClick={() => void notesQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : recentNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {recentNotes.map((note) => (
            <li key={note.id} className="min-w-0">
              <Link
                to="/notes"
                search={{ noteId: note.id }}
                className="flex items-start gap-2 text-sm text-foreground hover:text-primary"
              >
                {note.is_pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
                <span className="min-w-0 truncate">{note.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
