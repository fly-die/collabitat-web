import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import { mealsApi, type MealPlan, type MealSlot, type NewRecipe, type PlannedMeal, type Recipe } from "../api/meals-api";
import { ItemIcon, iconFor } from "../components/item-icons";
import { Sheet } from "../components/Sheet";
import { UndoBar } from "../components/UndoBar";
import { useUndoable } from "../components/useUndoable";
import { formatDay, todayIsoDate } from "../money/money-format";
import { describeIngredient, describeWeek, ingredientLine, mondayOf, scaleIngredients, weekDays, addDays, DAYS_IN_WEEK } from "./week";
import { shoppingApi } from "../api/shopping-api";
import { PastMeals } from "./PastMeals";
import { ServingsStepper } from "./ServingsStepper";
import { ShoppingList } from "./ShoppingList";
import { useMeals } from "./useMeals";

const DEFAULT_SERVINGS = "4";
const WHOLE_NUMBER_PATTERN = /^\d{1,2}$/;

type MealsScreen =
  | { name: "week" }
  | { name: "day"; date: string }
  // Without a meal yet, the person picks which meal it is; isNew offers that choice.
  | { name: "plan"; date: string; slot: MealSlot; isNew: boolean }
  | { name: "add-recipe" }
  | { name: "recipe"; recipe: Recipe }
  | { name: "edit-recipe"; recipe: Recipe };

const asNewRecipe = ({ title, servings, ingredients }: Recipe) => ({ title, servings, ingredientLines: ingredients.map(ingredientLine) });

interface MealsViewProps {
  household: Household;
}

const SLOT_NAMES: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

