// The browser's side of notifications: what this device can do and its push subscription.

// The service worker only runs in the built app; this keeps a missing one from hanging the page.
const SERVICE_WORKER_TIMEOUT_MS = 10_000;

export type DeviceSupport = "supported" | "unsupported" | "needs-install";

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function deviceSupport(): DeviceSupport {
  // Safari on iPhone only offers notifications to apps added to the Home Screen.
  if (isIos() && !isInstalled()) {
    return "needs-install";
  }
  const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return hasPush ? "supported" : "unsupported";
}

export async function serviceWorker(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("No service worker")), SERVICE_WORKER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function keyBytes(base64Url: string) {
  const base64 = base64Url.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function usesKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options.applicationServerKey;
  if (!current) {
    return false;
  }
  const expected = keyBytes(publicKey);
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
}

// Today's subscription, or undefined. One made with an old server key is useless and gets dropped.
export async function currentSubscription(registration: ServiceWorkerRegistration, publicKey: string) {
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && !usesKey(subscription, publicKey)) {
    await subscription.unsubscribe();
    return undefined;
  }
  return subscription ?? undefined;
}

export async function subscribe(registration: ServiceWorkerRegistration, publicKey: string) {
  return (
    (await currentSubscription(registration, publicKey)) ??
    registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
  );
}
