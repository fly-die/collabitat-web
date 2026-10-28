import { useInstallHint } from "./useInstallHint";

export function InstallHint() {
  const { option, install, dismiss } = useInstallHint();

  if (option === "none") {
    return null;
  }

  return (
    <section className="install-hint" aria-label="Install Collabitat">
      {option === "prompt" ? (
        <p className="install-hint__text">
          Add Collabitat to your home screen to open it like an app.
        </p>
      ) : (
        <p className="install-hint__text">
          Add Collabitat to your home screen: tap Share, then Add to Home Screen.
        </p>
      )}
      <div className="install-hint__actions">
        {option === "prompt" && (
          <button className="button button--secondary" type="button" onClick={install}>
            Install
          </button>
        )}
        <button className="button button--quiet" type="button" onClick={dismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}
