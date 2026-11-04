import { request, safeId } from "./client";

const NOTE_NOT_FOUND_CODE = "NOTE_NOT_FOUND";

// A quick note for the whole household; ticked off, it is a done todo.
export interface Note {
  id: string;
  text: string;
  // Null once the author left the household.
  authorMemberId: string | null;
  doneAt: string | null;
  createdAt: string;
}

const notePath = (noteId: string) => `/household/notes/${safeId(noteId, NOTE_NOT_FOUND_CODE, "That note was removed in the meantime.")}`;

export const notesApi = {
  list: () => request<{ notes: Note[] }>("/household/notes"),
  // done puts back a note that was cleared while ticked.
  add: (text: string, done = false) => request<{ note: Note }>("/household/notes", { method: "POST", body: JSON.stringify({ text, done }) }),
  setDone: (noteId: string, done: boolean) => request<{ note: Note }>(`${notePath(noteId)}/done`, { method: "PUT", body: JSON.stringify({ done }) }),
  remove: (noteId: string) => request<void>(notePath(noteId), { method: "DELETE" }),
  clearDone: () => request<{ removed: Note[] }>("/household/notes/done", { method: "DELETE" }),
};
