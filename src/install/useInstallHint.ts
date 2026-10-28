import { useState, useSyncExternalStore } from "react";

export const INSTALL_HINT_DISMISSED_KEY = "collabitat.installHintDismissed";
const STANDALONE_DISPLAY_QUERY = "(display-mode: standalone)";
const APPLE_MOBILE_PATTERN = /iPhone|iPad|iPod/;
const APPLE_DESKTOP_PATTERN = /Macintosh/;

// Chrome's install event, not yet part of the TypeScript DOM types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export type InstallOption = "prompt" | "apple-instructions" | "none";

let deferredPrompt: BeforeInstallPromptEvent | undefined;
const listeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | undefined) {
  deferredPrompt = event;
  listeners.forEach((listener) => listener());
}

// Registered on import because the browser may fire the event before React renders the hint.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  setDeferredPrompt(event as BeforeInstallPromptEvent);
});
window.addEventListener("appinstalled", () => setDeferredPrompt(undefined));

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isInstalled() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.(STANDALONE_DISPLAY_QUERY).matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

// iPadOS reports itself as a Mac, so a touch screen tells them apart.
function isAppleMobile() {
  const userAgent = navigator.userAgent;
  return (
    APPLE_MOBILE_PATTERN.test(userAgent) ||
    (APPLE_DESKTOP_PATTERN.test(userAgent) && navigator.maxTouchPoints > 1)
  );
}

export function useInstallHint() {
  const installPrompt = useSyncExternalStore(subscribe, () => deferredPrompt);
  const [isDismissed, setIsDismissed] = useState(
    () => localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) === "true",
  );

  let option: InstallOption = "none";
  if (!isDismissed && !isInstalled()) {
    if (installPrompt) {
      option = "prompt";
    } else if (isAppleMobile()) {
      option = "apple-instructions";
    }
  }

  async function install() {
    if (!installPrompt) {
      return;
    }
    // The browser allows each prompt event to be used only once.
    setDeferredPrompt(undefined);
    await installPrompt.prompt();
  }

  function dismiss() {
    localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, "true");
    setIsDismissed(true);
  }

  return { option, install, dismiss };
}
