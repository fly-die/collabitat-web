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

export interface Money {
  expenses: Expense[];
  balances: Balance[];
}

const EXPENSE_NOT_FOUND_CODE = "EXPENSE_NOT_FOUND";

export const expensesApi = {
  get: () => request<Money>("/household/expenses"),
  add: (expense: NewExpense) =>
    request<Money>("/household/expenses", { method: "POST", body: JSON.stringify(expense) }),
  remove: (expenseId: string) =>
    request<Money>(
      `/household/expenses/${safeId(expenseId, EXPENSE_NOT_FOUND_CODE, "That expense is already gone.")}`,
      { method: "DELETE" },
    ),
};
