import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ApiError } from "../api/client";

interface AddFlatmateRowsProps {
  onAdd: (name: string) => Promise<void>;
}

// While a name is being entered, the new flatmate gets its own row and the add button waits below it.
export function AddFlatmateRows({ onAdd }: AddFlatmateRowsProps) {
  const inputId = useId();
  const errorId = useId();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  function stopAdding() {
    setIsAdding(false);
    setName("");
    setError(undefined);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() === "") {
      return;
    }
    setIsSubmitting(true);
    setError(undefined);
    try {
      await onAdd(name);
      stopAdding();
    } catch (submitError) {
      setError((submitError as ApiError).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      stopAdding();
    }
  }

  return (
    <>
      {isAdding && (
        <li className="doorbell__plate doorbell__plate--draft">
          <form className="draft-flatmate" onSubmit={handleSubmit} noValidate>
            <span className="doorbell__bell doorbell__bell--waiting" aria-hidden="true" />
            <label className="visually-hidden" htmlFor={inputId}>
              New flatmate's name
            </label>
            <input
              id={inputId}
              className="draft-flatmate__input"
              value={name}
              placeholder="Name"
              autoComplete="off"
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => name.trim() === "" && stopAdding()}
            />
            <button className="button draft-flatmate__save" type="submit" disabled={isSubmitting || name.trim() === ""}>
              Add
            </button>
          </form>
          {error && (
            <p id={errorId} className="form-error draft-flatmate__error" role="alert">
              {error}
            </p>
          )}
        </li>
      )}
      <li className="doorbell__add">
        <button
          className="doorbell__add-button"
          type="button"
          disabled={isAdding}
          onClick={() => setIsAdding(true)}
        >
          + Add a flatmate
        </button>
      </li>
    </>
  );
}
