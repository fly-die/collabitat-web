import type { Household } from "../api/households-api";
import { useNotifications, type NotificationStatus } from "../notifications/useNotifications";

interface SettingsScreenProps {
  household: Household;
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

export function SettingsScreen({ household, onBack, onLogOut }: SettingsScreenProps) {
  const { status, isBusy, error, turnOn, turnOff, checkAgain } = useNotifications();
  const me = household.members.find((member) => member.id === household.currentMemberId);
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
                  A reminder on the morning a chore is your turn, and a note when a flatmate adds an expense you share.
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
        <button className="button button--quiet settings__log-out" type="button" onClick={onLogOut}>
          Log out
        </button>
      )}
    </div>
  );
}
