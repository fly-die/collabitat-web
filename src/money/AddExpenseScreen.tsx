import { useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { NewExpense } from "../api/expenses-api";
import type { Household } from "../api/households-api";
import { parseAmountCents, todayIsoDate } from "./money-format";

interface AddExpenseScreenProps {
  household: Household;
  onAdd: (expense: NewExpense) => Promise<void>;
  onBack: () => void;
}

interface FieldErrors {
  description?: string;
  amount?: string;
  split?: string;
  form?: string;
}

export function AddExpenseScreen({ household, onAdd, onBack }: AddExpenseScreenProps) {
  const fieldId = useId();
  const me = household.currentMemberId;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState(me);
  const [splitBetween, setSplitBetween] = useState(() => household.members.map((member) => member.id));
  const [spentOn, setSpentOn] = useState(() => todayIsoDate());
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
      await onAdd({
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
        Back
      </button>
      <h1 className="page-title">Add an expense</h1>

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
          autoFocus
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
          Add expense
        </button>
        {errorText("form")}
      </form>
    </div>
  );
}
