import { request } from "./client";

export const PUSH_DISABLED_CODE = "PUSH_DISABLED";
const SUBSCRIPTION_PATH = "/household/push-subscription";

export const pushApi = {
  publicKey: () => request<{ publicKey: string }>("/push/public-key"),
  save: (subscription: PushSubscriptionJSON) =>
    request<void>(SUBSCRIPTION_PATH, { method: "PUT", body: JSON.stringify(subscription) }),
  remove: (endpoint: string) => request<void>(SUBSCRIPTION_PATH, { method: "DELETE", body: JSON.stringify({ endpoint }) }),
};
