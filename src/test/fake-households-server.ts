import type { Expense, NewExpense, Settlement, Transfer } from "../api/expenses-api";
import type { Household } from "../api/households-api";
import type { PlannedMeal, Recipe } from "../api/meals-api";
import type { NewTask, Task } from "../api/tasks-api";

type StoredHousehold = Omit<Household, "currentMemberId" | "currentMemberHasAccount">;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

const INVITE_NOT_FOUND = { error: "INVITE_NOT_FOUND", message: "This invite link doesn't work." };

// Mirrors the API's household, invite, session and expense rules closely enough for UI tests.
// pushPublicKey: the server's notification key; without it notifications are off, like a real server without keys.
export function createFakeHouseholdsServer({ pushPublicKey }: { pushPublicKey?: string } = {}) {
  // Devices with notifications on: endpoint to member id.
  const pushDevices = new Map<string, string>();
  const recipesByHouseholdId = new Map<string, Recipe[]>();
  const mealsByHouseholdId = new Map<string, PlannedMeal[]>();
  const extrasByHouseholdId = new Map<string, { id: string; line: string }[]>();
  const tripsByHouseholdId = new Map<string, { shopperMemberId: string; from: string; startedAt: string }>();
  // Ticked items as "<week>|<item key>".
  const checksByHouseholdId = new Map<string, Set<string>>();
  const notesByHouseholdId = new Map<string, { id: string; text: string; authorMemberId: string | null; doneAt: string | null; createdAt: string }[]>();
  const calendarColumnsByHouseholdId = new Map<string, { id: string; name: string; createdAt: string }[]>();
  const calendarEntriesByHouseholdId = new Map<
    string,
    { id: string; title: string; day: string; time: string | null; columnId: string | null; createdAt: string }[]
  >();

  // Like the API: seven days of dinners from `from`, and all recipes. Ingredients keep their whole line as the name.
  function weekOf(household: StoredHousehold, from: string) {
    const to = new Date(Date.parse(`${from}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
    const meals = (mealsByHouseholdId.get(household.id) ?? [])
      .filter((meal) => meal.date >= from && meal.date <= to)
      .sort((first, second) => first.date.localeCompare(second.date));
    const recipes = [...(recipesByHouseholdId.get(household.id) ?? [])].sort((first, second) => first.title.localeCompare(second.title));
    return { from, meals, recipes };
  }
  // A small stand-in for the API's list: one row per ingredient line, a few known categories.
  function shoppingListOf(household: StoredHousehold, from: string) {
    const categoryOf = (name: string) => (/milk|milch/i.test(name) ? "dairy" : /pasta/i.test(name) ? "pantry" : "other");
    const checks = checksByHouseholdId.get(household.id) ?? new Set<string>();
    const { meals, recipes } = weekOf(household, from);
    const fromDinners = meals.flatMap((meal) =>
      (recipes.find((recipe) => recipe.id === meal.recipeId)?.ingredients ?? []).map((ingredient) => ({
        ...ingredient, category: categoryOf(ingredient.name), forDinners: [meal.title], extraId: null, key: `dinner:${ingredient.name.toLowerCase()}`,
      })),
    );
    const byHand = (extrasByHouseholdId.get(household.id) ?? []).map((extra) => ({
      name: extra.line, quantity: null, unit: null, category: categoryOf(extra.line), forDinners: [], extraId: extra.id, key: `extra:${extra.id}`,
    }));
    const order = ["produce", "bakery", "dairy", "meat-fish", "pantry", "frozen", "drinks", "household", "other"];
    const items = [...fromDinners, ...byHand]
      .sort((first, second) => order.indexOf(first.category) - order.indexOf(second.category))
      .map((item) => ({ ...item, checked: checks.has(`${from}|${item.key}`) }));
    return { from, trip: tripsByHouseholdId.get(household.id) ?? null, items };
  }

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
  const settlementsByHouseholdId = new Map<string, Settlement[]>();
  const tasksByHouseholdId = new Map<string, (NewTask & { id: string; completions: { id: string; doneOn: string; memberId: string }[] })[]>();

  // Same rule as the API: one interval after the latest completion, months clamped to their last day.
  function addInterval(isoDate: string, every: number, unit: NewTask["unit"]) {
    const date = new Date(`${isoDate}T00:00:00Z`);
    if (unit === "month") {
      const day = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + every);
      date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
    } else {
      date.setUTCDate(date.getUTCDate() + (unit === "week" ? 7 : 1) * every);
    }
    return date.toISOString().slice(0, 10);
  }

  function tasksOf(household: StoredHousehold): { tasks: Task[] } {
    const tasks = (tasksByHouseholdId.get(household.id) ?? []).map(({ completions, ...task }) => {
      const latest = [...completions].sort((first, second) => second.doneOn.localeCompare(first.doneOn))[0];
      const memberIds = household.members.map((member) => member.id);
      const rotation = (task.rotationMemberIds ?? memberIds).filter((memberId) => memberIds.includes(memberId));
      const lastIndex = latest ? rotation.indexOf(latest.memberId) : -1;
      return {
        ...task,
        nextDueOn: latest ? addInterval(latest.doneOn, task.every, task.unit) : task.firstDueOn,
        lastCompletion: latest ?? null,
        rotation,
        turnMemberId: rotation.length === 0 ? null : rotation[lastIndex === -1 ? 0 : (lastIndex + 1) % rotation.length],
      };
    });
    return { tasks: tasks.sort((first, second) => first.nextDueOn.localeCompare(second.nextDueOn)) };
  }
  // Strictly increasing, so entries added within one millisecond still keep their order.
  let createdCount = 0;
  const nextCreatedAt = () => new Date(Date.UTC(2026, 0, 1) + (createdCount += 1)).toISOString();

  // Same greedy rule as the API: the biggest debtor pays the biggest creditor until all are square.
  function simplify(balances: { memberId: string; balanceCents: number }[]): Transfer[] {
    const remaining = balances.map((balance) => ({ ...balance }));
    const transfers: Transfer[] = [];
    const pick = (sign: number) =>
      remaining
        .filter((entry) => sign * entry.balanceCents > 0)
        .reduce<(typeof remaining)[number] | undefined>(
          (best, entry) => (!best || sign * entry.balanceCents > sign * best.balanceCents ? entry : best),
          undefined,
        );
    for (let debtor = pick(-1), creditor = pick(1); debtor && creditor; debtor = pick(-1), creditor = pick(1)) {
      const amountCents = Math.min(-debtor.balanceCents, creditor.balanceCents);
      transfers.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amountCents });
      debtor.balanceCents += amountCents;
      creditor.balanceCents -= amountCents;
    }
    return transfers;
  }

  function moneyOf(household: StoredHousehold) {
    const expenses = expensesByHouseholdId.get(household.id) ?? [];
    const settlements = settlementsByHouseholdId.get(household.id) ?? [];
    const balances = household.members.map((member) => ({
      memberId: member.id,
      balanceCents:
        expenses.reduce(
          (sum, expense) =>
            sum +
            (expense.paidByMemberId === member.id ? expense.amountCents : 0) -
            (expense.shares.find((share) => share.memberId === member.id)?.amountCents ?? 0),
          0,
        ) +
        settlements.reduce(
          (sum, settlement) =>
            sum +
            (settlement.fromMemberId === member.id ? settlement.amountCents : 0) -
            (settlement.toMemberId === member.id ? settlement.amountCents : 0),
          0,
        ),
    }));
    return { expenses, settlements, balances, transfers: simplify(balances) };
  }

  function toExpense(household: StoredHousehold, newExpense: NewExpense, id: string, createdAt: string): Expense {
    const memberIds = household.members
      .map((member) => member.id)
      .filter((memberId) => newExpense.splitBetweenMemberIds.includes(memberId));
    const baseShare = Math.floor(newExpense.amountCents / memberIds.length);
    const remainder = newExpense.amountCents % memberIds.length;
    return {
      id,
      description: newExpense.description.trim(),
      amountCents: newExpense.amountCents,
      paidByMemberId: newExpense.paidByMemberId,
      spentOn: newExpense.spentOn,
      createdAt,
      shares: memberIds.map((memberId, index) => ({
        memberId,
        amountCents: baseShare + (index < remainder ? 1 : 0),
      })),
    };
  }

  function sortedNewestFirst(expenses: Expense[]) {
    return expenses.sort((first, second) => second.spentOn.localeCompare(first.spentOn));
  }

  function addExpense(household: StoredHousehold, newExpense: NewExpense) {
    const expense = toExpense(household, newExpense, crypto.randomUUID(), nextCreatedAt());
    expensesByHouseholdId.set(
      household.id,
      sortedNewestFirst([expense, ...(expensesByHouseholdId.get(household.id) ?? [])]),
    );
    return expense;
  }

  function editExpense(household: StoredHousehold, expenseId: string, changes: NewExpense) {
    const expenses = expensesByHouseholdId.get(household.id) ?? [];
    expensesByHouseholdId.set(
      household.id,
      sortedNewestFirst(
        expenses.map((expense) =>
          expense.id === expenseId ? toExpense(household, changes, expense.id, expense.createdAt) : expense,
        ),
      ),
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

    if (pathname === "/push/public-key") {
      return pushPublicKey
        ? json(200, { publicKey: pushPublicKey })
        : json(404, { error: "PUSH_DISABLED", message: "Notifications aren't set up on this server." });
    }

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
    if (method === "POST" && pathname === "/household/account") {
      const problem = accountProblem(body);
      if (problem) {
        return problem;
      }
      addAccount(body, currentMemberId);
      return json(201, view());
    }

    if (segments[1] === "notes") {
      const notes = notesByHouseholdId.get(household.id) ?? [];
      const sorted = (list: typeof notes) => [
        ...list.filter((note) => !note.doneAt).reverse(),
        ...list.filter((note) => note.doneAt).sort((first, second) => String(second.doneAt).localeCompare(String(first.doneAt))),
      ];
      const [, , id] = segments;
      if (method === "GET") {
        return json(200, { notes: sorted(notes) });
      }
      if (method === "POST") {
        const text = String(body.text ?? "").trim();
        if (!text) {
          return json(400, { error: "INVALID_TEXT", message: "Write a note of up to 280 characters." });
        }
        const now = new Date().toISOString();
        const note = { id: crypto.randomUUID(), text, authorMemberId: currentMemberId, doneAt: body.done ? now : null, createdAt: now };
        notesByHouseholdId.set(household.id, [...notes, note]);
        return json(201, { note });
      }
      if (method === "PUT") {
        const changed = notes.map((note) => (note.id === id ? { ...note, doneAt: body.done ? new Date().toISOString() : null } : note));
        notesByHouseholdId.set(household.id, changed);
        return json(200, { note: changed.find((note) => note.id === id) });
      }
      if (method === "DELETE" && id === "done") {
        notesByHouseholdId.set(household.id, notes.filter((note) => !note.doneAt));
        return json(200, { removed: sorted(notes.filter((note) => note.doneAt)) });
      }
      if (method === "DELETE") {
        notesByHouseholdId.set(household.id, notes.filter((note) => note.id !== id));
        return new Response(null, { status: 204 });
      }
    }

    if (segments[1] === "calendar") {
      const columns = calendarColumnsByHouseholdId.get(household.id) ?? [];
      const entries = calendarEntriesByHouseholdId.get(household.id) ?? [];
      const [, , kind, id] = segments;
      if (method === "GET") {
        const from = new URL(String(input)).searchParams.get("from") ?? "";
        const to = new Date(Date.parse(`${from}T00:00:00Z`) + 27 * 86_400_000).toISOString().slice(0, 10);
        const inRange = entries
          .filter((entry) => entry.day >= from && entry.day <= to)
          .sort((first, second) => first.day.localeCompare(second.day) || (first.time ?? "").localeCompare(second.time ?? ""));
        return json(200, { from, to, columns, entries: inRange });
      }
      if (kind === "columns" && method === "POST") {
        if (!name) {
          return json(400, { error: "INVALID_COLUMN_NAME", message: "Give the column a name of up to 30 characters." });
        }
        const column = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
        calendarColumnsByHouseholdId.set(household.id, [...columns, column]);
        return json(201, { column });
      }
      if (kind === "columns" && method === "DELETE") {
        const column = columns.find((candidate) => candidate.id === id);
        const upcoming = entries.filter((entry) => entry.columnId === id).length;
        if (column && upcoming > 0) {
          return json(409, { error: "COLUMN_HAS_DATES", message: `${column.name} still has ${upcoming} upcoming date${upcoming === 1 ? "" : "s"}. Move or remove them first.` });
        }
        calendarColumnsByHouseholdId.set(household.id, columns.filter((candidate) => candidate.id !== id));
        return new Response(null, { status: 204 });
      }
      if (kind === "entries" && (method === "POST" || method === "PUT")) {
        const existing = entries.find((entry) => entry.id === id);
        const entry = {
          id: existing?.id ?? crypto.randomUUID(),
          title: String(body.title).trim(),
          day: body.day,
          time: body.time ?? null,
          columnId: body.columnId ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        calendarEntriesByHouseholdId.set(household.id, [...entries.filter((candidate) => candidate.id !== entry.id), entry]);
        return json(method === "POST" ? 201 : 200, { entry });
      }
      if (kind === "entries" && method === "DELETE") {
        calendarEntriesByHouseholdId.set(household.id, entries.filter((entry) => entry.id !== id));
        return new Response(null, { status: 204 });
      }
    }

    if (segments[1] === "shopping-list" || segments[1] === "shopping-trip") {
      const from = new URL(String(input)).searchParams.get("from") ?? "";
      const extras = extrasByHouseholdId.get(household.id) ?? [];
      const checks = checksByHouseholdId.get(household.id) ?? new Set<string>();
      checksByHouseholdId.set(household.id, checks);
      if (segments[1] === "shopping-trip") {
        const trip = tripsByHouseholdId.get(household.id);
        if (method === "GET") {
          return json(200, trip ? shoppingListOf(household, trip.from) : { trip: null });
        }
        if (method === "POST" && segments[2] === "checkout") {
          const expense = addExpense(household, body);
          const bought = shoppingListOf(household, from).items.flatMap((item) => (item.checked && item.extraId ? [item.extraId] : []));
          extrasByHouseholdId.set(household.id, extras.filter((extra) => !bought.includes(extra.id)));
          tripsByHouseholdId.delete(household.id);
          return json(201, { ...shoppingListOf(household, from), expenseId: expense.id });
        }
        if (method === "POST" && !trip) {
          tripsByHouseholdId.set(household.id, { shopperMemberId: currentMemberId, from, startedAt: new Date().toISOString() });
        }
        if (method === "DELETE") {
          tripsByHouseholdId.delete(household.id);
        }
        return json(method === "POST" ? 201 : 200, shoppingListOf(household, from));
      }
      if (segments[2] === "checks") {
        if (body.checked) {
          checks.add(`${from}|${body.key}`);
        } else {
          checks.delete(`${from}|${body.key}`);
        }
      } else if (method === "POST") {
        extras.push({ id: crypto.randomUUID(), line: body.line.trim() });
      }
      if (method === "DELETE") {
        extrasByHouseholdId.set(household.id, extras.filter((extra) => extra.id !== segments[3]));
      } else {
        extrasByHouseholdId.set(household.id, extras);
      }
      return json(method === "POST" ? 201 : 200, shoppingListOf(household, from));
    }

    if (segments[1] === "meals" || segments[1] === "recipes") {
      const from = new URL(String(input)).searchParams.get("from") ?? "";
      const recipes = recipesByHouseholdId.get(household.id) ?? [];
      const meals = (mealsByHouseholdId.get(household.id) ?? []).filter((meal) => meal.date !== segments[2]);
      if (segments[1] === "recipes" && method === "POST") {
        const ingredients = body.ingredientLines
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((name: string) => ({ quantity: null, unit: null, name }));
        recipesByHouseholdId.set(household.id, [...recipes, { id: crypto.randomUUID(), title: body.title.trim(), servings: body.servings, ingredients }]);
        return json(201, weekOf(household, from));
      }
      if (segments[1] === "recipes" && method === "DELETE") {
        recipesByHouseholdId.set(household.id, recipes.filter((recipe) => recipe.id !== segments[2]));
      }
      if (segments[1] === "meals" && method === "PUT") {
        const recipe = recipes.find((candidate) => candidate.id === body.recipeId);
        meals.push({ date: segments[2], title: body.title || recipe?.title || "", recipeId: recipe?.id ?? null, cookMemberId: body.cookMemberId ?? null });
      }
      if (segments[1] === "meals" && method !== "GET") {
        mealsByHouseholdId.set(household.id, meals);
      }
      return json(200, weekOf(household, from));
    }

    if (segments[1] === "push-subscription") {
      if (method === "PUT") {
        pushDevices.set(body.endpoint, currentMemberId);
      } else {
        pushDevices.delete(body.endpoint);
      }
      return new Response(null, { status: 204 });
    }

    if (segments[1] === "tasks") {
      const tasks = tasksByHouseholdId.get(household.id) ?? [];
      const task = tasks.find((candidate) => candidate.id === segments[2]);
      if (method === "POST" && !segments[2]) {
        tasksByHouseholdId.set(household.id, [...tasks, { ...body, title: body.title.trim(), id: crypto.randomUUID(), completions: [] }]);
        return json(201, tasksOf(household));
      }
      if (segments[2] && !task) {
        return json(404, { error: "TASK_NOT_FOUND", message: "That chore is already gone." });
      }
      if (task && method === "POST") {
        task.completions.push({ id: crypto.randomUUID(), doneOn: body.doneOn, memberId: currentMemberId });
        return json(201, tasksOf(household));
      }
      if (task && method === "DELETE" && segments[3] === "completions") {
        task.completions = task.completions.filter((completion) => completion.id !== segments[4]);
      } else if (task && method === "DELETE") {
        tasksByHouseholdId.set(household.id, tasks.filter((candidate) => candidate !== task));
      }
      return json(200, tasksOf(household));
    }

    if (segments[1] === "settlements") {
      const settlements = settlementsByHouseholdId.get(household.id) ?? [];
      if (method === "POST") {
        settlementsByHouseholdId.set(household.id, [
          { id: crypto.randomUUID(), ...body, createdAt: nextCreatedAt() },
          ...settlements,
        ]);
        return json(201, moneyOf(household));
      }
      settlementsByHouseholdId.set(
        household.id,
        settlements.filter((settlement) => settlement.id !== segments[2]),
      );
      return json(200, moneyOf(household));
    }

    if (segments[1] === "expenses") {
      if (method === "POST") {
        addExpense(household, body);
        return json(201, moneyOf(household));
      }
      if (method === "PUT") {
        editExpense(household, segments[2], body);
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
    const isInExpenses =
      (expensesByHouseholdId.get(household.id) ?? []).some(
        (expense) =>
          expense.paidByMemberId === segments[2] || expense.shares.some((share) => share.memberId === segments[2]),
      ) ||
      (settlementsByHouseholdId.get(household.id) ?? []).some(
        (settlement) => settlement.fromMemberId === segments[2] || settlement.toMemberId === segments[2],
      );
    if (method === "DELETE" && isInExpenses) {
      const member = household.members.find((candidate) => candidate.id === segments[2]);
      return json(409, {
        error: "MEMBER_HAS_EXPENSES",
        message: `${member?.name} is part of some expenses or payments, so they stay in the household.`,
      });
    }
    if (method === "DELETE") {
      household.members = household.members.filter((member) => member.id !== segments[2]);
    }
    return json(200, view());
  }

  // Stands in for a flatmate who joined before accounts existed.
  function startSessionWithoutAccount(householdName: string, memberName: string) {
    const household = { id: crypto.randomUUID(), name: householdName, inviteCode: "b".repeat(32), members: [] };
    households.set(household.id, household);
    const token = `${crypto.randomUUID().replaceAll("-", "")}${"t".repeat(11)}`;
    memberIdsByToken.set(token, addMember(household, memberName, true).id);
    return token;
  }

  return { households, handle, startSessionWithoutAccount, pushDevices };
}
