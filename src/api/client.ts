import { API_BASE_URL } from "../config";

export const SESSION_STORAGE_KEY = "collabitat.session";
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";
export const UNAUTHORIZED_CODE = "UNAUTHORIZED";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function hasSession() {
  return localStorage.getItem(SESSION_STORAGE_KEY) !== null;
}

export function endSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers();
  if (init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = localStorage.getItem(SESSION_STORAGE_KEY);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(NETWORK_ERROR_CODE, "Can't reach the server. Try again in a moment.");
  }

  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body.error ?? "UNKNOWN", body.message ?? "Something went wrong.");
  }
  return body as T;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Values from links and server responses only reach a URL in their expected shape.
export function safeId(id: string, errorCode: string, message: string) {
  if (!UUID_PATTERN.test(id)) {
    throw new ApiError(errorCode, message);
  }
  return id;
}
