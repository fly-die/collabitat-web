import { useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/households-api";

interface NameFormProps {
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
}

export function NameForm({ label, placeholder, submitLabel, onSubmit }: NameFormProps) {
  const inputId = useId();
  const errorId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    try {
      await onSubmit(name);
      setName("");
    } catch (submitError) {
      setError((submitError as ApiError).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="name-form" onSubmit={handleSubmit} noValidate>
      <label className="name-form__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="name-form__row">
        <input
          id={inputId}
          className="name-form__input"
          value={name}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
        />
        <button className="button" type="submit" disabled={isSubmitting || name.trim() === ""}>
          {submitLabel}
        </button>
      </div>
      {error && (
        <p id={errorId} className="name-form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
