import { useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { NewSettlement, Transfer } from "../api/expenses-api";
import { formatAmount, parseAmountCents, todayIsoDate } from "./money-format";

interface SettleUpScreenProps {
  transfer: Transfer;
  nameOf: (memberId: string) => string;
  currentMemberId: string;
  onSettle: (settlement: NewSettlement) => Promise<void>;
  onBack: () => void;
}

function titleOf(transfer: Transfer, nameOf: (memberId: string) => string, currentMemberId: string) {
  if (transfer.fromMemberId === currentMemberId) {
    return `Pay ${nameOf(transfer.toMemberId)}`;
  }
  if (transfer.toMemberId === currentMemberId) {
    return `${nameOf(transfer.fromMemberId)} pays you`;
  }
  return `${nameOf(transfer.fromMemberId)} pays ${nameOf(transfer.toMemberId)}`;
}

export function SettleUpScreen({ transfer, nameOf, currentMemberId, onSettle, onBack }: SettleUpScreenProps) {
  const fieldId = useId();
  const [amount, setAmount] = useState(() => formatAmount(transfer.amountCents).replaceAll("’", ""));
  const [settledOn, setSettledOn] = useState(() => todayIsoDate());
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amountCents = parseAmountCents(amount);
    if (!amountCents) {
      setError("Enter an amount like 12.50.");
      return;
    }
    if (amountCents > transfer.amountCents) {
      setError(`That's more than the ${formatAmount(transfer.amountCents)} owed.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSettle({ ...transfer, amountCents, settledOn });
    } catch (settleError) {
      setError((settleError as ApiError).message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Back
      </button>
      <h1 className="page-title">{titleOf(transfer, nameOf, currentMemberId)}</h1>
      <p className="intro">Mark it as paid once the money has moved, for example by TWINT or bank transfer.</p>

      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor={`${fieldId}-amount`}>
          Amount
        </label>
        <input
          id={`${fieldId}-amount`}
          className="text-input text-input--amount"
          value={amount}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${fieldId}-hint`}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(undefined);
          }}
        />
        <p id={`${fieldId}-hint`} className="field-hint">
          Paid less? Change the amount and the rest stays open.
        </p>

        <label className="field-label" htmlFor={`${fieldId}-date`}>
          Date
        </label>
        <input
          id={`${fieldId}-date`}
          className="text-input"
          type="date"
          value={settledOn}
          onChange={(event) => setSettledOn(event.target.value || todayIsoDate())}
        />

        <button className="button button--block button--submit" type="submit" disabled={isSubmitting}>
          Mark as paid
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
