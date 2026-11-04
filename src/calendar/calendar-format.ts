import type { CalendarColumn, CalendarEntry } from "../api/calendar-api";
import { addDays } from "../meals/week";

export const EVERYONE = "Everyone";

const weekdayAndDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

// "Today", "Tomorrow", or "Thu 6 Nov".
export function describeUpcomingDay(isoDay: string, today: string) {
  if (isoDay === today) {
    return "Today";
  }
  if (isoDay === addDays(today, 1)) {
    return "Tomorrow";
  }
  return weekdayAndDate.format(new Date(`${isoDay}T00:00:00Z`));
}

export function columnName(columns: CalendarColumn[], columnId: string | null) {
  return columns.find((column) => column.id === columnId)?.name ?? EVERYONE;
}

// "Noah, 14:30", or just "Everyone" for a whole-day date.
export function describeEntryMeta(columns: CalendarColumn[], entry: CalendarEntry) {
  const who = columnName(columns, entry.columnId);
  return entry.time ? `${who}, ${entry.time}` : who;
}
