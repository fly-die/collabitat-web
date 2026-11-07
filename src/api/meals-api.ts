import { request, safeId } from "./client";

export interface Ingredient {
  quantity: number | null;
  unit: string | null;
  name: string;
}

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  ingredients: Ingredient[];
}

export type MealSlot = "breakfast" | "lunch" | "dinner";

// Weekdays as 1 (Monday) to 7 (Sunday) that also get breakfast or lunch; dinner is always planned.
export interface MealTimes {
  breakfast: number[];
  lunch: number[];
}

export interface PlannedMeal {
  date: string;
  slot: MealSlot;
  title: string;
  recipeId: string | null;
  cookMemberId: string | null;
  // How many eat, for a meal from a recipe; null means the recipe's own servings.
  servings: number | null;
}

// A dish the household had before: when last, and how often in the past year.
export interface PastMeal {
  title: string;
  recipeId: string | null;
  lastOn: string;
  times: number;
}

export interface MealPlan {
  title: string;
  recipeId: string | null;
  cookMemberId: string | null;
  servings?: number | null;
}

export interface NewRecipe {
  title: string;
  servings: number;
  ingredientLines: string[];
}

export interface MealWeek {
  from: string;
  meals: PlannedMeal[];
  recipes: Recipe[];
  mealTimes: MealTimes;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RECIPE_NOT_FOUND_CODE = "RECIPE_NOT_FOUND";

// Dates come from our own week maths, but only ever reach a URL in this exact shape.
const safeDate = (isoDate: string) => {
  if (!ISO_DATE_PATTERN.test(isoDate)) {
    throw new Error(`Not a date: ${isoDate}`);
  }
  return isoDate;
};

const week = (from: string) => `from=${safeDate(from)}`;

export const mealsApi = {
  week: (from: string) => request<MealWeek>(`/household/meals?${week(from)}`),
  history: (before: string) => request<{ pastMeals: PastMeal[] }>(`/household/meals/history?before=${safeDate(before)}`),
  plan: (from: string, date: string, plan: MealPlan, slot: MealSlot = "dinner") =>
    request<MealWeek>(`/household/meals/${safeDate(date)}?${week(from)}&slot=${slot}`, { method: "PUT", body: JSON.stringify(plan) }),
  clear: (from: string, date: string, slot: MealSlot = "dinner") =>
    request<MealWeek>(`/household/meals/${safeDate(date)}?${week(from)}&slot=${slot}`, { method: "DELETE" }),
  setMealTimes: (from: string, times: MealTimes) =>
    request<MealWeek>(`/household/meal-times?${week(from)}`, { method: "PUT", body: JSON.stringify(times) }),
  addRecipe: (from: string, recipe: NewRecipe) =>
    request<MealWeek>(`/household/recipes?${week(from)}`, { method: "POST", body: JSON.stringify(recipe) }),
  updateRecipe: (from: string, recipeId: string, recipe: NewRecipe) =>
    request<MealWeek>(
      `/household/recipes/${safeId(recipeId, RECIPE_NOT_FOUND_CODE, "That recipe is already gone.")}?${week(from)}`,
      { method: "PUT", body: JSON.stringify(recipe) },
    ),
  // Reads a recipe from a web page; nothing is saved until the person saves it.
  importRecipe: (link: string) => request<NewRecipe>("/household/recipe-import", { method: "POST", body: JSON.stringify({ link }) }),
  removeRecipe: (from: string, recipeId: string) =>
    request<MealWeek>(
      `/household/recipes/${safeId(recipeId, RECIPE_NOT_FOUND_CODE, "That recipe is already gone.")}?${week(from)}`,
      { method: "DELETE" },
    ),
};
