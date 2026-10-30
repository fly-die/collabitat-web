import { useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { Credentials } from "../api/households-api";
import { AccountFields, EMPTY_CREDENTIALS, isFilledIn } from "./AccountFields";

interface NewAccountFormProps {
  submitLabel: string;
  onSubmit: (credentials: Credentials) => Promise<void>;
}

export function NewAccountForm({ submitLabel, onSubmit }: NewAccountFormProps) {
  const [credentials, setCredentials] = useState(EMPTY_CREDENTIALS);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    try {
      await onSubmit(credentials);
    } catch (submitError) {
      setError((submitError as ApiError).message);
      setIsSubmitting(false);
    }
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit} noValidate>
      <AccountFields
        credentials={credentials}
        onChange={(changed) => {
          setCredentials(changed);
          setError(undefined);
        }}
        isNewAccount
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button--block button--submit"
        type="submit"
        disabled={isSubmitting || !isFilledIn(credentials)}
      >
        {submitLabel}
      </button>
    </form>
  );
}
