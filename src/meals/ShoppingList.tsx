import { useEffect, useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import { expensesApi, type NewExpense } from "../api/expenses-api";
import type { Household } from "../api/households-api";
import { shoppingApi, type GroceryCategory, type ShoppingItem, type ShoppingList as List } from "../api/shopping-api";
import { Sheet } from "../components/Sheet";
import type { Undoable } from "../components/useUndoable";
import { useLiveTopic } from "../live/live-updates";
import { ExpenseScreen } from "../money/ExpenseScreen";
import { formatAmount } from "../money/money-format";
import { describeIngredient } from "./week";

// The server sends items in shop order; these are the aisle names shown above each group.
const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: "Fruit and vegetables",
  bakery: "Bread",
  dairy: "Dairy and eggs",
  "meat-fish": "Meat and fish",
  pantry: "Pantry",
  frozen: "Frozen",
  drinks: "Drinks",
  household: "Household",
  other: "Other",
};
const GROCERIES = "Groceries";

interface ShoppingListProps {
  household: Household;
  monday: string;
  onUndoable: (undoable: Undoable) => void;
  // The checkout dialog opened or closed, so the screen behind it rests or wakes up.
  onSheetChange: (isOpen: boolean) => void;
  // Goes up when something else changed the list, like a recipe added to it.
  changeCount: number;
}

// Unticked first, ticked at the end, each in the order the list gives them.
const tickedLast = (items: ShoppingItem[]) => [...items.filter((item) => !item.checked), ...items.filter((item) => item.checked)];

// Most likely still at the till: the expense goes, the trip goes on, and what was bought is back in the basket.
async function undoCheckout(tripFrom: string, expenseId: string, boughtLines: string[]) {
  await expensesApi.remove(expenseId);
  let list = await shoppingApi.startTrip(tripFrom);
  for (const line of boughtLines) {
    const known = new Set(list.items.map((item) => item.key));
    list = await shoppingApi.add(tripFrom, line);
    const added = list.items.find((item) => !known.has(item.key));
    if (added) {
      list = await shoppingApi.check(tripFrom, added.key, true);
    }
  }
}

// "You're shopping" or "Lea is shopping".
export function shopperIs(household: Household, shopperMemberId: string) {
  if (shopperMemberId === household.currentMemberId) {
    return "You're";
  }
  return `${household.members.find((member) => member.id === shopperMemberId)?.name ?? "Someone"} is`;
}

export function basketCount(items: ShoppingItem[]) {
  return `${items.filter((item) => item.checked).length} of ${items.length} in the basket`;
}

