import { useId, useState, type FormEvent } from "react";
import type { CalendarColumn, CalendarEntry, NewCalendarEntry } from "../api/calendar-api";
import type { ApiError } from "../api/client";
import { EVERYONE } from "./calendar-format";

const EVERYONE_VALUE = "";

interface EntryScreenProps {
  columns: CalendarColumn[];
  today: string;
  entry?: CalendarEntry;
  onSave: (entry: NewCalendarEntry) => Promise<void>;
  onRemove?: () => void;
  onBack: () => void;
}

// Adds or edits one date. Defaults: today, the whole day, for everyone.
export function EntryScreen({ columns, today, entry, onSave, onRemove, onBack }: EntryScreenProps) {
  const fieldId = useId();
  const [title, setTitle] = useState(entry?.title ?? "");
  const [day, setDay] = useState(entry?.day ?? today);
  const [time, setTime] = useState(entry?.time ?? "");
  const [columnId, setColumnId] = useState(entry?.columnId ?? EVERYONE_VALUE);
  const [titleError, setTitleError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError("Say what it is, like Dentist or Birthday.");
      return;
    }
    setTitleError(undefined);
    setIsSubmitting(true);
    try {
      await onSave({ title, day, time: time || null, columnId: columnId || null });
      onBack();
    } catch (saveError) {
      setFormError((saveError as ApiError).message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Cancel
      </button>
      <h1 className="page-title">{entry ? "Edit date" : "Add a date"}</h1>

      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor={`${fieldId}-title`}>
          What is it?
        </label>
        <input
          id={`${fieldId}-title`}
          className="text-input"
          placeholder="Dentist"
          autoComplete="off"
          autoFocus={!entry}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          {...(titleError ? { "aria-invalid": true, "aria-describedby": `${fieldId}-title-error` } : {})}
        />
        {titleError && (
          <p id={`${fieldId}-title-error`} className="form-error" role="alert">
            {titleError}
          </p>
        )}

        <label className="field-label" htmlFor={`${fieldId}-column`}>
          For
        </label>
        <select id={`${fieldId}-column`} className="text-input" value={columnId} onChange={(event) => setColumnId(event.target.value)}>
          <option value={EVERYONE_VALUE}>{EVERYONE}</option>
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.name}
            </option>
          ))}
        </select>

        <label className="field-label" htmlFor={`${fieldId}-day`}>
          Day
        </label>
        <input id={`${fieldId}-day`} className="text-input" type="date" required value={day} onChange={(event) => setDay(event.target.value)} />

        <label className="field-label" htmlFor={`${fieldId}-time`}>
          Time, if it has one
        </label>
        <input id={`${fieldId}-time`} className="text-input" type="time" value={time} onChange={(event) => setTime(event.target.value)} />

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <button className="button button--block button--submit" type="submit" disabled={isSubmitting}>
          {entry ? "Save date" : "Add date"}
        </button>
      </form>
      {onRemove && (
        <button className="button button--quiet expense-screen__delete" type="button" disabled={isSubmitting} onClick={onRemove}>
          Remove date
        </button>
      )}
    </div>
  );
}
