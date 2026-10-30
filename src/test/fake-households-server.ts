import type { Expense, NewExpense } from "../api/expenses-api";
import type { Household } from "../api/households-api";

type StoredHousehold = Omit<Household, "currentMemberId" | "currentMemberHasAccount">;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

const INVITE_NOT_FOUND = { error: "INVITE_NOT_FOUND", message: "This invite link doesn't work." };

// Mirrors the API's household, invite, session and expense rules closely enough for UI tests.
export function createFakeHouseholdsServer() {
  const households = new Map<string, StoredHousehold>();
  const memberIdsByToken = new Map<string, string>();
  const accountsByEmail = new Map<string, { password: string; memberIds: string[] }>();

  const hasAccount = (memberId: string) =>
    [...accountsByEmail.values()].some((account) => account.memberIds.includes(memberId));

  // Mirrors the API's account rules: a valid email, 8+ characters, one account per email.
  function accountProblem(body: { email?: string; password?: string }) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) {
      return json(400, { error: "INVALID_EMAIL", message: "Enter an email like lea@example.com." });
    }
    if (String(body.password ?? "").length < 8) {
      return json(400, { error: "INVALID_PASSWORD", message: "Use at least 8 characters for your password." });
    }
    if (accountsByEmail.has(email)) {
      return json(409, { error: "EMAIL_TAKEN", message: "There's already an account with this email. Log in instead." });
    }
    return undefined;
  }

  function addAccount(body: { email: string; password: string }, memberId: string) {
    accountsByEmail.set(body.email.trim().toLowerCase(), { password: body.password, memberIds: [memberId] });
  }
  const expensesByHouseholdId = new Map<string, Expense[]>();

  function moneyOf(household: StoredHousehold) {
    const expenses = expensesByHouseholdId.get(household.id) ?? [];
    const balances = household.members.map((member) => ({
      memberId: member.id,
      balanceCents: expenses.reduce(
        (sum, expense) =>
          sum +
          (expense.paidByMemberId === member.id ? expense.amountCents : 0) -
          (expense.shares.find((share) => share.memberId === member.id)?.amountCents ?? 0),
        0,
      ),
    }));
    return { expenses, balances };
  }

  function addExpense(household: StoredHousehold, newExpense: NewExpense) {
    const memberIds = household.members
      .map((member) => member.id)
      .filter((id) => newExpense.splitBetweenMemberIds.includes(id));
    const baseShare = Math.floor(newExpense.amountCents / memberIds.length);
    const remainder = newExpense.amountCents % memberIds.length;
    const expense: Expense = {
      id: crypto.randomUUID(),
      description: newExpense.description.trim(),
      amountCents: newExpense.amountCents,
      paidByMemberId: newExpense.paidByMemberId,
      spentOn: newExpense.spentOn,
      shares: memberIds.map((memberId, index) => ({
        memberId,
        amountCents: baseShare + (index < remainder ? 1 : 0),
      })),
    };
    const expenses = [expense, ...(expensesByHouseholdId.get(household.id) ?? [])];
    expensesByHouseholdId.set(
      household.id,
      expenses.sort((first, second) => second.spentOn.localeCompare(first.spentOn)),
    );
  }

  function householdOf(memberId: string) {
    return [...households.values()].find((household) =>
      household.members.some((member) => member.id === memberId),
    );
  }

  function startSession(household: StoredHousehold, memberId: string) {
    const token = `${crypto.randomUUID().replaceAll("-", "")}${"t".repeat(11)}`;
    memberIdsByToken.set(token, memberId);
    return json(201, {
      token,
      household: { ...household, currentMemberId: memberId, currentMemberHasAccount: hasAccount(memberId) },
    });
  }

  function addMember(household: StoredHousehold, name: string, hasJoined: boolean) {
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
      const problem = accountProblem(body);
      if (problem) {
        return problem;
      }
      const household = { id: crypto.randomUUID(), name, inviteCode: "a".repeat(31) + households.size, members: [] };
      households.set(household.id, household);
      const member = addMember(household, body.memberName.trim(), true);
      addAccount(body, member.id);
      return startSession(household, member.id);
    }

    if (method === "POST" && pathname === "/sessions") {
      const account = accountsByEmail.get(String(body.email).trim().toLowerCase());
      if (!account || account.password !== body.password) {
        return json(401, { error: "WRONG_CREDENTIALS", message: "That email and password don't match." });
      }
      const memberId = account.memberIds[account.memberIds.length - 1];
      const household = householdOf(memberId);
      return household
        ? startSession(household, memberId)
        : json(404, { error: "NO_HOUSEHOLD", message: "You're not in a household anymore." });
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
      const problem = accountProblem(body);
      if (problem) {
        return problem;
      }
      if (segments[4] === "join") {
        const member = household.members.find((candidate) => candidate.id === segments[3]);
        if (!member || member.hasJoined) {
          return json(409, { error: "MEMBER_ALREADY_JOINED", message: "Pick another name." });
        }
        member.hasJoined = true;
        addAccount(body, member.id);
        return startSession(household, member.id);
      }
      const member = addMember(household, name, true);
      addAccount(body, member.id);
      return startSession(household, member.id);
    }

    const token = new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? "";
    const currentMemberId = memberIdsByToken.get(token) ?? "";
    const household = householdOf(currentMemberId);
    if (!household) {
      return json(401, { error: "UNAUTHORIZED", message: "Please join a household first." });
    }
    const view = () => ({ ...household, currentMemberId, currentMemberHasAccount: hasAccount(currentMemberId) });

    if (method === "DELETE" && pathname === "/session") {
      memberIdsByToken.delete(token);
      return json(200, { loggedOut: true });
    }
    if (segments[1] === "expenses") {
      if (method === "POST") {
        addExpense(household, body);
        return json(201, moneyOf(household));
      }
      if (method === "DELETE") {
        expensesByHouseholdId.set(
          household.id,
          (expensesByHouseholdId.get(household.id) ?? []).filter((expense) => expense.id !== segments[2]),
        );
      }
      return json(200, moneyOf(household));
    }

    if (method === "POST") {
      if (household.members.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
        return json(409, { error: "DUPLICATE_MEMBER", message: `${name} is already a member.` });
      }
      addMember(household, name, false);
      return json(201, view());
    }
    const isInExpenses = (expensesByHouseholdId.get(household.id) ?? []).some(
      (expense) =>
        expense.paidByMemberId === segments[2] || expense.shares.some((share) => share.memberId === segments[2]),
    );
    if (method === "DELETE" && isInExpenses) {
      const member = household.members.find((candidate) => candidate.id === segments[2]);
      return json(409, {
        error: "MEMBER_HAS_EXPENSES",
        message: `${member?.name} is part of some expenses, so they stay in the household.`,
      });
    }
    if (method === "DELETE") {
      household.members = household.members.filter((member) => member.id !== segments[2]);
    }
    return json(200, view());
  }

  return { households, handle };
}
