import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import { mealsApi, type MealPlan, type MealSlot, type MealTimes, type MealWeek, type NewRecipe } from "../api/meals-api";
import { useLiveTopic } from "../live/live-updates";

type MealsState = { status: "loading" } | { status: "ready"; week: MealWeek } | { status: "unreachable"; message: string };

export function useMeals(monday: string) {
  const [state, setState] = useState<MealsState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  // A flatmate changed something: reload in place, without showing the loading state.
  useLiveTopic("meals", () => setLoadAttempt((attempt) => attempt + 1));

  useEffect(() => {
    let isCurrent = true;
    mealsApi
      .week(monday)
      .then((week) => {
        if (isCurrent) {
          setState({ status: "ready", week });
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
  }, [monday, loadAttempt]);

  const apply = async (change: Promise<MealWeek>) => {
    const week = await change;
    setState({ status: "ready", week });
    return week;
  };

  return {
    state,
    retry: () => {
      setState({ status: "loading" });
      setLoadAttempt((attempt) => attempt + 1);
    },
    plan: (date: string, plan: MealPlan, slot?: MealSlot) => apply(mealsApi.plan(monday, date, plan, slot)),
    clear: (date: string, slot?: MealSlot) => apply(mealsApi.clear(monday, date, slot)),
    setMealTimes: (times: MealTimes) => apply(mealsApi.setMealTimes(monday, times)),
    addRecipe: (recipe: NewRecipe) => apply(mealsApi.addRecipe(monday, recipe)),
    updateRecipe: (recipeId: string, recipe: NewRecipe) => apply(mealsApi.updateRecipe(monday, recipeId, recipe)),
    removeRecipe: (recipeId: string) => apply(mealsApi.removeRecipe(monday, recipeId)),
  };
}
