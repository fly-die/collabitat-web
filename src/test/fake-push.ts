import { vi } from "vitest";

interface FakePushOptions {
  permission?: NotificationPermission;
  // What the browser's prompt answers when the app asks.
  answer?: NotificationPermission;
}

// A browser that supports notifications, for tests: permission, service worker and push manager.
export function installFakePush({ permission = "default", answer = "granted" }: FakePushOptions = {}) {
  let deviceCount = 0;
  let current: ReturnType<typeof fakeSubscription> | null = null;

  function fakeSubscription(endpoint: string, applicationServerKey: BufferSource) {
    const subscription = {
      endpoint,
      options: { applicationServerKey },
      toJSON: () => ({ endpoint, keys: { p256dh: "test-p256dh", auth: "test-auth" } }),
      unsubscribe: vi.fn(async () => {
        if (current === subscription) {
          current = null;
        }
        return true;
      }),
    };
    return subscription;
  }

  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async ({ applicationServerKey }: { applicationServerKey: BufferSource }) => {
      deviceCount += 1;
      current = fakeSubscription(`https://fcm.googleapis.com/fcm/send/device-${deviceCount}`, applicationServerKey);
      return current;
    }),
  };
  const registration = { pushManager };
  const notification = {
    permission,
    requestPermission: vi.fn(async () => {
      notification.permission = answer;
      return answer;
    }),
  };

  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("PushManager", class {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration), getRegistration: async () => registration },
  });

  return { pushManager, notification, subscription: () => current };
}

export function removeFakePush() {
  Reflect.deleteProperty(navigator, "serviceWorker");
}
