import type { Household } from "../api/households-api";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

const INVITE_NOT_FOUND = { error: "INVITE_NOT_FOUND", message: "This invite link doesn't work." };

// Mirrors the API's household, invite and session rules closely enough for UI tests.
export function createFakeHouseholdsServer() {
  const households = new Map<string, Omit<Household, "currentMemberId">>();
  const memberIdsByToken = new Map<string, string>();

  function householdOf(memberId: string) {
    return [...households.values()].find((household) =>
      household.members.some((member) => member.id === memberId),
    );
  }

  function startSession(household: Omit<Household, "currentMemberId">, memberId: string) {
    const token = `${crypto.randomUUID().replaceAll("-", "")}${"t".repeat(11)}`;
    memberIdsByToken.set(token, memberId);
    return json(201, { token, household: { ...household, currentMemberId: memberId } });
  }

  function addMember(household: Omit<Household, "currentMemberId">, name: string, hasJoined: boolean) {
    const member = { id: crypto.randomUUID(), name, hasJoined };
    household.members = [...household.members, member];
    return member;
  }

  async function handle(input: RequestInfo | URL, init?: RequestInit) {
    const { pathname } = new URL(String(input));
    const segments = pathname.split("/").filter(Boolean);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const name = String(body.name ?? "").trim();

    if (method === "POST" && pathname === "/households") {
      const household = { id: crypto.randomUUID(), name, inviteCode: "a".repeat(31) + households.size, members: [] };
      households.set(household.id, household);
      return startSession(household, addMember(household, body.memberName.trim(), true).id);
    }

    if (segments[0] === "invites") {
      const household = [...households.values()].find((candidate) => candidate.inviteCode === segments[1]);
      if (!household) {
        return json(404, INVITE_NOT_FOUND);
      }
      if (method === "GET") {
        return json(200, {
          householdId: household.id,
          householdName: household.name,
          membersToJoin: household.members.filter((member) => !member.hasJoined).map(({ id, name }) => ({ id, name })),
        });
      }
      if (segments[4] === "join") {
        const member = household.members.find((candidate) => candidate.id === segments[3]);
        if (!member || member.hasJoined) {
          return json(409, { error: "MEMBER_ALREADY_JOINED", message: "Pick another name." });
        }
        member.hasJoined = true;
        return startSession(household, member.id);
      }
      return startSession(household, addMember(household, name, true).id);
    }

    const token = new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? "";
    const currentMemberId = memberIdsByToken.get(token) ?? "";
    const household = householdOf(currentMemberId);
    if (!household) {
      return json(401, { error: "UNAUTHORIZED", message: "Please join a household first." });
    }
    const view = () => ({ ...household, currentMemberId });

    if (method === "POST") {
      if (household.members.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
        return json(409, { error: "DUPLICATE_MEMBER", message: `${name} is already a member.` });
      }
      addMember(household, name, false);
      return json(201, view());
    }
    if (method === "DELETE") {
      household.members = household.members.filter((member) => member.id !== segments[2]);
    }
    return json(200, view());
  }

  return { households, handle };
}
