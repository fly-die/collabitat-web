import { request, safeId } from "./client";

const COLUMN_NOT_FOUND_CODE = "COLUMN_NOT_FOUND";
const ENTRY_NOT_FOUND_CODE = "ENTRY_NOT_FOUND";

// A person or group in the calendar; they don't need an account ("Noah", "Family").
export interface CalendarColumn {
  id: string;
  name: string;
  createdAt: string;
}

export interface CalendarEntry {
  id: string;
  title: string;
  day: string;
  // "HH:MM", or null for the whole day.
  time: string | null;
  // Null means it is for everyone.
  columnId: string | null;
  createdAt: string;
}

export interface NewCalendarEntry {
  title: string;
  day: string;
  time: string | null;
  columnId: string | null;
}

// Four weeks from a day.
export interface CalendarView {
  from: string;
  to: string;
  columns: CalendarColumn[];
  entries: CalendarEntry[];
}

const columnPath = (columnId: string) =>
  `/household/calendar/columns/${safeId(columnId, COLUMN_NOT_FOUND_CODE, "That column doesn't exist anymore.")}`;
const entryPath = (entryId: string) =>
  `/household/calendar/entries/${safeId(entryId, ENTRY_NOT_FOUND_CODE, "That date was removed in the meantime.")}`;

export const calendarApi = {
  view: (from: string) => request<CalendarView>(`/household/calendar?${new URLSearchParams({ from })}`),
  addColumn: (name: string) => request<{ column: CalendarColumn }>("/household/calendar/columns", { method: "POST", body: JSON.stringify({ name }) }),
  removeColumn: (columnId: string) => request<void>(columnPath(columnId), { method: "DELETE" }),
  addEntry: (entry: NewCalendarEntry) =>
    request<{ entry: CalendarEntry }>("/household/calendar/entries", { method: "POST", body: JSON.stringify(entry) }),
  updateEntry: (entryId: string, entry: NewCalendarEntry) =>
    request<{ entry: CalendarEntry }>(entryPath(entryId), { method: "PUT", body: JSON.stringify(entry) }),
  removeEntry: (entryId: string) => request<void>(entryPath(entryId), { method: "DELETE" }),
};
