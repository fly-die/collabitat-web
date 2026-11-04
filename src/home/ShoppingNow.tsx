import { useEffect, useState } from "react";
import type { Household } from "../api/households-api";
import { shoppingApi, type ShoppingList } from "../api/shopping-api";
import { ItemIcon } from "../components/item-icons";
import { useLiveTopic } from "../live/live-updates";
import { basketCount, shopperIs } from "../meals/ShoppingList";

const NAMES_SHOWN = 3;

interface ShoppingNowProps {
  household: Household;
  onOpenMeals: () => void;
}

// On Home, only while someone is at the shop: who, how far along, and what's still to get.
export function ShoppingNow({ household, onOpenMeals }: ShoppingNowProps) {
  const [list, setList] = useState<ShoppingList>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  useLiveTopic("meals", () => setLoadAttempt((attempt) => attempt + 1));

  useEffect(() => {
    let isCurrent = true;
    shoppingApi
      .currentTrip()
      .then((current) => {
        if (isCurrent) {
          setList(current.trip ? (current as ShoppingList) : undefined);
        }
      })
      // Home stays quiet when the server can't be reached; the Meals tab explains.
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [loadAttempt]);

  if (!list?.trip) {
    return null;
  }
  const stillToGet = list.items.filter((item) => !item.checked).map((item) => item.name);
  const shown = stillToGet.slice(0, NAMES_SHOWN).join(", ");
  const more = stillToGet.length - NAMES_SHOWN;

  return (
    <section className="today" aria-labelledby="shopping-now-heading">
      <h2 id="shopping-now-heading" className="section-title">
        Shopping now
      </h2>
      <ul className="panel" aria-label="Shopping now">
        <li className="panel__row chore">
          <button className="chore__open" type="button" onClick={onOpenMeals}>
            <ItemIcon name="cart" />
            <span className="chore__text">
              <span className="chore__title">{shopperIs(household, list.trip.shopperMemberId)} shopping</span>
              <span className="chore__meta">{list.items.length > 0 ? basketCount(list.items) : "Nothing on the list yet"}</span>
            </span>
          </button>
        </li>
      </ul>
      <p className="today__note">
        {list.items.length > 0 && stillToGet.length === 0 && "Everything is in the basket. "}
        {stillToGet.length > 0 && `Still to get: ${shown}${more > 0 ? ` and ${more} more` : ""}. `}
        <button className="link-button" type="button" onClick={onOpenMeals}>
          Add something
        </button>
      </p>
    </section>
  );
}
