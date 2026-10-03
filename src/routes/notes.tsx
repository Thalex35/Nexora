import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Pin, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NoteDialog } from "@/components/note-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteNote, useNotes, useUpdateNote, type Note } from "@/lib/nexora-data";
import { filterNotes, noteCategories, noteTags } from "@/lib/notes";

export const Route = createFileRoute("/notes")({
  validateSearch: (search: Record<string, unknown>) => ({
    noteId: typeof search["noteId"] === "string" ? search["noteId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Notes — Nexora" },
      { name: "description", content: "Capture, organize, and find your notes." },
      { property: "og:title", content: "Notes — Nexora" },
      { property: "og:description", content: "A personal space for your notes and ideas." },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { noteId } = Route.useSearch();
  const navigate = useNavigate();
  const notesQuery = useNotes();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Note | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const currentSet = notes.filter((note) => (note.archived_at !== null) === showArchived);
  const categories = noteCategories(currentSet);
  const tags = noteTags(currentSet);
  const visibleNotes = useMemo(
    () => filterNotes(notes, { search, category, tag, archived: showArchived }),
    [notes, search, category, tag, showArchived],
  );

  useEffect(() => {
    if (!noteId || !notesQuery.data) return;
    const linkedNote = notesQuery.data.find((note) => note.id === noteId);
    if (linkedNote) {
      setSelected(linkedNote);
      setDialogOpen(true);
    }
  }, [noteId, notesQuery.data]);

  function openNote(note: Note | null) {
    setSelected(note);
    setDialogOpen(true);
    if (note) {
      void navigate({ to: "/notes", search: { noteId: note.id }, replace: true });
    }
  }

  function closeNoteDialog(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setSelected(null);
      if (noteId) void navigate({ to: "/notes", search: { noteId: undefined }, replace: true });
    }
  }

  async function updateNoteRecord(
    note: Note,
    values: { is_pinned?: boolean; archived_at?: string | null },
  ) {
    try {
      await updateNote.mutateAsync({ id: note.id, ...values });
      if (values.archived_at !== undefined) {
        toast.success(values.archived_at ? "Note archived" : "Note restored");
      } else {
        toast.success(values.is_pinned ? "Note pinned" : "Note unpinned");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update this note.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteNote.mutateAsync(deleting.id);
      toast.success("Note deleted");
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete this note.");
    }
  }

  const activeCount = notes.filter((note) => note.archived_at === null).length;
  const archivedCount = notes.length - activeCount;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Notes"
          description="A calm place for ideas, references, and things to return to."
          actions={
            <Button size="sm" onClick={() => openNote(null)}>
              <Plus className="mr-1 h-4 w-4" />
              New note
            </Button>
          }
        />

        <section className="nexora-panel space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={!showArchived ? "secondary" : "ghost"}
              onClick={() => {
                setShowArchived(false);
                setCategory("all");
                setTag("all");
              }}
            >
              Notes <span className="ml-1 text-xs text-muted-foreground">{activeCount}</span>
            </Button>
            <Button
              size="sm"
              variant={showArchived ? "secondary" : "ghost"}
              onClick={() => {
                setShowArchived(true);
                setCategory("all");
                setTag("all");
              }}
            >
              Archived <span className="ml-1 text-xs text-muted-foreground">{archivedCount}</span>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search notes"
                placeholder="Search title and content…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Filter notes by category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger aria-label="Filter notes by tag">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tags.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {notesQuery.isLoading ? (
          <LoadingState rows={3} />
        ) : notesQuery.isError ? (
          <ErrorState onRetry={() => void notesQuery.refetch()} />
        ) : visibleNotes.length === 0 ? (
          <EmptyState
            icon={showArchived ? <Archive className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            title={
              showArchived
                ? "No archived notes"
                : notes.length
                  ? "No notes match these filters"
                  : "Start with a note"
            }
            description={
              showArchived
                ? "Archived notes stay here until you restore or delete them."
                : notes.length
                  ? "Try another search, category, or tag."
                  : "Capture an idea or reference, then organize it with categories and tags."
            }
            {...(!showArchived && !notes.length
              ? { actionLabel: "Create a note", onAction: () => openNote(null) }
              : {})}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleNotes.map((note) => (
              <article key={note.id} className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/notes"
                      search={{ noteId: note.id }}
                      className="break-words font-semibold text-foreground hover:text-primary"
                    >
                      {note.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Updated{" "}
                      {new Date(note.updated_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {note.is_pinned && <Pin className="h-4 w-4 text-primary" aria-label="Pinned" />}
                    <Badge variant="secondary">{note.category}</Badge>
                  </div>
                </div>
                <Link
                  to="/notes"
                  search={{ noteId: note.id }}
                  className="block min-h-10 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground hover:text-foreground"
                >
                  {note.content || "No content"}
                </Link>
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {note.tags.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTag(value)}
                        className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-primary"
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-1 border-t border-border pt-2">
                  {showArchived ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={updateNote.isPending}
                      onClick={() => void updateNoteRecord(note, { archived_at: null })}
                    >
                      <ArchiveRestore className="mr-1 h-4 w-4" /> Restore
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updateNote.isPending}
                        aria-label={note.is_pinned ? `Unpin ${note.title}` : `Pin ${note.title}`}
                        onClick={() => void updateNoteRecord(note, { is_pinned: !note.is_pinned })}
                      >
                        <Pin className="mr-1 h-4 w-4" />
                        {note.is_pinned ? "Unpin" : "Pin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={updateNote.isPending}
                        onClick={() =>
                          void updateNoteRecord(note, { archived_at: new Date().toISOString() })
                        }
                      >
                        <Archive className="mr-1 h-4 w-4" /> Archive
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Delete ${note.title}`}
                    onClick={() => setDeleting(note)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <NoteDialog
        open={dialogOpen}
        onOpenChange={closeNoteDialog}
        note={selected}
        categories={categories}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this note?"
        description="This permanently deletes only the note. Any linked Goals, Projects, Tasks, or Learning items will remain unchanged."
        confirmLabel={deleteNote.isPending ? "Deleting…" : "Delete note"}
        onConfirm={() => void confirmDelete()}
      />
    </AppShell>
  );
}
