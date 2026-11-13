import type { Household } from "../api/households-api";
import { ItemIcon, iconFor } from "../components/item-icons";
import { cookLabel } from "../meals/MealsView";
import { useMeals } from "../meals/useMeals";
import { mondayOf } from "../meals/week";
import { todayIsoDate } from "../money/money-format";

interface TonightDinnerProps {
  household: Household;
  onOpenMeals: () => void;
}

// On Home: what's for dinner tonight, who cooks if someone was picked, or a way to plan it. Quiet while loading.
export function TonightDinner({ household, onOpenMeals }: TonightDinnerProps) {
  const today = todayIsoDate();
  const { state } = useMeals(mondayOf(today));
  if (state.status !== "ready") {
    return null;
  }
  const tonight = state.week.meals.find((meal) => meal.date === today && meal.slot === "dinner");
  const cook = tonight ? cookLabel(household, tonight.cookMemberId) : undefined;

  return (
    <section className="today" aria-labelledby="tonight-heading">
      <h2 id="tonight-heading" className="section-title">
        Tonight
      </h2>
      {tonight ? (
        <ul className="panel" aria-label="Tonight's dinner">
          <li className="panel__row chore">
            <button className="chore__open" type="button" onClick={onOpenMeals}>
              {/* The card already carries the plain meal icon, so a dish only gets one that says more. */}
              {iconFor(tonight.title, "food") !== "food" && <ItemIcon name={iconFor(tonight.title, "food")} />}
              <span className="chore__text">
                <span className="chore__title">{tonight.title}</span>
                <span className="chore__meta">
                  <span className="tonight__when">Tonight</span>
                  {cook && <span>{cook}</span>}
                </span>
              </span>
            </button>
          </li>
        </ul>
      ) : (
        <p className="today__note">
          Nothing planned for dinner.{" "}
          <button className="link-button" type="button" onClick={onOpenMeals}>
            Plan it
          </button>
        </p>
      )}
    </section>
  );
}
