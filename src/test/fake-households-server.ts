import type { Household } from "../api/households-api";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

export function createFakeHouseholdsServer() {
  const households = new Map<string, Household>();
  async function handle(input: RequestInfo | URL, init?: RequestInit) {
    const { pathname } = new URL(String(input));
    const [, , householdId, , memberId] = pathname.split("/");
    const method = init?.method ?? "GET";
    const name = init?.body ? (JSON.parse(String(init.body)).name as string).trim() : "";

    if (method === "POST" && !householdId) {
      const household = { id: crypto.randomUUID(), name, members: [] };
      households.set(household.id, household);
      return json(201, household);
    }

    const household = households.get(householdId);
    if (!household) {
      return json(404, { error: "HOUSEHOLD_NOT_FOUND", message: "Household not found." });
    }
    if (method === "GET") {
      return json(200, household);
    }
    if (method === "POST") {
      if (household.members.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
        return json(409, { error: "DUPLICATE_MEMBER", message: `${name} is already a member.` });
      }
      household.members = [...household.members, { id: crypto.randomUUID(), name }];
      return json(201, household);
    }
    household.members = household.members.filter((member) => member.id !== memberId);
    return json(200, household);
  }

  return { households, handle };
}
