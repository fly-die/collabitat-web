import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import { mealsApi, type MealPlan, type PastMeal } from "../api/meals-api";
import { describeUpcomingDay } from "../calendar/calendar-format";
import { Sheet } from "../components/Sheet";
import type { Undoable } from "../components/useUndoable";
import { useLiveTopic } from "../live/live-updates";
import { formatDay } from "../money/money-format";
import { addDays, mondayOf } from "./week";

const DAYS_TO_PICK = 7;
const SHOWN_AT_FIRST = 5;

interface PastMealsProps {
  today: string;
  onPlan: (date: string, plan: MealPlan) => Promise<unknown>;
  onClear: (date: string) => Promise<unknown>;
  onUndoable: (undoable: Undoable) => void;
  // The day-picking dialog opened or closed, so the screen behind it rests or wakes up.
  onSheetChange: (isOpen: boolean) => void;
  // The week on screen; when it changes, what counts as past may have changed too.
  week: unknown;
}

const timesLabel = (times: number) => (times === 1 ? "once" : times === 2 ? "twice" : `${times} times`);

// Dishes the household had before, to plan again instead of thinking of something new.
export function PastMeals({ today, onPlan, onClear, onUndoable, onSheetChange, week }: PastMealsProps) {
  const [pastMeals, setPastMeals] = useState<PastMeal[]>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isShowingAll, setIsShowingAll] = useState(false);
  const [picking, setPicking] = useState<PastMeal>();
  const [error, setError] = useState<string>();
  useLiveTopic("meals", () => setLoadAttempt((attempt) => attempt + 1));

  useEffect(() => {
    let isCurrent = true;
    mealsApi
      .history(today)
      .then(({ pastMeals: loaded }) => {
        if (isCurrent) {
          setPastMeals(loaded);
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
  }, [today, loadAttempt, week]);

  const openPicker = (meal: PastMeal) => {
    setError(undefined);
    setPicking(meal);
    onSheetChange(true);
  };
  const closePicker = () => {
    setPicking(undefined);
    onSheetChange(false);
  };

  // Plans it as that day's dinner; Undo puts back whatever dinner was there.
  async function planAgain(meal: PastMeal, date: string) {
    closePicker();
    try {
      const { meals } = await mealsApi.week(mondayOf(date));
      const previous = meals.find((candidate) => candidate.date === date && candidate.slot === "dinner");
      await onPlan(date, { title: meal.title, recipeId: meal.recipeId, cookMemberId: null });
      onUndoable({
        message: `${meal.title} planned for ${formatDay(date)}.`,
        undo: () =>
          previous
            ? onPlan(date, { title: previous.title, recipeId: previous.recipeId, cookMemberId: previous.cookMemberId })
            : onClear(date),
      });
    } catch (planError) {
      setError((planError as ApiError).message);
    }
  }

  if (!pastMeals || pastMeals.length === 0) {
    return null;
  }
  const shown = isShowingAll ? pastMeals : pastMeals.slice(0, SHOWN_AT_FIRST);

  return (
    <section className="chores__group" aria-labelledby="past-meals-heading">
      <h2 id="past-meals-heading" className="section-title">
        Past meals
      </h2>
      <ul className="panel" aria-labelledby="past-meals-heading">
        {shown.map((meal) => (
          <li key={meal.title} className="panel__row chore">
            <button className="chore__open" type="button" onClick={() => openPicker(meal)}>
              <span className="chore__text">
                <span className="chore__title">{meal.title}</span>
                <span className="chore__meta">
                  Last on {formatDay(meal.lastOn)}, {timesLabel(meal.times)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!isShowingAll && pastMeals.length > SHOWN_AT_FIRST && (
        <button className="link-button past-meals__more" type="button" onClick={() => setIsShowingAll(true)}>
          Show all {pastMeals.length}
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {picking && (
        <Sheet label={`Plan ${picking.title} again`} onClose={closePicker}>
          <div className="screen">
            <button className="back-link" type="button" onClick={closePicker}>
              Cancel
            </button>
            <h1 className="page-title">Plan {picking.title} again</h1>
            <div className="meals__picks" role="group" aria-label="Day">
              {Array.from({ length: DAYS_TO_PICK }, (_, offset) => addDays(today, offset)).map((date) => (
                <button key={date} className="meals__pick" type="button" onClick={() => void planAgain(picking, date)}>
                  {describeUpcomingDay(date, today)}
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      )}
    </section>
  );
}
