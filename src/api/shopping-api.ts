import { request, safeId } from "./client";

export type GroceryCategory = "produce" | "bakery" | "dairy" | "meat-fish" | "pantry" | "frozen" | "drinks" | "household" | "other";

export interface ShoppingItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: GroceryCategory;
  forDinners: string[];
  // Set for items added by hand; those can be removed again.
  extraId: string | null;
}

export interface ShoppingList {
  from: string;
  items: ShoppingItem[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ITEM_NOT_FOUND_CODE = "ITEM_NOT_FOUND";

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
};
