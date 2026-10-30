import { useId, useState, type FormEvent } from "react";
import { AccountFields, EMPTY_CREDENTIALS, isFilledIn } from "../accounts/AccountFields";
import type { ApiError } from "../api/client";
import type { Credentials } from "../api/households-api";

interface CreateHouseholdFormProps {
  onSubmit: (name: string, memberName: string, credentials: Credentials) => Promise<void>;
}

export function CreateHouseholdForm({ onSubmit }: CreateHouseholdFormProps) {
  const householdNameId = useId();
  const memberNameId = useId();
  const [householdName, setHouseholdName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [credentials, setCredentials] = useState(EMPTY_CREDENTIALS);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isComplete = householdName.trim() !== "" && memberName.trim() !== "" && isFilledIn(credentials);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);
    try {
      await onSubmit(householdName, memberName, credentials);
    } catch (submitError) {
      setError((submitError as ApiError).message);
      setIsSubmitting(false);
    }
  }

  return (
    <form className="stacked-form" onSubmit={handleSubmit} noValidate>
      <label className="field-label" htmlFor={householdNameId}>
        Household name
      </label>
      <input
        id={householdNameId}
        className="text-input"
        value={householdName}
        placeholder="e.g. Langstrasse 12"
        autoComplete="off"
        onChange={(event) => setHouseholdName(event.target.value)}
      />
      <label className="field-label" htmlFor={memberNameId}>
        Your name
      </label>
      <input
        id={memberNameId}
        className="text-input"
        value={memberName}
        placeholder="How your flatmates call you"
        autoComplete="given-name"
        onChange={(event) => setMemberName(event.target.value)}
      />
      <AccountFields credentials={credentials} onChange={setCredentials} isNewAccount />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button--block button--submit" type="submit" disabled={isSubmitting || !isComplete}>
        Create household
      </button>
    </form>
  );
}
