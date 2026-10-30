import { useId, useState } from "react";
import type { Credentials } from "../api/households-api";

export const MIN_PASSWORD_LENGTH = 8;

export const EMPTY_CREDENTIALS: Credentials = { email: "", password: "" };

export function isFilledIn({ email, password }: Credentials) {
  return email.trim() !== "" && password !== "";
}

interface AccountFieldsProps {
  credentials: Credentials;
  onChange: (credentials: Credentials) => void;
  // New accounts get a strong-password suggestion from password managers, logins get autofill.
  isNewAccount: boolean;
}

export function AccountFields({ credentials, onChange, isNewAccount }: AccountFieldsProps) {
  const emailId = useId();
  const passwordId = useId();
  const hintId = useId();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <>
      <label className="field-label" htmlFor={emailId}>
        Email
      </label>
      <input
        id={emailId}
        className="text-input"
        type="email"
        name="email"
        inputMode="email"
        autoComplete={isNewAccount ? "email" : "username"}
        autoCapitalize="off"
        spellCheck={false}
        value={credentials.email}
        onChange={(event) => onChange({ ...credentials, email: event.target.value })}
      />
      <label className="field-label" htmlFor={passwordId}>
        Password
      </label>
      <div className="password-field">
        <input
          id={passwordId}
          className="text-input"
          type={isPasswordVisible ? "text" : "password"}
          name="password"
          autoComplete={isNewAccount ? "new-password" : "current-password"}
          autoCapitalize="off"
          spellCheck={false}
          minLength={isNewAccount ? MIN_PASSWORD_LENGTH : undefined}
          aria-describedby={isNewAccount ? hintId : undefined}
          value={credentials.password}
          onChange={(event) => onChange({ ...credentials, password: event.target.value })}
        />
        <button
          className="password-field__toggle"
          type="button"
          aria-pressed={isPasswordVisible}
          onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
        >
          {isPasswordVisible ? "Hide" : "Show"}
        </button>
      </div>
      {isNewAccount && (
        <p id={hintId} className="field-hint">
          At least {MIN_PASSWORD_LENGTH} characters. You'll use it to log in on other devices.
        </p>
      )}
    </>
  );
}
