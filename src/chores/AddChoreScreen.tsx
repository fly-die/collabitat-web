import { useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import type { IntervalUnit, NewTask, Task } from "../api/tasks-api";
import { todayIsoDate } from "../money/money-format";
import { startWithFewestTurns } from "./chore-format";

const DEFAULT_EVERY = "1";
const DEFAULT_UNIT: IntervalUnit = "week";
const MAX_EVERY = 365;
const UNITS: IntervalUnit[] = ["day", "week", "month"];
const WHOLE_NUMBER_PATTERN = /^\d{1,3}$/;

interface AddChoreScreenProps {
  household: Household;
  // The household's chores, to share out first turns.
  tasks: Task[];
  // Set when editing; the form starts with what it has.
  task?: Task;
  onSave: (task: NewTask) => Promise<unknown>;
  onBack: () => void;
}

interface FieldErrors {
  title?: string;
  every?: string;
  rotation?: string;
  form?: string;
}

// Adds a chore, or changes one: what was done and whose turn it is stay as they are.
export function AddChoreScreen({ household, tasks, task, onSave, onBack }: AddChoreScreenProps) {
  const fieldId = useId();
  const [title, setTitle] = useState(task?.title ?? "");
  const [every, setEvery] = useState(task ? String(task.every) : DEFAULT_EVERY);
  const [unit, setUnit] = useState<IntervalUnit>(task?.unit ?? DEFAULT_UNIT);
  const [firstDueOn, setFirstDueOn] = useState(() => task?.firstDueOn ?? todayIsoDate());
  const [rotation, setRotation] = useState(() => task?.rotation ?? household.members.map((member) => member.id));
  // The first day only matters until the chore has been done once.
  const canPickFirstDay = !task?.lastCompletion;
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
      const rotationMemberIds = task ? rotation : startWithFewestTurns(rotation, tasks);
      await onSave({ title, every: everyCount, unit, firstDueOn, rotationMemberIds });
      onBack();
    } catch (submitError) {
      setErrors({ form: (submitError as ApiError).message });
      setIsSubmitting(false);
    }
  }

  // A new chore keeps household order. A chore being changed keeps its order, and someone
  // joining the turns comes last, so the turns already planned stay the same.
  const toggleTurn = (memberId: string) =>
    setRotation((current) => {
      if (current.includes(memberId)) {
        return current.filter((id) => id !== memberId);
      }
      if (task) {
        return [...current, memberId];
      }
      return household.members.map((member) => member.id).filter((id) => id === memberId || current.includes(id));
    });

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
      <h1 className="page-title">{task ? "Edit chore" : "Add a chore"}</h1>

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

        {canPickFirstDay && (
          <>
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
          </>
        )}

        <button className="button button--block button--submit" type="submit" disabled={isSubmitting}>
          {task ? "Save chore" : "Add chore"}
        </button>
        {errorText("form")}
      </form>
    </div>
  );
}
