import { useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import { FlatmatesSection } from "../households/FlatmatesSection";
import { InviteShareFeedback, useInviteShare } from "../households/InviteShare";
import { useNotifications, type NotificationStatus } from "../notifications/useNotifications";
import type { Theme, ThemeChoice } from "./useTheme";

const THEME_OPTIONS: { choice: ThemeChoice; label: string }[] = [
  { choice: "system", label: "Match device" },
  { choice: "light", label: "Light" },
  { choice: "dark", label: "Dark" },
];

interface SettingsScreenProps {
  household: Household;
  theme: Theme;
  onRename: (name: string) => Promise<unknown>;
  onAddMember: (name: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onBack: () => void;
  onLogOut: () => void;
}

// One sentence for every case where the switch can't work, instead of a switch that does nothing.
const EXPLANATIONS: Partial<Record<NotificationStatus, string>> = {
  checking: "Checking this device…",
  unsupported: "This browser can't show notifications.",
  "needs-install":
    "On iPhone, notifications work once Collabitat is on your Home Screen. In Safari, tap Share, then Add to Home Screen, and open it from there.",
  "off-on-server": "Notifications aren't set up on the server yet.",
  unreachable: "Can't reach the server. Try again in a moment.",
  blocked: "Notifications are blocked for Collabitat. Allow them in your browser's site settings, then come back here.",
};

export function SettingsScreen({ household, theme, onRename, onAddMember, onRemoveMember, onBack, onLogOut }: SettingsScreenProps) {
  const { status, isBusy, error, turnOn, turnOff, checkAgain } = useNotifications();
  const me = household.members.find((member) => member.id === household.currentMemberId);
  const fieldId = useId();
  const [name, setName] = useState(me?.name ?? "");
  const [nameMessage, setNameMessage] = useState<{ text: string; isError: boolean }>();
  const invite = useInviteShare(household.name, household.inviteCode);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setNameMessage({ text: "Type the name your flatmates know you by.", isError: true });
      return;
    }
    try {
      await onRename(name);
      setNameMessage({ text: "Saved.", isError: false });
    } catch (renameError) {
      setNameMessage({ text: (renameError as ApiError).message, isError: true });
    }
  }
  const isOn = status === "on";
  const explanation = EXPLANATIONS[status];

  return (
    <div className="screen settings">
      <button className="back-link" type="button" onClick={onBack}>
        Back
      </button>
      <h1 className="page-title">Settings</h1>
      <p className="settings__who">
        {me?.name} in {household.name}
      </p>

      <section aria-labelledby="you-heading">
        <h2 id="you-heading" className="section-title">
          You
        </h2>
        <form className="shopping__add" onSubmit={(event) => void saveName(event)}>
          <label className="visually-hidden" htmlFor={`${fieldId}-name`}>
            Your name
          </label>
          <input
            id={`${fieldId}-name`}
            className="text-input"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameMessage(undefined);
            }}
          />
          <button className="button" type="submit">
            Save name
          </button>
        </form>
        {nameMessage && (
          <p className={nameMessage.isError ? "form-error" : "field-hint"} role={nameMessage.isError ? "alert" : "status"}>
            {nameMessage.text}
          </p>
        )}
      </section>

      <FlatmatesSection household={household} onAddMember={onAddMember} onRemoveMember={onRemoveMember} />
      <div className="later-invite">
        <button className="button button--outline" type="button" onClick={invite.share}>
          Share invite link
        </button>
        <InviteShareFeedback status={invite.status} link={invite.link} />
      </div>

      <section aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="section-title">
          Appearance
        </h2>
        <fieldset className="segmented" aria-labelledby="appearance-heading">
          {THEME_OPTIONS.map(({ choice, label }) => (
            <label key={choice} className="segmented__option">
              <input
                type="radio"
                name="theme"
                checked={theme.choice === choice}
                onChange={() => theme.choose(choice)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      <section aria-labelledby="notifications-heading">
        <h2 id="notifications-heading" className="section-title">
          Notifications
        </h2>
        {explanation ? (
          <div className="settings__panel">
            <p className="settings__note">{explanation}</p>
            {(status === "unreachable" || status === "blocked") && (
              <button className="link-button" type="button" onClick={checkAgain}>
                Check again
              </button>
            )}
          </div>
        ) : (
          <div className="settings__panel">
            <div className="setting">
              <span className="setting__text">
                <span className="setting__label" id="notifications-label">
                  Notifications on this device
                </span>
                <span className="setting__hint" id="notifications-hint">
                  Your chore turns and shared expenses.
                </span>
              </span>
              <button
                className="switch"
                type="button"
                role="switch"
                aria-checked={isOn}
                aria-labelledby="notifications-label"
                aria-describedby="notifications-hint"
                disabled={isBusy}
                onClick={() => (isOn ? turnOff() : turnOn())}
              >
                <span className="switch__thumb" />
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* Without an account, logging out would lock this person out of their household. */}
      {household.currentMemberHasAccount && (
        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className="section-title">
            Account
          </h2>
          <p className="field-hint">Logging out stops notifications on this device. Log in again with your email and password.</p>
          <button className="button button--outline settings__log-out" type="button" onClick={onLogOut}>
            Log out
          </button>
        </section>
      )}
    </div>
  );
}
