import type { IntervalUnit } from "../api/tasks-api";
import { formatDay, todayIsoDate } from "../money/money-format";

const MILLISECONDS_PER_DAY = 86_400_000;
// Within two weeks "In 9 days" reads easier than a date.
const COUNT_DAYS_UP_TO = 13;

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function daysUntil(isoDay: string, now = new Date()) {
  return Math.round(
    (Date.parse(`${isoDay}T00:00:00Z`) - Date.parse(`${todayIsoDate(now)}T00:00:00Z`)) / MILLISECONDS_PER_DAY,
  );
}

export function describeDue(isoDay: string, now = new Date()) {
  const days = daysUntil(isoDay, now);
  if (days < 0) {
    return `Overdue by ${plural(-days, "day")}`;
  }
  if (days === 0) {
    return "Due today";
  }
  if (days === 1) {
    return "Due tomorrow";
  }
  return days <= COUNT_DAYS_UP_TO ? `In ${days} days` : `Due ${formatDay(isoDay, now)}`;
}

export function describeInterval(every: number, unit: IntervalUnit) {
  return every === 1 ? `Every ${unit}` : `Every ${plural(every, unit)}`;
}
