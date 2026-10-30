import { ApiError, SESSION_STORAGE_KEY, UNAUTHORIZED_CODE, request, safeId } from "./client";

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

export const INVITE_NOT_FOUND_CODE = "INVITE_NOT_FOUND";
const MEMBER_NOT_FOUND_CODE = "MEMBER_NOT_FOUND";
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const INVITE_CODE_PATTERN = /^[0-9a-f]{32}$/;

async function startSession(path: string, init: RequestInit) {
  const { token, household } = await request<SessionResponse>(path, { method: "POST", ...init });
  // Only a token in the shape the API issues is kept in storage.
  if (!SESSION_TOKEN_PATTERN.test(token)) {
    throw new ApiError(UNAUTHORIZED_CODE, "Something went wrong. Try again in a moment.");
  }
  localStorage.setItem(SESSION_STORAGE_KEY, token);
  return household;
}

function safeMemberId(memberId: string) {
  return safeId(memberId, MEMBER_NOT_FOUND_CODE, "That flatmate no longer exists.");
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
