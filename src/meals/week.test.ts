import { describe, expect, it } from "vitest";
import { describeWeek, mondayOf } from "./week";

describe("week", () => {
  it.each([
    ["2026-11-03", "2026-11-02"],
    ["2026-11-08", "2026-11-02"],
    ["2026-11-09", "2026-11-09"],
  ])("finds the Monday of %s", (day, monday) => {
    expect(mondayOf(day)).toBe(monday);
  });

  it.each([
    ["2026-11-02", "2 to 8 November"],
    ["2026-11-30", "30 November to 6 December"],
  ])("names the week from %s", (monday, name) => {
    expect(describeWeek(monday)).toBe(name);
  });
});
