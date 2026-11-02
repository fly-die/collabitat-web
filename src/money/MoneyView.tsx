import { useEffect, useState, type ReactNode } from "react";
import type { ApiError } from "../api/client";
import type { Expense, Money, NewExpense, NewSettlement, Settlement, Transfer } from "../api/expenses-api";
import type { Household } from "../api/households-api";
import { CountUpAmount } from "../components/CountUpAmount";
import { UNDO_TIMEOUT_MS, UndoBar } from "../components/UndoBar";
import { ItemIcon, iconFor } from "../components/item-icons";
import { Sheet } from "../components/Sheet";
import { ExpenseScreen } from "./ExpenseScreen";
import { SettleUpScreen } from "./SettleUpScreen";
import { formatAmount, formatDay } from "./money-format";
import { myBalance } from "./my-balance";
import { useMoney } from "./useMoney";

interface MoneyViewProps {
  household: Household;
}

type MoneyScreen =
  | { name: "overview" }
  | { name: "add-expense" }
  | { name: "expense"; expense: Expense }
  | { name: "settle-up"; transfer: Transfer };

interface Undoable {
  message: string;
  undo: () => Promise<void>;
}

type NameOf = (memberId: string) => string;

function toNewExpense(expense: Expense): NewExpense {
  return {
    description: expense.description,
    amountCents: expense.amountCents,
    paidByMemberId: expense.paidByMemberId,
    splitBetweenMemberIds: expense.shares.map((share) => share.memberId),
    spentOn: expense.spentOn,
  };
}

function toNewSettlement({ fromMemberId, toMemberId, amountCents, settledOn }: Settlement): NewSettlement {
  return { fromMemberId, toMemberId, amountCents, settledOn };
}

