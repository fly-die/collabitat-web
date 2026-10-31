import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import type { Expense, Money, NewExpense, NewSettlement, Settlement, Transfer } from "../api/expenses-api";
import type { Household } from "../api/households-api";
import { CountUpAmount } from "../components/CountUpAmount";
import { UNDO_TIMEOUT_MS, UndoBar } from "../components/UndoBar";
import { AddExpenseScreen } from "./AddExpenseScreen";
import { SettleUpScreen } from "./SettleUpScreen";
import { formatAmount, formatDay } from "./money-format";
import { useMoney } from "./useMoney";

interface MoneyViewProps {
  household: Household;
}

type MoneyScreen = { name: "overview" } | { name: "add-expense" } | { name: "settle-up"; transfer: Transfer };

interface Undoable {
  message: string;
  undo: () => Promise<void>;
}

type NameOf = (memberId: string) => string;

// After simplifying, nobody both owes and is owed, so this is what my headline shows.
function myHeadlineCents(transfers: Transfer[], me: string) {
  return transfers
    .filter((transfer) => transfer.fromMemberId === me || transfer.toMemberId === me)
    .reduce((sum, transfer) => sum + transfer.amountCents, 0);
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

function toNewSettlement({ fromMemberId, toMemberId, amountCents, settledOn }: Settlement): NewSettlement {
  return { fromMemberId, toMemberId, amountCents, settledOn };
}

export function MoneyView({ household }: MoneyViewProps) {
  const { state, retry, addExpense, removeExpense, settle, removeSettlement } = useMoney();
  const [screen, setScreen] = useState<MoneyScreen>({ name: "overview" });
  const [undoable, setUndoable] = useState<Undoable>();
  const [headlineStartCents, setHeadlineStartCents] = useState<number>();
  const me = household.currentMemberId;
  const nameOf: NameOf = (memberId) =>
    memberId === me ? "You" : (household.members.find((member) => member.id === memberId)?.name ?? "Someone");
  const backToOverview = () => setScreen({ name: "overview" });

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
  if (screen.name === "add-expense") {
    return <AddExpenseScreen household={household} onAdd={addExpense} onBack={backToOverview} />;
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

  async function deleteExpense(expense: Expense) {
    await removeExpense(expense.id);
    setUndoable({ message: `${expense.description} deleted.`, undo: () => addExpense(toNewExpense(expense)) });
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

  const currentMoney = state.money;
  function leaveOverview(next: MoneyScreen) {
    setHeadlineStartCents(myHeadlineCents(currentMoney.transfers, me));
    setScreen(next);
  }

  return (
    <MoneyOverview
      household={household}
      money={state.money}
      nameOf={nameOf}
      headlineStartCents={headlineStartCents}
      onStartAdding={() => leaveOverview({ name: "add-expense" })}
      onSettleUp={(transfer) => leaveOverview({ name: "settle-up", transfer })}
      onDeleteExpense={deleteExpense}
      onDeleteSettlement={deleteSettlement}
      undoable={undoable}
      onUndo={async (action) => {
        setUndoable(undefined);
        await action.undo();
      }}
    />
  );
}

interface HeadlineProps {
  transfers: Transfer[];
  me: string;
  nameOf: NameOf;
  startFromCents?: number;
}

function Headline({ transfers, me, nameOf, startFromCents }: HeadlineProps) {
  const owing = transfers.filter((transfer) => transfer.fromMemberId === me);
  const owed = transfers.filter((transfer) => transfer.toMemberId === me);
  const total = myHeadlineCents(transfers, me);

  if (owing.length > 0) {
    const prefix = owing.length === 1 ? `You owe ${nameOf(owing[0].toMemberId)} ` : "You owe ";
    return (
      <h1 className="page-title page-title--large page-title--owe">
        {prefix}
        <CountUpAmount cents={total} startFromCents={startFromCents} />
      </h1>
    );
  }
  if (owed.length > 0) {
    const prefix = owed.length === 1 ? `${nameOf(owed[0].fromMemberId)} owes you ` : "You get back ";
    return (
      <h1 className="page-title page-title--large">
        {prefix}
        <CountUpAmount cents={total} startFromCents={startFromCents} />
      </h1>
    );
  }
  return <h1 className="page-title page-title--large">You're all square</h1>;
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
  household: Household;
  money: Money;
  nameOf: NameOf;
  headlineStartCents?: number;
  onStartAdding: () => void;
  onSettleUp: (transfer: Transfer) => void;
  onDeleteExpense: (expense: Expense) => Promise<void>;
  onDeleteSettlement: (settlement: Settlement) => Promise<void>;
  undoable?: Undoable;
  onUndo: (action: Undoable) => Promise<void>;
}

function MoneyOverview({
  household,
  money,
  nameOf,
  headlineStartCents,
  onStartAdding,
  onSettleUp,
  onDeleteExpense,
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

  function historyRow(entry: HistoryEntry) {
    const isPayment = entry.kind === "payment";
    const id = isPayment ? entry.settlement.id : entry.expense.id;
    const title = isPayment ? describePayment(entry.settlement, me, nameOf) : entry.expense.description;
    const detail = isPayment ? "Payment" : `${nameOf(entry.expense.paidByMemberId)} paid`;
    const amountCents = isPayment ? entry.settlement.amountCents : entry.expense.amountCents;
    const onDelete = () =>
      run(() => (isPayment ? onDeleteSettlement(entry.settlement) : onDeleteExpense(entry.expense)));
    return (
      <li key={id} className={`panel__row expense${isPayment ? " expense--payment" : ""}`}>
        <span className="expense__text">
          <span className="expense__description">{title}</span>
          <span className="expense__meta">
            <span>{detail}</span>
            <span>{formatDay(entry.day)}</span>
          </span>
        </span>
        <span className="expense__amount">{formatAmount(amountCents)}</span>
        <button
          className="button button--quiet expense__delete"
          type="button"
          aria-label={isPayment ? `Delete payment: ${title}` : `Delete ${title}`}
          onClick={onDelete}
        >
          Delete
        </button>
      </li>
    );
  }

  return (
    <div className="screen money">
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

      <section aria-labelledby="history-heading">
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
