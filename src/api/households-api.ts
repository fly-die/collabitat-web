import { API_BASE_URL } from "../config";

export interface Member {
  id: string;
  name: string;
}

export interface Household {
  id: string;
  name: string;
  members: Member[];
}

export const NETWORK_ERROR_CODE = "NETWORK_ERROR";
export const HOUSEHOLD_NOT_FOUND_CODE = "HOUSEHOLD_NOT_FOUND";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_CODE, "Can't reach the server. Try again in a moment.");
  }

  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(body.error ?? "UNKNOWN", body.message ?? "Something went wrong.");
  }
  return body as T;
}

export const householdsApi = {
  create: (name: string) =>
    request<Household>("/households", { method: "POST", body: JSON.stringify({ name }) }),
  get: (householdId: string) => request<Household>(`/households/${householdId}`),
  addMember: (householdId: string, name: string) =>
    request<Household>(`/households/${householdId}/members`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  removeMember: (householdId: string, memberId: string) =>
    request<Household>(`/households/${householdId}/members/${memberId}`, { method: "DELETE" }),
};
