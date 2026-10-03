import type { Note } from "@/lib/nexora-data";

export type NoteFilters = {
  search: string;
  category: string;
  tag: string;
  archived: boolean;
};

export function filterNotes(notes: Note[], filters: NoteFilters) {
  const normalizedSearch = filters.search.trim().toLocaleLowerCase();
  return notes
    .filter((note) => (note.archived_at !== null) === filters.archived)
    .filter((note) => filters.category === "all" || note.category === filters.category)
    .filter((note) => filters.tag === "all" || note.tags.includes(filters.tag))
    .filter(
      (note) =>
        !normalizedSearch ||
        note.title.toLocaleLowerCase().includes(normalizedSearch) ||
        note.content.toLocaleLowerCase().includes(normalizedSearch),
    )
    .sort(
      (left, right) =>
        Number(right.is_pinned) - Number(left.is_pinned) ||
        right.updated_at.localeCompare(left.updated_at),
    );
}

export function noteCategories(notes: Note[]) {
  return [...new Set(notes.map((note) => note.category))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function noteTags(notes: Note[]) {
  return [...new Set(notes.flatMap((note) => note.tags))].sort((left, right) =>
    left.localeCompare(right),
  );
}