export function MoneyView({ household }: MoneyViewProps) {
  const { state, retry, addExpense, editExpense, removeExpense, settle, removeSettlement } = useMoney();
  const [screen, setScreen] = useState<MoneyScreen>({ name: "overview" });
  const [undoable, setUndoable] = useState<Undoable>();
  const [headlineStartCents, setHeadlineStartCents] = useState<number>();
  const me = household.currentMemberId;
  const nameOf: NameOf = (memberId) =>
    memberId === me ? "You" : (household.members.find((member) => member.id === memberId)?.name ?? "Someone");
  const backToOverview = () => setScreen({ name: "overview" });

  // Settling up is its own page and starts at the top; dialogs leave the list where it was.
  const isSettlingUp = screen.name === "settle-up";
  useEffect(() => {
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
    }
  }, [isSettlingUp]);

  useEffect(() => {
    if (!undoable) {
      return;
    }
    const timeout = setTimeout(() => setUndoable(undefined), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [undoable]);

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
  async function deleteExpense(expense: Expense) {
    await removeExpense(expense.id);
    setUndoable({ message: `${expense.description} deleted.`, undo: () => addExpense(toNewExpense(expense)) });
  }

  const knownSettlementIds = new Set(state.money.settlements.map((settlement) => settlement.id));

  async function markAsPaid(settlement: NewSettlement) {
    const money = await settle(settlement);
    const recorded = money.settlements.find((candidate) => !knownSettlementIds.has(candidate.id));
    backToOverview();
    if (recorded) {
      setUndoable({
        message: `Marked ${formatAmount(recorded.amountCents)} as paid.`,
        undo: () => removeSettlement(recorded.id),
      });
    }
  }

  if (screen.name === "settle-up") {
    return (
      <SettleUpScreen
        transfer={screen.transfer}
        nameOf={nameOf}
        currentMemberId={me}
        onSettle={markAsPaid}
        onBack={backToOverview}
      />
    );
  }

  async function deleteSettlement(settlement: Settlement) {
    await removeSettlement(settlement.id);
    setUndoable({
      message: "Payment deleted.",
      undo: async () => {
        await settle(toNewSettlement(settlement));
      },
    });
  }

  let sheet: ReactNode;
  if (screen.name === "add-expense") {
    sheet = (
      <Sheet label="Add an expense" onClose={backToOverview}>
        <ExpenseScreen household={household} onSave={addExpense} onBack={backToOverview} />
      </Sheet>
    );
  } else if (screen.name === "expense") {
    const { expense } = screen;
    sheet = (
      <Sheet label="Edit expense" onClose={backToOverview}>
        <ExpenseScreen
          household={household}
          expense={expense}
          onSave={async (changes) => {
            await editExpense(expense.id, changes);
            setUndoable({
              message: `${expense.description} changed.`,
              undo: () => editExpense(expense.id, toNewExpense(expense)),
            });
          }}
          onDelete={async () => {
            await deleteExpense(expense);
            backToOverview();
          }}
          onBack={backToOverview}
        />
      </Sheet>
    );
  }

  const currentMoney = state.money;
  function leaveOverview(next: MoneyScreen) {
    setHeadlineStartCents(myBalance(currentMoney.transfers, me, nameOf).cents ?? 0);
    setScreen(next);
  }

  return (
    <>
      <MoneyOverview
      isBehindSheet={sheet !== undefined}
      household={household}
      money={state.money}
      nameOf={nameOf}
      headlineStartCents={headlineStartCents}
      onStartAdding={() => leaveOverview({ name: "add-expense" })}
      onSettleUp={(transfer) => leaveOverview({ name: "settle-up", transfer })}
      onOpenExpense={(expense) => leaveOverview({ name: "expense", expense })}
      onDeleteSettlement={deleteSettlement}
      undoable={undoable}
      onUndo={async (action) => {
        setUndoable(undefined);
        await action.undo();
      }}
    />
      {sheet}
    </>
  );
}

interface HeadlineProps {
  transfers: Transfer[];
  me: string;
  nameOf: NameOf;
  startFromCents?: number;
}

function Headline({ transfers, me, nameOf, startFromCents }: HeadlineProps) {
  const { isOwing, prefix, cents } = myBalance(transfers, me, nameOf);
  return (
    <h1 className={`page-title page-title--large${isOwing ? " page-title--owe" : ""}`}>
      {prefix}
      {cents !== undefined && <CountUpAmount cents={cents} startFromCents={startFromCents} />}
    </h1>
  );
}

function describeTransfer(transfer: Transfer, me: string, nameOf: NameOf) {
  const amount = formatAmount(transfer.amountCents);
  if (transfer.toMemberId === me) {
    return `${nameOf(transfer.fromMemberId)} owes you ${amount}`;
  }
  const verb = transfer.fromMemberId === me ? "owe" : "owes";
  return `${nameOf(transfer.fromMemberId)} ${verb} ${nameOf(transfer.toMemberId)} ${amount}`;
}

function describePayment(settlement: Settlement, me: string, nameOf: NameOf) {
  const recipient = settlement.toMemberId === me ? "you" : nameOf(settlement.toMemberId);
  return `${nameOf(settlement.fromMemberId)} paid ${recipient}`;
}

type HistoryEntry =
  | { kind: "expense"; expense: Expense; day: string; createdAt: string }
  | { kind: "payment"; settlement: Settlement; day: string; createdAt: string };

interface MoneyOverviewProps {
  // A dialog is open over the list: keep it out of reach of taps, keys and screen readers.
  isBehindSheet: boolean;
  household: Household;
  money: Money;
  nameOf: NameOf;
  headlineStartCents?: number;
  onStartAdding: () => void;
  onSettleUp: (transfer: Transfer) => void;
  onOpenExpense: (expense: Expense) => void;
  onDeleteSettlement: (settlement: Settlement) => Promise<void>;
  undoable?: Undoable;
  onUndo: (action: Undoable) => Promise<void>;
}

function MoneyOverview({
  isBehindSheet,
  household,
  money,
  nameOf,
  headlineStartCents,
  onStartAdding,
  onSettleUp,
  onOpenExpense,
  onDeleteSettlement,
  undoable,
  onUndo,
}: MoneyOverviewProps) {
  const [error, setError] = useState<string>();
  const me = household.currentMemberId;
  // Latest day first, and within a day the entry added last.
  const history: HistoryEntry[] = [
    ...money.expenses.map((expense) => ({
      kind: "expense" as const,
      expense,
      day: expense.spentOn,
      createdAt: expense.createdAt,
    })),
    ...money.settlements.map((settlement) => ({
      kind: "payment" as const,
      settlement,
      day: settlement.settledOn,
      createdAt: settlement.createdAt,
    })),
  ].sort(
    (first, second) => second.day.localeCompare(first.day) || second.createdAt.localeCompare(first.createdAt),
  );
  const isHouseholdSquare = money.transfers.length === 0 && history.length > 0;
  // Payments I'm part of come first; the others are there so anyone can record them.
  const involvesMe = (transfer: Transfer) => transfer.fromMemberId === me || transfer.toMemberId === me;
  const transfers = [...money.transfers.filter(involvesMe), ...money.transfers.filter((transfer) => !involvesMe(transfer))];

  async function run(action: () => Promise<void>) {
    setError(undefined);
    try {
      await action();
    } catch (actionError) {
      setError((actionError as ApiError).message);
    }
  }

  function expenseRow(expense: Expense) {
    const myShare = expense.shares.find((share) => share.memberId === me);
    return (
      <li key={expense.id} className="panel__row expense">
        <button className="expense__open" type="button" onClick={() => onOpenExpense(expense)}>
          <ItemIcon name={iconFor(expense.description, "receipt")} />
          <span className="expense__text">
            <span className="expense__description">{expense.description}</span>
            <span className="expense__meta">
              <span>{nameOf(expense.paidByMemberId)} paid</span>
              <span>{formatDay(expense.spentOn)}</span>
              {myShare && <span>Your share {formatAmount(myShare.amountCents)}</span>}
            </span>
          </span>
          <span className="expense__amount">{formatAmount(expense.amountCents)}</span>
        </button>
      </li>
    );
  }

  function paymentRow(settlement: Settlement) {
    const title = describePayment(settlement, me, nameOf);
    return (
      <li key={settlement.id} className="panel__row expense expense--payment">
        <ItemIcon name="payment" />
        <span className="expense__text">
          <span className="expense__description">{title}</span>
          <span className="expense__meta">
            <span>Payment</span>
            <span>{formatDay(settlement.settledOn)}</span>
          </span>
        </span>
        <span className="expense__amount">{formatAmount(settlement.amountCents)}</span>
        <button
          className="button button--quiet expense__delete"
          type="button"
          aria-label={`Delete payment: ${title}`}
          onClick={() => run(() => onDeleteSettlement(settlement))}
        >
          Delete
        </button>
      </li>
    );
  }

  const historyRow = (entry: HistoryEntry) =>
    entry.kind === "payment" ? paymentRow(entry.settlement) : expenseRow(entry.expense);

  return (
    <div className="screen money" inert={isBehindSheet} aria-hidden={isBehindSheet || undefined}>
      <p className="eyebrow">Money</p>
      <Headline transfers={money.transfers} me={me} nameOf={nameOf} startFromCents={headlineStartCents} />
      {isHouseholdSquare && <p className="hint money__square">Everyone in {household.name} is square.</p>}

      <button className="button button--block money__add" type="button" onClick={onStartAdding}>
        Add an expense
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {money.transfers.length > 0 && (
        <section aria-labelledby="settle-up-heading">
          <h2 id="settle-up-heading" className="section-title">
            Settle up
          </h2>
          <ul className="panel" aria-labelledby="settle-up-heading">
            {transfers.map((transfer) => {
              const isMine = transfer.fromMemberId === me;
              return (
                <li
                  key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
                  className={`panel__row transfer${isMine ? " panel__row--owe" : ""}`}
                >
                  <span className="transfer__text">{describeTransfer(transfer, me, nameOf)}</span>
                  <button
                    className={`button transfer__action${isMine ? "" : " button--outline"}`}
                    type="button"
                    onClick={() => onSettleUp(transfer)}
                  >
                    {isMine ? "Settle up" : "Mark paid"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="money__history" aria-labelledby="history-heading">
        <h2 id="history-heading" className="section-title">
          History
        </h2>
        {history.length === 0 ? (
          <p className="empty-state">
            Nothing here yet. Add what you paid for the flat, like groceries or cleaning stuff, and Collabitat works
            out who pays whom.
          </p>
        ) : (
          <ul className="panel" aria-labelledby="history-heading">
            {history.map(historyRow)}
          </ul>
        )}
      </section>

      {undoable && <UndoBar message={undoable.message} onUndo={() => run(() => onUndo(undoable))} />}
    </div>
  );
}
