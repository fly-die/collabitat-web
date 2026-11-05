import { describe, expect, it } from "vitest";
import { describeDue, describeInterval, startWithFewestTurns } from "./chore-format";

const SUNDAY_EVENING = new Date(2026, 10, 1, 21, 30);

describe("chore wording", () => {
  it.each([
    ["2026-10-30", "Overdue by 2 days"],
    ["2026-10-31", "Overdue by 1 day"],
    ["2026-11-01", "Due today"],
    ["2026-11-02", "Due tomorrow"],
    ["2026-11-14", "In 13 days"],
    ["2026-11-15", "Due Sun 15 Nov"],
  ])("says when %s is due", (isoDay, expected) => {
    expect(describeDue(isoDay, SUNDAY_EVENING)).toBe(expected);
  });

  it.each([
    [1, "day", "Every day"],
    [1, "week", "Every week"],
    [2, "week", "Every 2 weeks"],
    [3, "month", "Every 3 months"],
  ] as const)("says every %i %s as %j", (every, unit, expected) => {
    expect(describeInterval(every, unit)).toBe(expected);
  });
});

describe("first turns", () => {
  const turns = (...memberIds: (string | null)[]) => memberIds.map((turnMemberId) => ({ turnMemberId }));

  it.each([
    [["mia", "lea", "noah"], turns(), ["mia", "lea", "noah"]],
    [["mia", "lea", "noah"], turns("mia"), ["lea", "noah", "mia"]],
    [["mia", "lea", "noah"], turns("mia", "lea", "mia", null), ["noah", "mia", "lea"]],
    [["lea"], turns("lea", "lea"), ["lea"]],
    [[], turns("mia"), []],
  ])("turns %j with current turns %j start as %j", (rotation, tasks, expected) => {
    expect(startWithFewestTurns(rotation, tasks)).toEqual(expected);
  });
});
