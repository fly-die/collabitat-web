import { useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { Expense, NewExpense } from "../api/expenses-api";
import type { Household } from "../api/households-api";
import { describeSplit, formatAmount, parseAmountCents, todayIsoDate } from "./money-format";

interface ExpenseScreenProps {
  household: Household;
  // The expense to fix; without it the screen adds a new one.
  expense?: Expense;
  onSave: (expense: NewExpense) => Promise<void>;
  onDelete?: () => Promise<void>;
  onBack: () => void;
  // For a new expense with its purpose already known, e.g. checking out at the shop.
  title?: string;
  defaultDescription?: string;
  submitLabel?: string;
}

interface FieldErrors {
  description?: string;
  amount?: string;
  split?: string;
  form?: string;
}

export function ExpenseScreen({ household, expense, onSave, onDelete, onBack, title, defaultDescription, submitLabel }: ExpenseScreenProps) {
  const fieldId = useId();
  const me = household.currentMemberId;
  const [description, setDescription] = useState(expense?.description ?? defaultDescription ?? "");
  const [amount, setAmount] = useState(() => (expense ? formatAmount(expense.amountCents) : ""));
  const [paidByMemberId, setPaidByMemberId] = useState(expense?.paidByMemberId ?? me);
  const [splitBetween, setSplitBetween] = useState(
    () => expense?.shares.map((share) => share.memberId) ?? household.members.map((member) => member.id),
  );
  const [spentOn, setSpentOn] = useState(() => expense?.spentOn ?? todayIsoDate());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameOf = (memberId: string) =>
    memberId === me ? "You" : household.members.find((member) => member.id === memberId)?.name;

  function toggleSplit(memberId: string) {
    setSplitBetween((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
    clearError("split");
  }

  function clearError(key: keyof FieldErrors) {
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): FieldErrors {
    const amountCents = parseAmountCents(amount);
    return {
      description: description.trim() === "" ? "Say what it was for." : undefined,
      amount: amountCents === undefined || amountCents === 0 ? "Enter an amount like 12.50." : undefined,
      split: splitBetween.length === 0 ? "Pick at least one person to split with." : undefined,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.values(fieldErrors).some(Boolean)) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave({
        description,
        amountCents: parseAmountCents(amount) ?? 0,
        paidByMemberId,
        splitBetweenMemberIds: splitBetween,
        spentOn,
      });
      onBack();
    } catch (submitError) {
      setErrors({ form: (submitError as ApiError).message });
      setIsSubmitting(false);
    }
  }

  async function handleDelete(deleteExpense: () => Promise<void>) {
    setIsSubmitting(true);
    try {
      await deleteExpense();
    } catch (deleteError) {
      setErrors({ form: (deleteError as ApiError).message });
      setIsSubmitting(false);
    }
  }

  const amountCents = parseAmountCents(amount);
  const splitNames = household.members
    .filter((member) => splitBetween.includes(member.id))
    .map((member) => nameOf(member.id) ?? member.name);
  const splitPreview = amountCents && splitNames.length > 0 ? describeSplit(amountCents, splitNames) : undefined;

  const errorText = (key: keyof FieldErrors) =>
    errors[key] && (
      <p id={`${fieldId}-${key}-error`} className="form-error" role="alert">
        {errors[key]}
      </p>
    );
  const invalidProps = (key: keyof FieldErrors) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": `${fieldId}-${key}-error` } : {};

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Cancel
      </button>
      <h1 className="page-title">{title ?? (expense ? "Edit expense" : "Add an expense")}</h1>

      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor={`${fieldId}-description`}>
          What was it for?
        </label>
        <input
          id={`${fieldId}-description`}
          className="text-input"
          value={description}
          placeholder="Groceries"
          autoComplete="off"
          autoFocus={!expense && !defaultDescription}
          {...invalidProps("description")}
          onChange={(event) => {
            setDescription(event.target.value);
            clearError("description");
          }}
        />
        {errorText("description")}

        <label className="field-label" htmlFor={`${fieldId}-amount`}>
          Amount
        </label>
        <input
          id={`${fieldId}-amount`}
          className="text-input text-input--amount"
          value={amount}
          placeholder="0.00"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={defaultDescription !== undefined}
          {...invalidProps("amount")}
          onChange={(event) => {
            setAmount(event.target.value);
            clearError("amount");
          }}
        />
        {errorText("amount")}

        <label className="field-label" htmlFor={`${fieldId}-paid-by`}>
          Paid by
        </label>
        <select
          id={`${fieldId}-paid-by`}
          className="text-input"
          value={paidByMemberId}
          onChange={(event) => setPaidByMemberId(event.target.value)}
        >
          {household.members.map((member) => (
            <option key={member.id} value={member.id}>
              {nameOf(member.id)}
            </option>
          ))}
        </select>

        <fieldset className="split-picker" {...invalidProps("split")}>
          <legend className="field-label">Split equally between</legend>
          {household.members.map((member) => (
            <label key={member.id} className="split-picker__option">
              <input
                type="checkbox"
                checked={splitBetween.includes(member.id)}
                onChange={() => toggleSplit(member.id)}
              />
              {nameOf(member.id)}
            </label>
          ))}
        </fieldset>
        {errorText("split")}
        <p className="field-hint" aria-live="polite">
          {splitPreview}
        </p>

        <label className="field-label" htmlFor={`${fieldId}-date`}>
          Date
        </label>
        <input
          id={`${fieldId}-date`}
          className="text-input"
          type="date"
          value={spentOn}
          required
          onChange={(event) => setSpentOn(event.target.value || todayIsoDate())}
        />

        <button className="button button--block button--submit" type="submit" disabled={isSubmitting}>
          {submitLabel ?? (expense ? "Save changes" : "Add expense")}
        </button>
        {errorText("form")}
      </form>
      {onDelete && (
        <button
          className="button button--quiet expense-screen__delete"
          type="button"
          disabled={isSubmitting}
          onClick={() => handleDelete(onDelete)}
        >
          Delete expense
        </button>
      )}
    </div>
  );
}
