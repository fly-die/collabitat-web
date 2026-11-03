import { useEffect, useId, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import { shoppingApi, type GroceryCategory, type ShoppingItem, type ShoppingList as List } from "../api/shopping-api";
import type { Undoable } from "../components/useUndoable";
import { useLiveTopic } from "../live/live-updates";
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

interface ShoppingListProps {
  monday: string;
  onUndoable: (undoable: Undoable) => void;
}

export function ShoppingList({ monday, onUndoable }: ShoppingListProps) {
  const fieldId = useId();
  const [list, setList] = useState<List>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [line, setLine] = useState("");
  const [error, setError] = useState<string>();
  // Dinners, recipes and items all change the list.
  useLiveTopic("meals", () => setLoadAttempt((attempt) => attempt + 1));

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
  }, [monday, loadAttempt]);

  async function run(change: () => Promise<List>) {
    setError(undefined);
    try {
      setList(await change());
    } catch (changeError) {
      setError((changeError as ApiError).message);
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

  const groups = (list?.items ?? []).reduce<{ category: GroceryCategory; items: ShoppingItem[] }[]>((grouped, item) => {
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
      <h2 id={`${fieldId}-heading`} className="section-title">
        Shopping list
      </h2>
      <form className="shopping__add" onSubmit={handleAdd}>
        <input
          className="text-input"
          aria-label="Add to the list"
          placeholder="2 l milk"
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
        <p className="empty-state">Plan dinners from recipes and what they need shows up here, added up and sorted like the shop.</p>
      )}
      {groups.map(({ category, items }) => (
        <div key={category} className="shopping__group">
          <h3 className="shopping__category">{CATEGORY_LABELS[category]}</h3>
          <ul className="panel" aria-label={CATEGORY_LABELS[category]}>
            {items.map((item) => (
              <li key={`${item.extraId ?? ""}${item.name}${item.unit ?? ""}`} className="panel__row expense">
                <span className="expense__text">
                  <span className="expense__description">{describeIngredient(item)}</span>
                  <span className="expense__meta">
                    <span>{item.extraId ? "Added by hand" : `For ${item.forDinners.join(", ")}`}</span>
                  </span>
                </span>
                {item.extraId && (
                  <button
                    className="button button--quiet expense__delete"
                    type="button"
                    aria-label={`Remove ${describeIngredient(item)}`}
                    onClick={() => remove(item, item.extraId as string)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
