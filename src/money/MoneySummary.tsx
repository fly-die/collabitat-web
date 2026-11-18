import type { Household } from "../api/households-api";
import { formatAmount } from "./money-format";
import { myBalance } from "./my-balance";
import { useMoney } from "./useMoney";

interface MoneySummaryProps {
  household: Household;
  onOpenMoney: () => void;
}

// One line on Home about where I stand; it stays away until there is money to talk about.
export function MoneySummary({ household, onOpenMoney }: MoneySummaryProps) {
  const { state } = useMoney();
  if (state.status !== "ready" || (state.money.expenses.length === 0 && state.money.settlements.length === 0)) {
    return null;
  }

  const me = household.currentMemberId;
  const nameOf = (memberId: string) =>
    household.members.find((member) => member.id === memberId)?.name ?? "Someone";
  const { isOwing, prefix, cents } = myBalance(state.money.transfers, me, nameOf);

  return (
    <section className="today" aria-labelledby="money-summary-heading">
      <h2 id="money-summary-heading" className="section-title">
        Money
      </h2>
      <button
      className={`money-summary${isOwing ? " money-summary--owe" : ""}`}
      type="button"
      onClick={onOpenMoney}
    >
      <span>
        {prefix}
        {cents !== undefined && formatAmount(cents)}
      </span>
      <span className="money-summary__action">{isOwing ? "Settle up" : "See money"}</span>
      </button>
    </section>
  );
}
