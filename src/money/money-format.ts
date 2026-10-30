const CENTS_PER_UNIT = 100;
const MILLISECONDS_PER_DAY = 86_400_000;
// Whole amounts up to 6 digits, with an optional "." or "," and up to two decimals.
const AMOUNT_PATTERN = /^(\d{1,6})(?:[.,](\d{1,2}))?$/;

const amountFormat = new Intl.NumberFormat("de-CH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatAmount(cents: number) {
  return amountFormat.format(cents / CENTS_PER_UNIT);
}

// Works on the digits instead of floats, so "0.29" becomes exactly 29 cents.
export function parseAmountCents(input: string): number | undefined {
  const match = AMOUNT_PATTERN.exec(input.trim());
  if (!match) {
    return undefined;
  }
  const [, units, decimals = ""] = match;
  return Number(units) * CENTS_PER_UNIT + Number(decimals.padEnd(2, "0"));
}

export function describeBalance(name: string, isMe: boolean, balanceCents: number) {
  const amount = formatAmount(Math.abs(balanceCents));
  if (balanceCents > 0) {
    return isMe ? `You get back ${amount}` : `${name} gets back ${amount}`;
  }
  if (balanceCents < 0) {
    return isMe ? `You owe ${amount}` : `${name} owes ${amount}`;
  }
  return isMe ? "You're all square" : `${name} is all square`;
}

// The local calendar day, so an expense added late in the evening still counts as today.
export function todayIsoDate(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDay(isoDay: string, now = new Date()) {
  const daysAgo = Math.round(
    (Date.parse(`${todayIsoDate(now)}T00:00:00Z`) - Date.parse(`${isoDay}T00:00:00Z`)) /
      MILLISECONDS_PER_DAY,
  );
  if (daysAgo === 0) {
    return "Today";
  }
  if (daysAgo === 1) {
    return "Yesterday";
  }
  return dayFormat.format(new Date(`${isoDay}T00:00:00Z`));
}
