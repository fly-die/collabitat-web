import { describe, expect, it } from "vitest";
import { formatDay, parseAmountCents } from "./money-format";

describe("money format", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12,50", 1250],
    [" 0.29 ", 29],
    ["100000", 10_000_000],
  ])("reads %j as %i cents", (input, cents) => {
    expect(parseAmountCents(input)).toBe(cents);
  });

  it.each(["", "abc", "12.505", "-5", "1'200", "1234567"])("rejects %j", (input) => {
    expect(parseAmountCents(input)).toBeUndefined();
  });

  it("names recent days and dates older ones", () => {
    const now = new Date(2026, 9, 30, 23, 30);

    expect(formatDay("2026-10-30", now)).toBe("Today");
    expect(formatDay("2026-10-29", now)).toBe("Yesterday");
    expect(formatDay("2026-10-26", now)).toBe("Mon 26 Oct");
  });
});
