import { useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { Credentials } from "../api/households-api";
import { AccountFields, EMPTY_CREDENTIALS, isFilledIn } from "./AccountFields";

interface LoginScreenProps {
  onLogIn: (credentials: Credentials) => Promise<void>;
  onBack: () => void;
}

export function LoginScreen({ onLogIn, onBack }: LoginScreenProps) {
  const [credentials, setCredentials] = useState(EMPTY_CREDENTIALS);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    try {
      await onLogIn(credentials);
    } catch (submitError) {
      setError((submitError as ApiError).message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Back
      </button>
      <h1 className="page-title">Log in</h1>
      <p className="intro">Opens your household on this device.</p>
      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        <AccountFields
          credentials={credentials}
          onChange={(changed) => {
            setCredentials(changed);
            setError(undefined);
          }}
          isNewAccount={false}
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
          Log in
        </button>
      </form>
    </div>
  );
}
