import { useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import type { IntervalUnit, NewTask } from "../api/tasks-api";
import { todayIsoDate } from "../money/money-format";

const DEFAULT_EVERY = "1";
const DEFAULT_UNIT: IntervalUnit = "week";
const MAX_EVERY = 365;
const UNITS: IntervalUnit[] = ["day", "week", "month"];
const WHOLE_NUMBER_PATTERN = /^\d{1,3}$/;

interface AddChoreScreenProps {
  household: Household;
  onAdd: (task: NewTask) => Promise<unknown>;
  onBack: () => void;
}

interface FieldErrors {
  title?: string;
  every?: string;
  rotation?: string;
  form?: string;
}

export function AddChoreScreen({ household, onAdd, onBack }: AddChoreScreenProps) {
  const fieldId = useId();
  const [title, setTitle] = useState("");
  const [every, setEvery] = useState(DEFAULT_EVERY);
  const [unit, setUnit] = useState<IntervalUnit>(DEFAULT_UNIT);
  const [firstDueOn, setFirstDueOn] = useState(() => todayIsoDate());
  const [rotation, setRotation] = useState(() => household.members.map((member) => member.id));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const everyCount = WHOLE_NUMBER_PATTERN.test(every.trim()) ? Number(every) : Number.NaN;

  function validate(): FieldErrors {
    return {
      title: title.trim() ? undefined : "Say what needs doing.",
      every: everyCount >= 1 && everyCount <= MAX_EVERY ? undefined : `Pick a number from 1 to ${MAX_EVERY}.`,
      rotation: rotation.length > 0 ? undefined : "Pick at least one person.",
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
      await onAdd({ title, every: everyCount, unit, firstDueOn, rotationMemberIds: rotation });
      onBack();
    } catch (submitError) {
      setErrors({ form: (submitError as ApiError).message });
      setIsSubmitting(false);
    }
  }

  // Kept in household order, which is the order turns go in.
  const toggleTurn = (memberId: string) =>
    setRotation((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : household.members.map((member) => member.id).filter((id) => id === memberId || current.includes(id)),
    );

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
      <h1 className="page-title">Add a chore</h1>

      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor={`${fieldId}-title`}>
          What needs doing?
        </label>
        <input
          id={`${fieldId}-title`}
          className="text-input"
          value={title}
          placeholder="Take out the trash"
          autoComplete="off"
          autoFocus
          {...invalidProps("title")}
          onChange={(event) => setTitle(event.target.value)}
        />
        {errorText("title")}

        <fieldset className="chore-interval">
          <legend className="field-label">How often?</legend>
          <span className="chore-interval__every">Every</span>
          <input
            className="text-input text-input--amount chore-interval__count"
            aria-label="How many"
            inputMode="numeric"
            value={every}
            {...invalidProps("every")}
            onChange={(event) => setEvery(event.target.value)}
          />
          <select
            className="text-input chore-interval__unit"
            aria-label="Days, weeks or months"
            value={unit}
            onChange={(event) => setUnit(event.target.value as IntervalUnit)}
          >
            {UNITS.map((option) => (
              <option key={option} value={option}>
                {everyCount === 1 ? option : `${option}s`}
              </option>
            ))}
          </select>
        </fieldset>
        {errorText("every")}

        <fieldset className="split-picker" {...invalidProps("rotation")}>
          <legend className="field-label">Who takes turns?</legend>
          {household.members.map((member) => (
            <label key={member.id} className="split-picker__option">
              <input type="checkbox" checked={rotation.includes(member.id)} onChange={() => toggleTurn(member.id)} />
              {member.id === household.currentMemberId ? "You" : member.name}
            </label>
          ))}
        </fieldset>
        {errorText("rotation")}

        <label className="field-label" htmlFor={`${fieldId}-first`}>
          First time
        </label>
        <input
          id={`${fieldId}-first`}
          className="text-input"
          type="date"
          value={firstDueOn}
          required
          onChange={(event) => setFirstDueOn(event.target.value || todayIsoDate())}
        />

        <button className="button button--block button--submit" type="submit" disabled={isSubmitting}>
          Add chore
        </button>
        {errorText("form")}
      </form>
    </div>
  );
}
