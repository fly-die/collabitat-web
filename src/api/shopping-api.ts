import { request, safeId } from "./client";
import type { NewExpense } from "./expenses-api";

export type GroceryCategory = "produce" | "bakery" | "dairy" | "meat-fish" | "pantry" | "frozen" | "drinks" | "household" | "other";

export interface ShoppingItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: GroceryCategory;
  forDinners: string[];
  // Set for items added by hand; those can be removed again.
  extraId: string | null;
  // Stays the same while amounts change, so a ticked item stays ticked.
  key: string;
  checked: boolean;
}

// Someone is at the shop with one week's list.
export interface ShoppingTrip {
  shopperMemberId: string;
  from: string;
  startedAt: string;
}

export interface ShoppingList {
  from: string;
  trip: ShoppingTrip | null;
  items: ShoppingItem[];
}

export type CheckedOut = ShoppingList & { expenseId: string };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ITEM_NOT_FOUND_CODE = "ITEM_NOT_FOUND";

// Only a plain whole number reaches the URL.
const wholeNumber = (value: number) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Not a number of people: ${value}`);
  }
  return String(value);
};

const week = (from: string) => {
  if (!ISO_DATE_PATTERN.test(from)) {
    throw new Error(`Not a date: ${from}`);
  }
  return `from=${from}`;
};

export const shoppingApi = {
  list: (from: string) => request<ShoppingList>(`/household/shopping-list?${week(from)}`),
  add: (from: string, line: string) =>
    request<ShoppingList>(`/household/shopping-list/items?${week(from)}`, { method: "POST", body: JSON.stringify({ line }) }),
  remove: (from: string, itemId: string) =>
    request<ShoppingList>(
      `/household/shopping-list/items/${safeId(itemId, ITEM_NOT_FOUND_CODE, "That item is already gone.")}?${week(from)}`,
      { method: "DELETE" },
    ),
  // A recipe's ingredients for that many people, as items added by hand; the ids are for taking them off again.
  addRecipe: (from: string, recipeId: string, servings: number) =>
    request<ShoppingList & { addedItemIds: string[] }>(
      `/household/shopping-list/recipes/${safeId(recipeId, ITEM_NOT_FOUND_CODE, "That recipe is already gone.")}?${week(from)}&servings=${wholeNumber(servings)}`,
      { method: "POST" },
    ),
  check: (from: string, key: string, checked: boolean) =>
    request<ShoppingList>(`/household/shopping-list/checks?${week(from)}`, { method: "PUT", body: JSON.stringify({ key, checked }) }),
  // The list someone is shopping right now, whichever week it is.
  currentTrip: () => request<ShoppingList | { trip: null }>("/household/shopping-trip"),
  startTrip: (from: string) => request<ShoppingList>(`/household/shopping-trip?${week(from)}`, { method: "POST" }),
  stopTrip: (from: string) => request<ShoppingList>(`/household/shopping-trip?${week(from)}`, { method: "DELETE" }),
  checkout: (from: string, expense: NewExpense) =>
    request<CheckedOut>(`/household/shopping-trip/checkout?${week(from)}`, { method: "POST", body: JSON.stringify(expense) }),
};