export function ShoppingList({ household, monday, onUndoable, onSheetChange, changeCount }: ShoppingListProps) {
  const fieldId = useId();
  const [list, setList] = useState<List>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [line, setLine] = useState("");
  const [error, setError] = useState<string>();
  // The week of the trip being paid for, while the checkout dialog is open.
  const [checkoutFrom, setCheckoutFrom] = useState<string>();
  const reload = () => setLoadAttempt((attempt) => attempt + 1);
  // Dinners, recipes, items, ticks and trips all change the list.
  useLiveTopic("meals", reload);

  useEffect(() => {
    let isCurrent = true;
    shoppingApi
      .list(monday)
      .then((loaded) => {
        if (isCurrent) {
          setList(loaded);
        }
      })
      .catch((loadError: ApiError) => {
        if (isCurrent) {
          setError(loadError.message);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [monday, loadAttempt, changeCount]);

  async function run(change: () => Promise<List>) {
    setError(undefined);
    try {
      setList(await change());
    } catch (changeError) {
      setError((changeError as ApiError).message);
      reload();
    }
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!line.trim()) {
      return;
    }
    const added = line;
    setLine("");
    void run(() => shoppingApi.add(monday, added));
  }

  function remove(item: ShoppingItem, extraId: string) {
    void run(() => shoppingApi.remove(monday, extraId));
    const typed = describeIngredient(item);
    onUndoable({ message: `${typed} removed.`, undo: () => run(() => shoppingApi.add(monday, typed)) });
  }

  // Ticks show at once: in a shop the signal can be slow.
  function toggle(item: ShoppingItem) {
    const checked = !item.checked;
    setList(
      (current) =>
        current && { ...current, items: current.items.map((candidate) => (candidate.key === item.key ? { ...candidate, checked } : candidate)) },
    );
    void run(() => shoppingApi.check(monday, item.key, checked));
  }

  function openCheckout(tripFrom: string) {
    setCheckoutFrom(tripFrom);
    onSheetChange(true);
  }

  function closeCheckout() {
    setCheckoutFrom(undefined);
    onSheetChange(false);
  }

  async function checkOut(tripFrom: string, expense: NewExpense) {
    // Checkout takes ticked items added by hand off the list; undo puts them back.
    const bought = (await shoppingApi.list(tripFrom)).items.filter((item) => item.checked && item.extraId).map(describeIngredient);
    const { expenseId } = await shoppingApi.checkout(tripFrom, expense);
    reload();
    onUndoable({
      message: `${expense.description} for ${formatAmount(expense.amountCents)} added to Money.`,
      undo: async () => {
        await undoCheckout(tripFrom, expenseId, bought);
        reload();
      },
    });
  }

  const items = list?.items ?? [];
  const trip = list?.trip ?? null;
  const isMyTrip = trip?.shopperMemberId === household.currentMemberId;
  const groups = items.reduce<{ category: GroceryCategory; items: ShoppingItem[] }[]>((grouped, item) => {
    const last = grouped[grouped.length - 1];
    if (last?.category === item.category) {
      last.items.push(item);
    } else {
      grouped.push({ category: item.category, items: [item] });
    }
    return grouped;
  }, []);

  return (
    <section className="chores__group" aria-labelledby={`${fieldId}-heading`}>
      <div className="shopping__header">
        <h2 id={`${fieldId}-heading`} className="section-title">
          Shopping list
        </h2>
        {!trip && items.length > 0 && (
          <button className="button button--outline shopping__start" type="button" onClick={() => void run(() => shoppingApi.startTrip(monday))}>
            Start shopping
          </button>
        )}
      </div>
      {trip && (
        <div className="shopping__trip">
          <p className="shopping__trip-status" aria-live="polite">
            {shopperIs(household, trip.shopperMemberId)} shopping.
            {trip.from === monday && items.length > 0 && ` ${basketCount(items)}.`}
            {!isMyTrip && " What you add shows up for them right away."}
          </p>
          {isMyTrip && (
            <div className="shopping__trip-actions">
              <button className="button" type="button" onClick={() => openCheckout(trip.from)}>
                Check out
              </button>
              <button className="button button--quiet" type="button" onClick={() => void run(() => shoppingApi.stopTrip(trip.from))}>
                Stop shopping
              </button>
            </div>
          )}
        </div>
      )}
      <form className="shopping__add" onSubmit={handleAdd}>
        <input
          className="text-input"
          aria-label="Add to the list"
          placeholder="Yoghurt"
          autoComplete="off"
          value={line}
          onChange={(event) => setLine(event.target.value)}
        />
        <button className="button" type="submit">
          Add
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {list && groups.length === 0 && (
        <p className="empty-state">Nothing on the list yet.</p>
      )}
      {groups.map(({ category, items: inCategory }) => (
        <div key={category} className="shopping__group">
          <h3 className="shopping__category">{CATEGORY_LABELS[category]}</h3>
          <ul className="panel" aria-label={CATEGORY_LABELS[category]}>
            {tickedLast(inCategory).map((item) => (
              <li key={item.key} className={`panel__row expense shopping__item${item.checked ? " shopping__item--checked" : ""}`}>
                <label className="shopping__tick">
                  <input type="checkbox" aria-label={describeIngredient(item)} checked={item.checked} onChange={() => toggle(item)} />
                  <span className="expense__text">
                    <span className="expense__description">{describeIngredient(item)}</span>
                    <span className="expense__meta">
                      <span>{item.forDinners.length > 0 ? `For ${item.forDinners.join(", ")}` : "Added by hand"}</span>
                    </span>
                  </span>
                </label>
                {item.extraId && (
                  <button
                    className="shopping__remove"
                    type="button"
                    aria-label={`Remove ${describeIngredient(item)}`}
                    onClick={() => remove(item, item.extraId as string)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 7l10 10M17 7L7 17" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {checkoutFrom && (
        <Sheet label="Check out" onClose={closeCheckout}>
          <ExpenseScreen
            household={household}
            title="What did you pay?"
            defaultDescription={GROCERIES}
            submitLabel="Add to Money"
            onSave={(expense) => checkOut(checkoutFrom, expense)}
            onBack={closeCheckout}
          />
        </Sheet>
      )}
    </section>
  );
}
