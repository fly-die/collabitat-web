import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import { pushApi, type NotificationPreferences } from "../api/push-api";

const KINDS: { key: keyof NotificationPreferences; label: string; hint: string }[] = [
  { key: "chores", label: "Chores", hint: "A reminder on the day it's your turn." },
  { key: "money", label: "Money", hint: "When a flatmate adds an expense you share." },
  { key: "shopping", label: "Shopping", hint: "When a flatmate starts shopping, so you can add things." },
];

// Which kinds reach me, on all my devices. Shown once notifications are on, because before that none arrive.
export function NotificationKinds() {
  const [preferences, setPreferences] = useState<NotificationPreferences>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    pushApi
      .preferences()
      .then((loaded) => {
        if (isCurrent) {
          setPreferences(loaded);
        }
      })
      .catch((loadError: ApiError) => {
        if (isCurrent) {
          setError(loadError.message);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  function toggle(key: keyof NotificationPreferences) {
    if (!preferences) {
      return;
    }
    const previous = preferences;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setError(undefined);
    pushApi.savePreferences(next).catch((saveError: ApiError) => {
      setPreferences(previous);
      setError(saveError.message);
    });
  }

  return (
    <>
      {preferences && (
        <ul className="settings__kinds" aria-label="What to notify me about">
          {KINDS.map(({ key, label, hint }) => (
            <li key={key}>
              <label className="settings__kind" htmlFor={`notification-kind-${key}`}>
                <input
                  id={`notification-kind-${key}`}
                  type="checkbox"
                  checked={preferences[key]}
                  onChange={() => toggle(key)}
                />
                <span className="setting__text">
                  <span className="setting__label">{label}</span>
                  <span className="setting__hint">{hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
