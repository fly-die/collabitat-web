import { describe, expect, it } from "vitest";
import { formatDay, parseAmountCents } from "./money-format";

describe("money format", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12,50", 1250],
    [" 0.29 ", 29],
    ["100000", 10_000_000],
    ["CHF 20", 2000],
    ["Fr. 12.50", 1250],
    ["20 chf", 2000],
    ["20.-", 2000],
    ["15,–", 1500],
    ["1'200.50", 120_050],
    ["1’200", 120_000],
  ])("reads %j as %i cents", (input, cents) => {
    expect(parseAmountCents(input)).toBe(cents);
  });

  it.each(["", "abc", "CHF", "12.505", "-5", "1,200.50", "1234567", "EUR 20"])("rejects %j", (input) => {
    expect(parseAmountCents(input)).toBeUndefined();
  });

  it("names recent days and dates older ones", () => {
    const now = new Date(2026, 9, 30, 23, 30);

    expect(formatDay("2026-10-30", now)).toBe("Today");
    expect(formatDay("2026-10-29", now)).toBe("Yesterday");
    expect(formatDay("2026-10-26", now)).toBe("Mon 26 Oct");
  });
});
