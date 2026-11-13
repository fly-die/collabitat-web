import { request } from "./client";

export const PUSH_DISABLED_CODE = "PUSH_DISABLED";
const SUBSCRIPTION_PATH = "/household/push-subscription";
const PREFERENCES_PATH = "/household/notification-preferences";

// The kinds of notifications I can switch off for myself.
export interface NotificationPreferences {
  chores: boolean;
  money: boolean;
  shopping: boolean;
}

export const pushApi = {
  publicKey: () => request<{ publicKey: string }>("/push/public-key"),
  save: (subscription: PushSubscriptionJSON) =>
    request<void>(SUBSCRIPTION_PATH, { method: "PUT", body: JSON.stringify(subscription) }),
  preferences: () => request<NotificationPreferences>(PREFERENCES_PATH),
  savePreferences: (preferences: NotificationPreferences) =>
    request<NotificationPreferences>(PREFERENCES_PATH, { method: "PUT", body: JSON.stringify(preferences) }),
  remove: (endpoint: string) => request<void>(SUBSCRIPTION_PATH, { method: "DELETE", body: JSON.stringify({ endpoint }) }),
};