// "Dinner today", "Breakfast yesterday", or "Lunch on Wed 4 Nov".
function mealNameOn(date: string, slot: MealSlot) {
  const day = formatDay(date);
  const name = SLOT_NAMES[slot];
  return /^[A-Z][a-z]+day$/.test(day) && !day.includes(" ") ? `${name} ${day.toLowerCase()}` : `${name} on ${day}`;
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
  const { undoable, offerUndo, takeUndo, dismissUndo } = useUndoable();
  const [error, setError] = useState<string>();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isPickingDay, setIsPickingDay] = useState(false);
  const [shoppingChanges, setShoppingChanges] = useState(0);
  const shoppingChanged = () => setShoppingChanges((count) => count + 1);
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
  const mealOn = (date: string, slot: MealSlot) => meals.find((meal) => meal.date === date && meal.slot === slot);
  const mealsOn = (date: string) => SLOTS.flatMap((slot) => mealOn(date, slot) ?? []);
  const freeSlotsOn = (date: string) => SLOTS.filter((slot) => !mealOn(date, slot));
  // Dinner first, as most days only have that.
  const firstFreeSlot = (date: string) => (mealOn(date, "dinner") ? freeSlotsOn(date)[0] : "dinner");
  const addMeal = (date: string) => setScreen({ name: "plan", date, slot: firstFreeSlot(date), isNew: true });
  // An empty day goes straight to planning; a planned one shows what's on it.
  const openDay = (date: string) => (mealsOn(date).length === 0 ? addMeal(date) : setScreen({ name: "day", date }));

  async function clearDay(meal: PlannedMeal) {
    await clear(meal.date, meal.slot);
    const { title, recipeId, cookMemberId, servings } = meal;
    offerUndo({ message: `${formatDay(meal.date)} cleared.`, undo: () => plan(meal.date, { title, recipeId, cookMemberId, servings }, meal.slot) });
  }

  async function deleteRecipe(recipe: Recipe) {
    await removeRecipe(recipe.id);
    offerUndo({ message: `${recipe.title} deleted.`, undo: () => addRecipe(asNewRecipe(recipe)) });
  }

  async function addToShoppingList(recipe: Recipe, servings: number) {
    backToWeek();
    try {
      const { addedItemIds } = await shoppingApi.addRecipe(monday, recipe.id, servings);
      shoppingChanged();
      offerUndo({
        message: `${recipe.title} added to the shopping list.`,
        undo: async () => {
          await Promise.all(addedItemIds.map((itemId) => shoppingApi.remove(monday, itemId)));
          shoppingChanged();
        },
      });
    } catch (addError) {
      setError((addError as ApiError).message);
    }
  }

  async function changeRecipe(recipe: Recipe, changed: NewRecipe) {
    await updateRecipe(recipe.id, changed);
    offerUndo({ message: `${changed.title.trim()} saved.`, undo: () => updateRecipe(recipe.id, asNewRecipe(recipe)) });
  }

  let sheet: ReactNode;
  if (screen.name === "day") {
    const { date } = screen;
    sheet = (
      <Sheet label={formatDay(date)} onClose={backToWeek}>
        <div className="screen">
          <button className="back-link" type="button" onClick={backToWeek}>
            Close
          </button>
          <h1 className="page-title">{formatDay(date)}</h1>
          <ul className="panel" aria-label={`Meals on ${formatDay(date)}`}>
            {mealsOn(date).map((meal) => (
              <li key={meal.slot} className="panel__row chore">
                <button className="chore__open" type="button" onClick={() => setScreen({ name: "plan", date, slot: meal.slot, isNew: false })}>
                  <ItemIcon name={iconFor(meal.title, "food")} />
                  <span className="chore__text">
                    <span className="meals__day">{SLOT_NAMES[meal.slot]}</span>
                    <span className="chore__title">{meal.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {freeSlotsOn(date).length > 0 && (
            <button className="button button--block meals__add-meal" type="button" onClick={() => addMeal(date)}>
              Add a meal
            </button>
          )}
        </div>
      </Sheet>
    );
  } else if (screen.name === "plan") {
    const { date, slot, isNew } = screen;
    const meal = isNew ? undefined : mealOn(date, slot);
    sheet = (
      <Sheet label={mealNameOn(date, slot)} onClose={backToWeek}>
        <PlanDinnerScreen
          household={household}
          heading={mealNameOn(date, slot)}
          slot={slot}
          slotChoices={isNew ? freeSlotsOn(date) : undefined}
          onSlotChange={(chosen) => setScreen({ name: "plan", date, slot: chosen, isNew })}
          meal={meal}
          recipes={recipes}
          onSave={(dinner) => plan(date, dinner, slot)}
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
        <RecipeScreen
          recipe={recipe}
          onAddToShoppingList={(servings) => void addToShoppingList(recipe, servings)}
          onEdit={() => setScreen({ name: "edit-recipe", recipe })}
          onDelete={() =>
            run(async () => {
              await deleteRecipe(recipe);
              backToWeek();
            })
          }
          onBack={backToWeek}
        />
      </Sheet>
    );
  }

  const isBehindSheet = sheet !== undefined || isCheckingOut || isPickingDay;

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

        <ul className="panel meals__week" aria-label="Meals">
          {weekDays(monday).map((date) => {
            const planned = mealsOn(date);
            const onlyDinner = planned.length === 1 && planned[0].slot === "dinner" ? planned[0] : undefined;
            const cook = cookLabel(household, onlyDinner?.cookMemberId ?? null);
            const forHowMany = onlyDinner?.servings ? `for ${onlyDinner.servings}` : undefined;
            const meta = [cook, forHowMany].filter(Boolean).join(", ");
            return (
              <li key={date} className={`panel__row chore${date < today ? " meals__past" : ""}`}>
                <button className="chore__open" type="button" onClick={() => openDay(date)}>
                  <ItemIcon name={planned.length > 0 ? iconFor(planned[planned.length - 1].title, "food") : "food"} />
                  <span className="chore__text">
                    <span className="meals__day">{formatDay(date)}</span>
                    {planned.length === 0 && <span className="meals__empty">Nothing planned</span>}
                    {onlyDinner && <span className="chore__title">{onlyDinner.title}</span>}
                    {!onlyDinner &&
                      planned.map((meal) => (
                        <span key={meal.slot} className="chore__title">
                          {SLOT_NAMES[meal.slot]}: {meal.title}
                        </span>
                      ))}
                    {meta && <span className="chore__meta">{meta.charAt(0).toUpperCase() + meta.slice(1)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <ShoppingList
          household={household}
          monday={monday}
          onUndoable={offerUndo}
          onSheetChange={setIsCheckingOut}
          changeCount={shoppingChanges}
        />

        <section className="chores__group" aria-labelledby="recipes-heading">
          <h2 id="recipes-heading" className="section-title">
            Recipes
          </h2>
          <button className="button button--block" type="button" onClick={() => setScreen({ name: "add-recipe" })}>
            Add a recipe
          </button>
          {recipes.length === 0 ? (
            <p className="empty-state">No recipes yet.</p>
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

        <PastMeals
          today={today}
          onPlan={(date, mealPlan) => plan(date, mealPlan)}
          onClear={(date) => clear(date)}
          onUndoable={offerUndo}
          onSheetChange={setIsPickingDay}
          week={state.week}
        />

        {undoable && (
          <UndoBar
            key={undoable.id}
            onExpire={dismissUndo}
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
  // "Dinner today", "Breakfast on Sun 8 Nov".
  heading: string;
  slot: MealSlot;
  // For a new meal: the meals still free that day, to pick from.
  slotChoices?: MealSlot[];
  onSlotChange: (slot: MealSlot) => void;
  meal?: PlannedMeal;
  recipes: Recipe[];
  onSave: (plan: MealPlan) => Promise<unknown>;
  onClear?: () => Promise<unknown>;
  onBack: () => void;
}

function PlanDinnerScreen({ household, heading, slot, slotChoices, onSlotChange, meal, recipes, onSave, onClear, onBack }: PlanDinnerScreenProps) {
  const mealName = SLOT_NAMES[slot].toLowerCase();
  const fieldId = useId();
  const [title, setTitle] = useState(meal?.title ?? "");
  const [cookMemberId, setCookMemberId] = useState(meal?.cookMemberId ?? "");
  const [error, setError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);
  // Typing a saved recipe's name, or tapping it, links the dinner to that recipe.
  const recipe = recipes.find((candidate) => candidate.title.toLocaleLowerCase() === title.trim().toLocaleLowerCase());
  // Until someone changes it, as many eat as the recipe serves.
  const [chosenServings, setChosenServings] = useState(meal?.recipeId ? meal.servings : null);
  const servings = chosenServings ?? recipe?.servings ?? 0;

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
      setError(`Say what's for ${mealName}.`);
      return;
    }
    void finish(() => onSave({ title, recipeId: recipe?.id ?? null, cookMemberId: cookMemberId || null, servings: recipe ? servings : null }));
  }

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Cancel
      </button>
      <h1 className="page-title">{heading}</h1>
      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        {slotChoices && slotChoices.length > 1 && (
          <fieldset className="segmented meals__slots" aria-label="Meal">
            {slotChoices.map((choice) => (
              <label key={choice} className="segmented__option">
                <input type="radio" name="slot" checked={choice === slot} onChange={() => onSlotChange(choice)} />
                {SLOT_NAMES[choice]}
              </label>
            ))}
          </fieldset>
        )}
        <label className="field-label" htmlFor={`${fieldId}-title`}>
          What's for {mealName}?
        </label>
        <input
          id={`${fieldId}-title`}
          className="text-input"
          value={title}
          placeholder="Pasta al pomodoro"
          autoComplete="off"
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

        {recipe && (
          <>
            <p className="field-label">How many eat?</p>
            <ServingsStepper label="How many eat?" servings={servings} onChange={setChosenServings} />
          </>
        )}

        <label className="field-label" htmlFor={`${fieldId}-cook`}>
          Who cooks?
        </label>
        <select id={`${fieldId}-cook`} className="text-input" value={cookMemberId} onChange={(event) => setCookMemberId(event.target.value)}>
          <option value="">Everyone</option>
          {household.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.id === household.currentMemberId ? "You" : member.name}
            </option>
          ))}
        </select>

        <button className="button button--block button--submit" type="submit" disabled={isBusy}>
          Save {mealName}
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

interface RecipeScreenProps {
  recipe: Recipe;
  onAddToShoppingList: (servings: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

// A recipe for as many people as you like: the amounts follow, and so does what goes on the shopping list.
function RecipeScreen({ recipe, onAddToShoppingList, onEdit, onDelete, onBack }: RecipeScreenProps) {
  const [servings, setServings] = useState(recipe.servings);
  const ingredients = scaleIngredients(recipe.ingredients, recipe.servings, servings);

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Close
      </button>
      <h1 className="page-title">{recipe.title}</h1>
      <ServingsStepper label="Servings" servings={servings} onChange={setServings} />
      {servings !== recipe.servings && <p className="field-hint">The recipe is for {recipe.servings}.</p>}
      {ingredients.length > 0 ? (
        <ul className="recipe__ingredients">
          {ingredients.map((ingredient, index) => (
            <li key={index}>{describeIngredient(ingredient)}</li>
          ))}
        </ul>
      ) : (
        <p className="chore-detail">No ingredients yet.</p>
      )}
      {ingredients.length > 0 && (
        <button className="button button--block" type="button" onClick={() => onAddToShoppingList(servings)}>
          Add to shopping list
        </button>
      )}
      <button className="button button--block button--outline recipe__edit" type="button" onClick={onEdit}>
        Edit recipe
      </button>
      <button className="button button--quiet expense-screen__delete" type="button" onClick={onDelete}>
        Delete recipe
      </button>
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
  const [link, setLink] = useState("");
  const [importError, setImportError] = useState<string>();
  const [isImporting, setIsImporting] = useState(false);

  // Fills the form from a recipe page; the person checks it and saves as usual.
  async function handleImport(event: FormEvent) {
    event.preventDefault();
    if (!link.trim()) {
      setImportError("Paste the link to a recipe page.");
      return;
    }
    setIsImporting(true);
    setImportError(undefined);
    try {
      const imported = await mealsApi.importRecipe(link.trim());
      setTitle(imported.title);
      setServings(String(imported.servings));
      setIngredients(imported.ingredientLines.join("\n"));
      setLink("");
    } catch (importFailure) {
      setImportError((importFailure as ApiError).message);
    } finally {
      setIsImporting(false);
    }
  }

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
      {!recipe && (
        <form className="recipe__import" onSubmit={handleImport} noValidate>
          <label className="field-label" htmlFor={`${fieldId}-link`}>
            From a recipe website
          </label>
          <div className="recipe__import-row">
            <input
              id={`${fieldId}-link`}
              className="text-input"
              type="url"
              inputMode="url"
              value={link}
              placeholder="https://"
              autoComplete="off"
              onChange={(event) => setLink(event.target.value)}
            />
            <button className="button button--outline" type="submit" disabled={isImporting}>
              {isImporting ? "Reading…" : "Fill in"}
            </button>
          </div>
          {importError && (
            <p className="form-error" role="alert">
              {importError}
            </p>
          )}
        </form>
      )}
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
