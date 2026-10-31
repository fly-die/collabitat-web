import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import type { Expense, Money, NewExpense } from "../api/expenses-api";
import type { Household } from "../api/households-api";
import { UNDO_TIMEOUT_MS } from "../components/UndoBar";
import { AddExpenseScreen } from "./AddExpenseScreen";
import { describeBalance, formatAmount, formatDay } from "./money-format";
import { useMoney } from "./useMoney";

interface MoneyViewProps {
  household: Household;
}

function toNewExpense(expense: Expense): NewExpense {
  return {
    description: expense.description,
    amountCents: expense.amountCents,
    paidByMemberId: expense.paidByMemberId,
    splitBetweenMemberIds: expense.shares.map((share) => share.memberId),
    spentOn: expense.spentOn,
  };
}

export function MoneyView({ household }: MoneyViewProps) {
  const { state, retry, addExpense, removeExpense } = useMoney();
  const [isAdding, setIsAdding] = useState(false);

  if (state.status === "loading") {
    return <p className="screen hint">Adding things up…</p>;
  }
  if (state.status === "unreachable") {
    return (
      <div className="screen">
        <p role="alert">{state.message}</p>
        <button className="button" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }
  if (isAdding) {
    return <AddExpenseScreen household={household} onAdd={addExpense} onBack={() => setIsAdding(false)} />;
  }
  return (
    <MoneyOverview
      household={household}
      money={state.money}
      onAddExpense={addExpense}
      onRemoveExpense={removeExpense}
      onStartAdding={() => setIsAdding(true)}
    />
  );
}

interface MoneyOverviewProps {
  household: Household;
  money: Money;
  onAddExpense: (expense: NewExpense) => Promise<void>;
  onRemoveExpense: (expenseId: string) => Promise<void>;
  onStartAdding: () => void;
}

function MoneyOverview({ household, money, onAddExpense, onRemoveExpense, onStartAdding }: MoneyOverviewProps) {
  const [deletedExpense, setDeletedExpense] = useState<Expense>();
  const [error, setError] = useState<string>();
  const me = household.currentMemberId;
  const nameOf = (memberId: string) =>
    memberId === me ? "You" : (household.members.find((member) => member.id === memberId)?.name ?? "Someone");
  const myBalance = money.balances.find((balance) => balance.memberId === me)?.balanceCents ?? 0;
  const otherBalances = money.balances.filter((balance) => balance.memberId !== me);

  useEffect(() => {
    if (!deletedExpense) {
      return;
    }
    const timeout = setTimeout(() => setDeletedExpense(undefined), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [deletedExpense]);

  async function run(action: () => Promise<void>) {
    setError(undefined);
    try {
      await action();
    } catch (actionError) {
      setError((actionError as ApiError).message);
    }
  }

  const deleteExpense = (expense: Expense) =>
    run(async () => {
      await onRemoveExpense(expense.id);
      setDeletedExpense(expense);
    });

  const undoDelete = (expense: Expense) =>
    run(async () => {
      setDeletedExpense(undefined);
      await onAddExpense(toNewExpense(expense));
    });

  return (
    <div className="screen money">
      <p className="eyebrow">Money</p>
      <h1 className={`page-title page-title--large${myBalance < 0 ? " page-title--owe" : ""}`}>
        {describeBalance("You", true, myBalance)}
      </h1>

      <button className="button button--block money__add" type="button" onClick={onStartAdding}>
        Add an expense
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {otherBalances.length > 0 && (
        <section aria-labelledby="balances-heading">
          <h2 id="balances-heading" className="section-title">
            Flatmates
          </h2>
          <ul className="panel" aria-labelledby="balances-heading">
            {otherBalances.map((balance) => (
              <li
                key={balance.memberId}
                className={`panel__row${balance.balanceCents < 0 ? " panel__row--owe" : ""}`}
              >
                {describeBalance(nameOf(balance.memberId), false, balance.balanceCents)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="expenses-heading">
        <h2 id="expenses-heading" className="section-title">
          Expenses
        </h2>
        {money.expenses.length === 0 ? (
          <p className="empty-state">
            Nothing here yet. Add what you paid for the flat, like groceries or cleaning stuff, and
            Collabitat keeps track of who owes what.
          </p>
        ) : (
          <ul className="panel" aria-labelledby="expenses-heading">
            {money.expenses.map((expense) => (
              <li key={expense.id} className="panel__row expense">
                <span className="expense__text">
                  <span className="expense__description">{expense.description}</span>
                  <span className="expense__meta">
                    <span>{nameOf(expense.paidByMemberId)} paid</span>
                    <span>{formatDay(expense.spentOn)}</span>
                  </span>
                </span>
                <span className="expense__amount">{formatAmount(expense.amountCents)}</span>
                <button
                  className="button button--quiet expense__delete"
                  type="button"
                  aria-label={`Delete ${expense.description}`}
                  onClick={() => deleteExpense(expense)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deletedExpense && (
        <div className="undo-bar" role="status">
          <span>{deletedExpense.description} deleted.</span>
          <button className="button button--on-dark" type="button" onClick={() => undoDelete(deletedExpense)}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
