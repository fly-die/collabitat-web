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

export interface PlannedMeal {
  date: string;
  title: string;
  recipeId: string | null;
  cookMemberId: string | null;
}

export interface MealPlan {
  title: string;
  recipeId: string | null;
  cookMemberId: string | null;
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
  plan: (from: string, date: string, plan: MealPlan) =>
    request<MealWeek>(`/household/meals/${safeDate(date)}?${week(from)}`, { method: "PUT", body: JSON.stringify(plan) }),
  clear: (from: string, date: string) =>
    request<MealWeek>(`/household/meals/${safeDate(date)}?${week(from)}`, { method: "DELETE" }),
  addRecipe: (from: string, recipe: NewRecipe) =>
    request<MealWeek>(`/household/recipes?${week(from)}`, { method: "POST", body: JSON.stringify(recipe) }),
  updateRecipe: (from: string, recipeId: string, recipe: NewRecipe) =>
    request<MealWeek>(
      `/household/recipes/${safeId(recipeId, RECIPE_NOT_FOUND_CODE, "That recipe is already gone.")}?${week(from)}`,
      { method: "PUT", body: JSON.stringify(recipe) },
    ),
  removeRecipe: (from: string, recipeId: string) =>
    request<MealWeek>(
      `/household/recipes/${safeId(recipeId, RECIPE_NOT_FOUND_CODE, "That recipe is already gone.")}?${week(from)}`,
      { method: "DELETE" },
    ),
};
