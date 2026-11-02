import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import { useLiveTopic } from "../live/live-updates";
import { expensesApi, type Money, type NewExpense, type NewSettlement } from "../api/expenses-api";

type MoneyState =
  | { status: "loading" }
  | { status: "ready"; money: Money }
  | { status: "unreachable"; message: string };

export function useMoney() {
  const [state, setState] = useState<MoneyState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  // A flatmate changed something: reload in place, without showing the loading state.
  useLiveTopic("money", () => setLoadAttempt((attempt) => attempt + 1));

  useEffect(() => {
    let isCurrent = true;
    expensesApi
      .get()
      .then((money) => {
        if (isCurrent) {
          setState({ status: "ready", money });
        }
      })
      .catch((error: ApiError) => {
        if (isCurrent) {
          setState({ status: "unreachable", message: error.message });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [loadAttempt]);

  const retry = () => {
    setState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  };

  const addExpense = async (expense: NewExpense) =>
    setState({ status: "ready", money: await expensesApi.add(expense) });

  const editExpense = async (expenseId: string, expense: NewExpense) =>
    setState({ status: "ready", money: await expensesApi.edit(expenseId, expense) });

  const removeExpense = async (expenseId: string) =>
    setState({ status: "ready", money: await expensesApi.remove(expenseId) });

  // Answers with the money view, so the caller can tell which payment is new.
  const settle = async (settlement: NewSettlement) => {
    const money = await expensesApi.settle(settlement);
    setState({ status: "ready", money });
    return money;
  };

  const removeSettlement = async (settlementId: string) =>
    setState({ status: "ready", money: await expensesApi.removeSettlement(settlementId) });

  return { state, retry, addExpense, editExpense, removeExpense, settle, removeSettlement };
}
