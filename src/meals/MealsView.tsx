import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import type { MealPlan, NewRecipe, PlannedMeal, Recipe } from "../api/meals-api";
import { ItemIcon, iconFor } from "../components/item-icons";
import { Sheet } from "../components/Sheet";
import { UndoBar } from "../components/UndoBar";
import { useUndoable } from "../components/useUndoable";
import { formatDay, todayIsoDate } from "../money/money-format";
import { describeIngredient, describeWeek, ingredientLine, mondayOf, weekDays, addDays, DAYS_IN_WEEK } from "./week";
import { ShoppingList } from "./ShoppingList";
import { useMeals } from "./useMeals";

const DEFAULT_SERVINGS = "4";
const WHOLE_NUMBER_PATTERN = /^\d{1,2}$/;

type MealsScreen =
  | { name: "week" }
  | { name: "plan"; date: string }
  | { name: "add-recipe" }
  | { name: "recipe"; recipe: Recipe }
  | { name: "edit-recipe"; recipe: Recipe };

const asNewRecipe = ({ title, servings, ingredients }: Recipe) => ({ title, servings, ingredientLines: ingredients.map(ingredientLine) });

interface MealsViewProps {
  household: Household;
}

// "Dinner today", "Dinner yesterday", or "Dinner on Wed 4 Nov".
function dinnerOn(date: string) {
  const day = formatDay(date);
  return /^[A-Z][a-z]+day$/.test(day) && !day.includes(" ") ? `Dinner ${day.toLowerCase()}` : `Dinner on ${day}`;
}

export function cookLabel(household: Household, cookMemberId: string | null) {
  if (!cookMemberId) {
    return undefined;
  }
  if (cookMemberId === household.currentMemberId) {
    return "You cook";
  }
  const name = household.members.find((member) => member.id === cookMemberId)?.name;
  return name ? `${name} cooks` : undefined;
}

