import { useEffect, useState } from "react";
import { NETWORK_ERROR_CODE, type ApiError } from "../api/client";
import { PUSH_DISABLED_CODE, pushApi } from "../api/push-api";
import { currentSubscription, deviceSupport, serviceWorker, subscribe } from "./push-device";

export type NotificationStatus =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "off-on-server"
  | "unreachable"
  | "blocked"
  | "off"
  | "on";

const NOT_READY_MESSAGE = "Notifications aren't ready on this device yet. Try again in a moment.";

function messageOf(error: unknown) {
  return (error as ApiError).code ? (error as ApiError).message : NOT_READY_MESSAGE;
}

// Works out what this device can do and keeps the browser and the server agreeing on it:
// a subscription the server lost is sent again, one with an old key is replaced.
export function useNotifications() {
  const [status, setStatus] = useState<NotificationStatus>("checking");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    const settle = (next: NotificationStatus, message?: string) => {
      if (isCurrent) {
        setStatus(next);
        setError(message);
      }
    };
    async function check() {
      const support = deviceSupport();
      if (support !== "supported") {
        settle(support);
        return;
      }
      let publicKey: string;
      try {
        publicKey = (await pushApi.publicKey()).publicKey;
      } catch (keyError) {
        const code = (keyError as ApiError).code;
        settle(code === PUSH_DISABLED_CODE ? "off-on-server" : "unreachable", code === NETWORK_ERROR_CODE ? messageOf(keyError) : undefined);
        return;
      }
      if (Notification.permission === "denied") {
        settle("blocked");
        return;
      }
      try {
        const subscription = await currentSubscription(await serviceWorker(), publicKey);
        if (subscription && Notification.permission === "granted") {
          await pushApi.save(subscription.toJSON());
          settle("on");
        } else {
          settle("off");
        }
      } catch (checkError) {
        settle("off", messageOf(checkError));
      }
    }
    void check();
    return () => {
      isCurrent = false;
    };
  }, [checkAttempt]);

  async function turnOn() {
    setIsBusy(true);
    setError(undefined);
    try {
      // Asked only here, after a tap, so the browser's prompt never comes out of nowhere.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const { publicKey } = await pushApi.publicKey();
      const subscription = await subscribe(await serviceWorker(), publicKey);
      try {
        await pushApi.save(subscription.toJSON());
      } catch (saveError) {
        // Without the server knowing, nothing would arrive: undo it so the switch tells the truth.
        await subscription.unsubscribe();
        throw saveError;
      }
      setStatus("on");
    } catch (turnOnError) {
      setStatus("off");
      setError(messageOf(turnOnError));
    } finally {
      setIsBusy(false);
    }
  }

  async function turnOff() {
    setIsBusy(true);
    setError(undefined);
    try {
      await turnOffOnThisDevice();
      setStatus("off");
    } catch (turnOffError) {
      setError(messageOf(turnOffError));
    } finally {
      setIsBusy(false);
    }
  }

  return { status, isBusy, error, turnOn, turnOff, checkAgain: () => setCheckAttempt((attempt) => attempt + 1) };
}

// Used by the switch and on log out. Only looks at a service worker that's already there, so
// logging out never waits. The browser's subscription always goes; if the server can't be told,
// it forgets the device the first time the push service reports it gone.
export async function turnOffOnThisDevice() {
  if (deviceSupport() !== "supported") {
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    return;
  }
  try {
    await pushApi.remove(subscription.endpoint);
  } catch {
    // Not reachable right now; see above.
  }
  await subscription.unsubscribe();
}
