import { API_BASE_URL } from "../config";

export interface Member {
  id: string;
  name: string;
  hasJoined: boolean;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  currentMemberId: string;
  members: Member[];
}

export interface Invite {
  householdId: string;
  householdName: string;
  membersToJoin: Pick<Member, "id" | "name">[];
}

interface SessionResponse {
  token: string;
  household: Household;
}

export const SESSION_STORAGE_KEY = "collabitat.session";
export const NETWORK_ERROR_CODE = "NETWORK_ERROR";
export const UNAUTHORIZED_CODE = "UNAUTHORIZED";
export const INVITE_NOT_FOUND_CODE = "INVITE_NOT_FOUND";
const MEMBER_NOT_FOUND_CODE = "MEMBER_NOT_FOUND";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

async function startSession(path: string, init: RequestInit) {
  const { token, household } = await request<SessionResponse>(path, { method: "POST", ...init });
  localStorage.setItem(SESSION_STORAGE_KEY, token);
  return household;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_CODE_PATTERN = /^[0-9a-f]{32}$/;

// Values from links and server responses only reach a URL in their expected shape.
function safeMemberId(memberId: string) {
  if (!UUID_PATTERN.test(memberId)) {
    throw new ApiError(MEMBER_NOT_FOUND_CODE, "That flatmate no longer exists.");
  }
  return memberId;
}

function invitePath(inviteCode: string) {
  if (!INVITE_CODE_PATTERN.test(inviteCode)) {
    throw new ApiError(
      INVITE_NOT_FOUND_CODE,
      "This invite link doesn't work. Ask a flatmate for a new one.",
    );
  }
  return `/invites/${inviteCode}`;
}

export const householdsApi = {
  create: (name: string, memberName: string) =>
    startSession("/households", { body: JSON.stringify({ name, memberName }) }),
  get: () => request<Household>("/household"),
  addMember: (name: string) =>
    request<Household>("/household/members", { method: "POST", body: JSON.stringify({ name }) }),
  removeMember: (memberId: string) =>
    request<Household>(`/household/members/${safeMemberId(memberId)}`, { method: "DELETE" }),
  getInvite: async (inviteCode: string) => request<Invite>(invitePath(inviteCode)),
  joinAsNewMember: async (inviteCode: string, name: string) =>
    startSession(`${invitePath(inviteCode)}/members`, { body: JSON.stringify({ name }) }),
  joinAsExistingMember: async (inviteCode: string, memberId: string) =>
    startSession(`${invitePath(inviteCode)}/members/${safeMemberId(memberId)}/join`, {}),
};