export function MealsView({ household }: MealsViewProps) {
  const today = todayIsoDate();
  const thisMonday = mondayOf(today);
  const [monday, setMonday] = useState(thisMonday);
  const { state, retry, plan, clear, addRecipe, updateRecipe, removeRecipe } = useMeals(monday);
  const [screen, setScreen] = useState<MealsScreen>({ name: "week" });
  const { undoable, offerUndo, takeUndo } = useUndoable();
  const [error, setError] = useState<string>();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const backToWeek = () => setScreen({ name: "week" });

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try {
      await action();
    } catch (actionError) {
      setError((actionError as ApiError).message);
    }
  }

  if (state.status === "loading") {
    return <p className="screen hint">Looking at the week…</p>;
  }
  if (state.status === "unreachable") {
    return (
      <div className="screen">
        <p role="alert">{state.message}</p>
        <button className="button" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  const { meals, recipes } = state.week;
  const mealOn = (date: string) => meals.find((meal) => meal.date === date);

  async function clearDay(meal: PlannedMeal) {
    await clear(meal.date);
    const { title, recipeId, cookMemberId } = meal;
    offerUndo({ message: `${formatDay(meal.date)} cleared.`, undo: () => plan(meal.date, { title, recipeId, cookMemberId }) });
  }

  async function deleteRecipe(recipe: Recipe) {
    await removeRecipe(recipe.id);
    offerUndo({ message: `${recipe.title} deleted.`, undo: () => addRecipe(asNewRecipe(recipe)) });
  }

  async function changeRecipe(recipe: Recipe, changed: NewRecipe) {
    await updateRecipe(recipe.id, changed);
    offerUndo({ message: `${changed.title.trim()} saved.`, undo: () => updateRecipe(recipe.id, asNewRecipe(recipe)) });
  }

  let sheet: ReactNode;
  if (screen.name === "plan") {
    const meal = mealOn(screen.date);
    sheet = (
      <Sheet label={dinnerOn(screen.date)} onClose={backToWeek}>
        <PlanDinnerScreen
          household={household}
          date={screen.date}
          meal={meal}
          recipes={recipes}
          onSave={(dinner) => plan(screen.date, dinner)}
          onClear={meal ? () => clearDay(meal) : undefined}
          onBack={backToWeek}
        />
      </Sheet>
    );
  } else if (screen.name === "add-recipe") {
    sheet = (
      <Sheet label="Add a recipe" onClose={backToWeek}>
        <RecipeFormScreen onSave={addRecipe} onBack={backToWeek} />
      </Sheet>
    );
  } else if (screen.name === "edit-recipe") {
    const { recipe } = screen;
    sheet = (
      <Sheet label="Edit recipe" onClose={backToWeek}>
        <RecipeFormScreen recipe={recipe} onSave={(changed) => changeRecipe(recipe, changed)} onBack={backToWeek} />
      </Sheet>
    );
  } else if (screen.name === "recipe") {
    const { recipe } = screen;
    sheet = (
      <Sheet label={recipe.title} onClose={backToWeek}>
        <div className="screen">
          <button className="back-link" type="button" onClick={backToWeek}>
            Close
          </button>
          <h1 className="page-title">{recipe.title}</h1>
          <p className="chore-detail">Serves {recipe.servings}.</p>
          {recipe.ingredients.length > 0 ? (
            <ul className="recipe__ingredients">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index}>{describeIngredient(ingredient)}</li>
              ))}
            </ul>
          ) : (
            <p className="chore-detail">No ingredients yet.</p>
          )}
          <button className="button button--block" type="button" onClick={() => setScreen({ name: "edit-recipe", recipe })}>
            Edit recipe
          </button>
          <button
            className="button button--quiet expense-screen__delete"
            type="button"
            onClick={() =>
              run(async () => {
                await deleteRecipe(recipe);
                backToWeek();
              })
            }
          >
            Delete recipe
          </button>
        </div>
      </Sheet>
    );
  }

  const isBehindSheet = sheet !== undefined || isCheckingOut;

  return (
    <>
      <div className="screen meals" inert={isBehindSheet} aria-hidden={isBehindSheet || undefined}>
        <p className="eyebrow">Meals</p>
        <h1 className="page-title page-title--large">{describeWeek(monday)}</h1>

        <fieldset className="segmented meals__weeks" aria-label="Week">
          {[thisMonday, addDays(thisMonday, DAYS_IN_WEEK)].map((weekStart, index) => (
            <label key={weekStart} className="segmented__option">
              <input type="radio" name="week" checked={monday === weekStart} onChange={() => setMonday(weekStart)} />
              {index === 0 ? "This week" : "Next week"}
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <ul className="panel meals__week" aria-label="Dinners">
          {weekDays(monday).map((date) => {
            const meal = mealOn(date);
            const cook = cookLabel(household, meal?.cookMemberId ?? null);
            return (
              <li key={date} className={`panel__row chore${date < today ? " meals__past" : ""}`}>
                <button className="chore__open" type="button" onClick={() => setScreen({ name: "plan", date })}>
                  <ItemIcon name={meal ? iconFor(meal.title, "food") : "food"} />
                  <span className="chore__text">
                    <span className="meals__day">{formatDay(date)}</span>
                    <span className={meal ? "chore__title" : "meals__empty"}>{meal ? meal.title : "Nothing planned"}</span>
                    {cook && <span className="chore__meta">{cook}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <ShoppingList household={household} monday={monday} onUndoable={offerUndo} onSheetChange={setIsCheckingOut} />

        <section className="chores__group" aria-labelledby="recipes-heading">
          <h2 id="recipes-heading" className="section-title">
            Recipes
          </h2>
          <button className="button button--block" type="button" onClick={() => setScreen({ name: "add-recipe" })}>
            Add a recipe
          </button>
          {recipes.length === 0 ? (
            <p className="empty-state">Save the dinners you cook often, with their ingredients, to plan the week in a few taps.</p>
          ) : (
            <ul className="panel meals__recipes" aria-label="Recipes">
              {recipes.map((recipe) => (
                <li key={recipe.id} className="panel__row chore">
                  <button className="chore__open" type="button" onClick={() => setScreen({ name: "recipe", recipe })}>
                    <ItemIcon name={iconFor(recipe.title, "food")} />
                    <span className="chore__text">
                      <span className="chore__title">{recipe.title}</span>
                      <span className="chore__meta">
                        Serves {recipe.servings}, {recipe.ingredients.length} {recipe.ingredients.length === 1 ? "ingredient" : "ingredients"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {undoable && (
          <UndoBar
            message={undoable.message}
            onUndo={() => {
              const undo = takeUndo();
              if (undo) {
                void run(undo);
              }
            }}
          />
        )}
      </div>
      {sheet}
    </>
  );
}

interface PlanDinnerScreenProps {
  household: Household;
  date: string;
  meal?: PlannedMeal;
  recipes: Recipe[];
  onSave: (plan: MealPlan) => Promise<unknown>;
  onClear?: () => Promise<unknown>;
  onBack: () => void;
}

function PlanDinnerScreen({ household, date, meal, recipes, onSave, onClear, onBack }: PlanDinnerScreenProps) {
  const fieldId = useId();
  const [title, setTitle] = useState(meal?.title ?? "");
  const [cookMemberId, setCookMemberId] = useState(meal?.cookMemberId ?? "");
  const [error, setError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);
  // Typing a saved recipe's name, or tapping it, links the dinner to that recipe.
  const recipe = recipes.find((candidate) => candidate.title.toLocaleLowerCase() === title.trim().toLocaleLowerCase());

  async function finish(action: () => Promise<unknown>) {
    setIsBusy(true);
    setError(undefined);
    try {
      await action();
      onBack();
    } catch (actionError) {
      setError((actionError as ApiError).message);
      setIsBusy(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Say what's for dinner.");
      return;
    }
    void finish(() => onSave({ title, recipeId: recipe?.id ?? null, cookMemberId: cookMemberId || null }));
  }

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Cancel
      </button>
      <h1 className="page-title">{dinnerOn(date)}</h1>
      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor={`${fieldId}-title`}>
          What's for dinner?
        </label>
        <input
          id={`${fieldId}-title`}
          className="text-input"
          value={title}
          placeholder="Pasta al pomodoro"
          autoComplete="off"
          autoFocus={!meal}
          onChange={(event) => setTitle(event.target.value)}
        />
        {recipes.length > 0 && (
          <div className="meals__picks" aria-label="Recipes to pick">
            {recipes.map((candidate) => (
              <button
                key={candidate.id}
                className={`meals__pick${candidate.id === recipe?.id ? " meals__pick--chosen" : ""}`}
                type="button"
                aria-pressed={candidate.id === recipe?.id}
                onClick={() => setTitle(candidate.title)}
              >
                {candidate.title}
              </button>
            ))}
          </div>
        )}

        <label className="field-label" htmlFor={`${fieldId}-cook`}>
          Who cooks?
        </label>
        <select id={`${fieldId}-cook`} className="text-input" value={cookMemberId} onChange={(event) => setCookMemberId(event.target.value)}>
          <option value="">Not decided</option>
          {household.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.id === household.currentMemberId ? "You" : member.name}
            </option>
          ))}
        </select>

        <button className="button button--block button--submit" type="submit" disabled={isBusy}>
          Save dinner
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {onClear && (
        <button className="button button--quiet expense-screen__delete" type="button" disabled={isBusy} onClick={() => finish(onClear)}>
          Clear this day
        </button>
      )}
    </div>
  );
}

interface RecipeFormScreenProps {
  // Set when editing; the form starts with what it has.
  recipe?: Recipe;
  onSave: (recipe: NewRecipe) => Promise<unknown>;
  onBack: () => void;
}

function RecipeFormScreen({ recipe, onSave, onBack }: RecipeFormScreenProps) {
  const fieldId = useId();
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [servings, setServings] = useState(recipe ? String(recipe.servings) : DEFAULT_SERVINGS);
  const [ingredients, setIngredients] = useState(recipe ? recipe.ingredients.map(ingredientLine).join("\n") : "");
  const [error, setError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Give the recipe a name.");
      return;
    }
    if (!WHOLE_NUMBER_PATTERN.test(servings.trim()) || Number(servings) < 1) {
      setError("Servings go from 1 to 50.");
      return;
    }
    setIsBusy(true);
    setError(undefined);
    try {
      await onSave({ title, servings: Number(servings), ingredientLines: ingredients.split("\n") });
      onBack();
    } catch (addError) {
      setError((addError as ApiError).message);
      setIsBusy(false);
    }
  }

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Cancel
      </button>
      <h1 className="page-title">{recipe ? "Edit recipe" : "Add a recipe"}</h1>
      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        <label className="field-label" htmlFor={`${fieldId}-title`}>
          Name
        </label>
        <input
          id={`${fieldId}-title`}
          className="text-input"
          value={title}
          placeholder="Pasta al pomodoro"
          autoComplete="off"
          autoFocus={!recipe}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label className="field-label" htmlFor={`${fieldId}-servings`}>
          Servings
        </label>
        <input
          id={`${fieldId}-servings`}
          className="text-input text-input--amount"
          inputMode="numeric"
          value={servings}
          onChange={(event) => setServings(event.target.value)}
        />
        <label className="field-label" htmlFor={`${fieldId}-ingredients`}>
          Ingredients, one per line
        </label>
        <textarea
          id={`${fieldId}-ingredients`}
          className="text-input recipe__lines"
          rows={6}
          value={ingredients}
          placeholder={"500 g pasta\n2 Dosen Tomaten\nSalt"}
          onChange={(event) => setIngredients(event.target.value)}
        />
        <button className="button button--block button--submit" type="submit" disabled={isBusy}>
          Save recipe
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
