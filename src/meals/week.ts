import type { Ingredient } from "../api/meals-api";

const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;
export const DAYS_IN_WEEK = 7;
// getUTCDay counts from Sunday; the week here starts on Monday.
const DAYS_FROM_MONDAY = [6, 0, 1, 2, 3, 4, 5];

export function addDays(isoDay: string, days: number) {
  return new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * MILLISECONDS_PER_DAY).toISOString().slice(0, ISO_DATE_LENGTH);
}

export function mondayOf(isoDay: string) {
  return addDays(isoDay, -DAYS_FROM_MONDAY[new Date(`${isoDay}T00:00:00Z`).getUTCDay()]);
}

export function weekDays(monday: string) {
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(monday, index));
}

const dayAndMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const dayOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });

// "2 to 8 November", or "30 November to 6 December" across a month end.
export function describeWeek(monday: string) {
  const sunday = addDays(monday, DAYS_IN_WEEK - 1);
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(`${sunday}T00:00:00Z`);
  const startText = start.getUTCMonth() === end.getUTCMonth() ? dayOnly.format(start) : dayAndMonth.format(start);
  return `${startText} to ${dayAndMonth.format(end)}`;
}

const quantityFormat = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });

export function describeIngredient({ quantity, unit, name }: Ingredient) {
  return [quantity === null ? "" : quantityFormat.format(quantity), unit ?? "", name].filter(Boolean).join(" ");
}

// Back to the lines it was typed as, so undoing a deleted recipe saves the same one again.
export const ingredientLine = describeIngredient;
