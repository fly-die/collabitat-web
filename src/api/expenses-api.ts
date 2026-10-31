import { request, safeId } from "./client";

export interface ExpenseShare {
  memberId: string;
  amountCents: number;
}

export interface Expense {
  id: string;
  description: string;
  amountCents: number;
  paidByMemberId: string;
  spentOn: string;
  shares: ExpenseShare[];
  createdAt: string;
}

export interface NewExpense {
  description: string;
  amountCents: number;
  paidByMemberId: string;
  splitBetweenMemberIds: string[];
  spentOn: string;
}

export interface Balance {
  memberId: string;
  // Positive: the household owes this member. Negative: this member owes the household.
  balanceCents: number;
}

// A payment from one flatmate to another.
export interface Settlement {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  settledOn: string;
  createdAt: string;
}

export type NewSettlement = Omit<Settlement, "id" | "createdAt">;

// A suggested payment; together they settle the household with as few payments as possible.
export type Transfer = Omit<Settlement, "id" | "settledOn" | "createdAt">;

export interface Money {
  expenses: Expense[];
  settlements: Settlement[];
  balances: Balance[];
  transfers: Transfer[];
}

const EXPENSE_NOT_FOUND_CODE = "EXPENSE_NOT_FOUND";
const SETTLEMENT_NOT_FOUND_CODE = "SETTLEMENT_NOT_FOUND";

export const expensesApi = {
  get: () => request<Money>("/household/expenses"),
  add: (expense: NewExpense) =>
    request<Money>("/household/expenses", { method: "POST", body: JSON.stringify(expense) }),
  remove: (expenseId: string) =>
    request<Money>(
      `/household/expenses/${safeId(expenseId, EXPENSE_NOT_FOUND_CODE, "That expense is already gone.")}`,
      { method: "DELETE" },
    ),
  settle: (settlement: NewSettlement) =>
    request<Money>("/household/settlements", { method: "POST", body: JSON.stringify(settlement) }),
  removeSettlement: (settlementId: string) =>
    request<Money>(
      `/household/settlements/${safeId(settlementId, SETTLEMENT_NOT_FOUND_CODE, "That payment is already gone.")}`,
      { method: "DELETE" },
    ),
};
