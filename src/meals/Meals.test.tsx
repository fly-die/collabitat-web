import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { createFakeHouseholdsServer } from "../test/fake-households-server";
import { todayIsoDate } from "../money/money-format";
import { addDays, mondayOf } from "./week";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function openMeals() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
  type("Household name", "Langstrasse 12");
  type("Your name", "Mia");
  type("Email", "mia@example.com");
  type("Password", "correct horse battery");
  fireEvent.click(screen.getByRole("button", { name: "Create household" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ Add a flatmate" }));
  type("New flatmate's name", "Lea");
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  await screen.findByRole("button", { name: "Remove Lea" });
  fireEvent.click(screen.getByRole("button", { name: "Meals" }));
  await screen.findByRole("radio", { name: "This week", checked: true });
}

async function addRecipe(title: string, ingredients: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add a recipe" }));
  type("Name", title);
  type("Ingredients, one per line", ingredients);
  fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));
  await screen.findByRole("button", { name: "Add a recipe" });
}

const dinners = () =>
  within(screen.getByRole("list", { name: "Meals" }))
    .getAllByRole("listitem")
    .map((row) => row.textContent);

describe("meals", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(createFakeHouseholdsServer().handle));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plans tonight from a saved recipe with who cooks, and shows it on Home", async () => {
    await openMeals();
    expect(dinners()).toHaveLength(7);
    expect(screen.getByText(/Save the dinners you cook often/)).toBeInTheDocument();

    await addRecipe("Pasta", "500 g pasta\n\nSalt");
    expect(screen.getByRole("button", { name: /^Pasta.*Serves 4, 2 ingredients$/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Today/ }));
    const dialog = screen.getByRole("dialog", { name: "Dinner today" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pasta" }));
    expect(within(dialog).getByRole("button", { name: "Pasta" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(within(dialog).getByLabelText("Who cooks?"), { target: { value: screen.getAllByRole("option", { name: "Lea" })[0].getAttribute("value") } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save dinner" }));

    expect(await screen.findByRole("button", { name: /^TodayPastaLea cooks$/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(await screen.findByRole("list", { name: "Tonight's dinner" })).toHaveTextContent("PastaLea cooks");
  });

  it("plans breakfast on the days it is switched on, and keeps Tonight to dinner", async () => {
    await openMeals();
    const todayName = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(new Date());
    const breakfastDays = () => within(screen.getByRole("group", { name: "Breakfast on" }));

    fireEvent.click(breakfastDays().getByRole("button", { name: todayName }));
    expect(await screen.findByRole("button", { name: /^Today, breakfastNothing planned/ })).toBeInTheDocument();
    expect(breakfastDays().getByRole("button", { name: todayName })).toHaveAttribute("aria-pressed", "true");
    expect(dinners()).toHaveLength(8);

    fireEvent.click(screen.getByRole("button", { name: /^Today, breakfast/ }));
    type("What's for breakfast?", "Zopf");
    fireEvent.click(within(screen.getByRole("dialog", { name: "Breakfast today" })).getByRole("button", { name: "Save breakfast" }));
    await screen.findByRole("button", { name: /^Today, breakfastZopf/ });
    fireEvent.click(screen.getByRole("button", { name: /^Today, dinner/ }));
    type("What's for dinner?", "Raclette");
    fireEvent.click(screen.getByRole("button", { name: "Save dinner" }));
    await screen.findByRole("button", { name: /^Today, dinnerRaclette/ });

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(await screen.findByRole("list", { name: "Tonight's dinner" })).toHaveTextContent("Raclette");
    expect(screen.queryByText("Zopf")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Meals" }));
    fireEvent.click(await within(await screen.findByRole("group", { name: "Breakfast on" })).findByRole("button", { name: todayName }));
    await waitFor(() => expect(dinners()).toHaveLength(7));
  });

  it("plans a past meal again on a day I pick, and Undo clears that day again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T10:00:00"));
    await openMeals();
    for (const [day, dish] of [["Mon 2 Nov", "Curry"], ["Yesterday", "Pasta"]]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${day}`) }));
      type("What's for dinner?", dish);
      fireEvent.click(screen.getByRole("button", { name: "Save dinner" }));
      await screen.findByRole("button", { name: new RegExp(`^${day}${dish}`) });
    }

    const pastMeals = await screen.findByRole("list", { name: "Past meals" });
    await waitFor(() =>
      expect(within(pastMeals).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
        "PastaLast on Yesterday, once",
        "CurryLast on Mon 2 Nov, once",
      ]),
    );
    fireEvent.click(within(pastMeals).getByRole("button", { name: /^Pasta/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Plan Pasta again" })).getByRole("button", { name: "Tomorrow" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Pasta planned for Fri 6 Nov.");
    expect(await screen.findByRole("button", { name: /^Fri 6 NovPasta/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: /^Fri 6 NovNothing planned/ })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("offers to plan tonight from Home, and says when I cook", async () => {
    await openMeals();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(await screen.findByText(/^Nothing planned for dinner\./)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Plan it" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Today/ }));
    type("What's for dinner?", "Risotto");
    fireEvent.change(screen.getByLabelText("Who cooks?"), { target: { value: screen.getByRole("option", { name: "You" }).getAttribute("value") } });
    fireEvent.click(screen.getByRole("button", { name: "Save dinner" }));

    expect(await screen.findByRole("button", { name: /^TodayRisottoYou cook$/ })).toBeInTheDocument();
  });

  it("lists what the week's dinners need by shop category, and items added by hand with undo", async () => {
    await openMeals();
    expect(await screen.findByText(/what they need shows up here/)).toBeInTheDocument();

    await addRecipe("Pasta", "500 g pasta");
    fireEvent.click(screen.getByRole("button", { name: /^Today/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pasta" }));
    fireEvent.click(screen.getByRole("button", { name: "Save dinner" }));
    await screen.findByRole("button", { name: /^TodayPasta/ });

    type("Add to the list", "2 l milk");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("list", { name: "Dairy and eggs" })).toHaveTextContent("2 l milkAdded by hand");
    expect(await screen.findByRole("list", { name: "Pantry" })).toHaveTextContent("500 g pastaFor Pasta");
    const categories = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(categories).toEqual(["Dairy and eggs", "Pantry"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove 2 l milk" }));
    expect(await screen.findByRole("status")).toHaveTextContent("2 l milk removed.");
    await vi.waitFor(() => expect(screen.queryByRole("list", { name: "Dairy and eggs" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("list", { name: "Dairy and eggs" })).toBeInTheDocument();
  });

  it("ignores an empty item and says why the server refused one", async () => {
    await openMeals();
    await screen.findByText(/what they need shows up here/);
    const serve = globalThis.fetch;
    const added: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/shopping-list/items")) {
          added.push(String(init?.body));
          return Promise.resolve(
            new Response(JSON.stringify({ error: "INVALID_INGREDIENTS", message: "Write the item in 1 to 100 characters." }), { status: 400 }),
          );
        }
        return serve(input, init);
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(added).toEqual([]);

    type("Add to the list", "x".repeat(101));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Write the item in 1 to 100 characters.");
  });

  it("shops the list, shows it on Home, and checks out into an expense with undo", async () => {
    await openMeals();
    for (const item of ["2 l milk", "Zopf"]) {
      type("Add to the list", item);
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      await screen.findByRole("checkbox", { name: item });
    }

    fireEvent.click(screen.getByRole("button", { name: "Start shopping" }));
    expect(await screen.findByText("You're shopping. 0 of 2 in the basket.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "2 l milk" }));
    expect(await screen.findByText("You're shopping. 1 of 2 in the basket.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    const shoppingNow = await screen.findByRole("region", { name: "Shopping now" });
    expect(shoppingNow).toHaveTextContent("You're shopping1 of 2 in the basket");
    expect(shoppingNow).toHaveTextContent("Still to get: Zopf.");

    fireEvent.click(screen.getByRole("button", { name: "Meals" }));
    fireEvent.click(await screen.findByRole("button", { name: "Check out" }));
    expect(screen.getByLabelText("What was it for?")).toHaveValue("Groceries");
    type("Amount", "42.70");
    fireEvent.click(screen.getByRole("button", { name: "Add to Money" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Groceries for 42.70 added to Money.");
    expect(await screen.findByRole("button", { name: "Start shopping" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "2 l milk" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Zopf" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("You're shopping. 1 of 2 in the basket.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "2 l milk" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Money" }));
    expect(await screen.findByText(/^Nothing here yet\./)).toBeInTheDocument();
  });

  it("shows a flatmate's trip without the checkout, so I can still add to their list", async () => {
    const server = createFakeHouseholdsServer();
    vi.stubGlobal("fetch", vi.fn(server.handle));
    await openMeals();
    type("Add to the list", "Zopf");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start shopping" }));
    await screen.findByRole("button", { name: "Check out" });
    const lea = [...server.households.values()][0].members.find((member) => member.name === "Lea");
    // Lea started the trip instead.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await server.handle(input, init);
        const text = await response.clone().text();
        return new Response(text.replace(/"shopperMemberId":"[^"]+"/, `"shopperMemberId":"${lea?.id}"`), { status: response.status });
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(await screen.findByRole("region", { name: "Shopping now" })).toHaveTextContent("Lea is shopping0 of 1 in the basket");
    fireEvent.click(screen.getByRole("button", { name: "Meals" }));
    expect(await screen.findByText("Lea is shopping. 0 of 1 in the basket. What you add shows up for them right away.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check out" })).not.toBeInTheDocument();
  });

  it("clears a day with undo, and says what's missing before saving", async () => {
    await openMeals();
    fireEvent.click(screen.getByRole("button", { name: /^Today/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save dinner" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Say what's for dinner.");

    type("What's for dinner?", "Leftovers");
    fireEvent.click(screen.getByRole("button", { name: "Save dinner" }));
    fireEvent.click(await screen.findByRole("button", { name: /^TodayLeftovers/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear this day" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Today cleared.");
    expect(screen.getByRole("button", { name: /^TodayNothing planned$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: /^TodayLeftovers/ })).toBeInTheDocument();
  });

  it("changes a recipe, renames tonight's dinner with it, and can undo that", async () => {
    await openMeals();
    await addRecipe("Pasta", "500 g pasta");
    fireEvent.click(screen.getByRole("button", { name: /^Today/ }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Dinner today" })).getByRole("button", { name: "Pasta" }));
    fireEvent.click(screen.getByRole("button", { name: "Save dinner" }));
    await screen.findByRole("button", { name: /^TodayPasta/ });

    fireEvent.click(screen.getByRole("button", { name: /^Pasta.*Serves/ }));
    fireEvent.click(screen.getByRole("button", { name: "Edit recipe" }));
    expect(screen.getByLabelText("Ingredients, one per line")).toHaveValue("500 g pasta");
    type("Name", "Penne arrabbiata");
    type("Servings", "2");
    type("Ingredients, one per line", "250 g penne\n1 chili");
    fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Penne arrabbiata saved.");
    expect(screen.getByRole("button", { name: /^TodayPenne arrabbiata/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Penne arrabbiata.*Serves 2, 2 ingredients$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: /^Pasta.*Serves 4, 1 ingredient$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^TodayPasta/ })).toBeInTheDocument();
  });

  it("adds a recipe to the shopping list in one tap, and Undo takes it off again", async () => {
    await openMeals();
    await addRecipe("Curry", "Reis\nKokosmilch");

    fireEvent.click(screen.getByRole("button", { name: /^Curry.*Serves/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to shopping list" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Curry added to the shopping list.");
    expect(await screen.findByRole("checkbox", { name: "Reis" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Kokosmilch" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Reis" })).not.toBeInTheDocument());
    expect(screen.queryByRole("checkbox", { name: "Kokosmilch" })).not.toBeInTheDocument();
  });

  it("moves ticked items to the end, so what's left stays on top", async () => {
    await openMeals();
    for (const item of ["Butter", "Eggs", "Bread"]) {
      type("Add to the list", item);
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      await screen.findByRole("checkbox", { name: item });
    }

    fireEvent.click(screen.getByRole("checkbox", { name: "Butter" }));

    await waitFor(() =>
      expect(screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual(["Eggs", "Bread", "Butter"]),
    );
  });

  it("deletes a recipe with undo, and shows next week", async () => {
    await openMeals();
    await addRecipe("Curry", "1 can coconut milk");
    fireEvent.click(screen.getByRole("button", { name: /^Curry/ }));
    expect(screen.getByRole("dialog", { name: "Curry" })).toHaveTextContent("1 can coconut milk");
    fireEvent.click(screen.getByRole("button", { name: "Delete recipe" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Curry deleted.");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: /^Curry/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Next week" }));
    expect(await screen.findByRole("radio", { name: "Next week", checked: true })).toBeInTheDocument();
    const nextMonday = addDays(mondayOf(todayIsoDate()), 7);
    expect(screen.queryByRole("button", { name: /^Today/ })).not.toBeInTheDocument();
    expect(dinners()[0]).toContain(new Date(`${nextMonday}T00:00:00Z`).getUTCDate().toString());
  });
  it("fills a new recipe from a link to check before saving, and says when a page has none", async () => {
    await openMeals();
    fireEvent.click(screen.getByRole("button", { name: "Add a recipe" }));

    type("From a recipe website", "https://example.com/news");
    fireEvent.click(screen.getByRole("button", { name: "Fill in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That page has no recipe we can read. Type it in instead.");

    type("From a recipe website", "https://example.com/curry");
    fireEvent.click(screen.getByRole("button", { name: "Fill in" }));
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Green curry"));
    expect(screen.getByLabelText("Servings")).toHaveValue("2");
    expect(screen.getByLabelText("Ingredients, one per line")).toHaveValue("400 ml Kokosmilch\n200 g Reis");

    fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(await screen.findByRole("button", { name: /^Green curry.*Serves 2, 2 ingredients$/ })).toBeInTheDocument();
  });

  it("scales a recipe to more people and puts that much on the shopping list, saying for which recipe", async () => {
    await openMeals();
    await addRecipe("Pasta", "500 g pasta\n2 dosen Tomaten");
    fireEvent.click(screen.getByRole("button", { name: /^Pasta.*Serves 4/ }));
    const sheet = screen.getByRole("dialog", { name: "Pasta" });
    expect(within(sheet).getByRole("list")).toHaveTextContent("500 g pasta2 Dosen Tomaten");

    fireEvent.click(within(sheet).getByRole("button", { name: "More people" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "More people" }));

    expect(within(sheet).getByRole("group", { name: "Servings" })).toHaveTextContent("6 people");
    expect(within(sheet).getByText("The recipe is for 4.")).toBeInTheDocument();
    expect(within(sheet).getByRole("list")).toHaveTextContent("750 g pasta3 Dosen Tomaten");

    fireEvent.click(within(sheet).getByRole("button", { name: "Add to shopping list" }));
    expect(await screen.findByRole("list", { name: "Pantry" })).toHaveTextContent("750 g pastaFor Pasta");
  });

  it("plans a meal for how many eat, and the shopping list follows", async () => {
    await openMeals();
    await addRecipe("Pasta", "500 g pasta");
    fireEvent.click(screen.getByRole("button", { name: /^Today/ }));
    const dialog = screen.getByRole("dialog", { name: "Dinner today" });
    expect(within(dialog).queryByRole("group", { name: "How many eat?" })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Pasta" }));
    expect(within(dialog).getByRole("group", { name: "How many eat?" })).toHaveTextContent("4 people");
    fireEvent.click(within(dialog).getByRole("button", { name: "More people" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "More people" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save dinner" }));

    expect(await screen.findByRole("button", { name: /^TodayPastaFor 6$/ })).toBeInTheDocument();
    // Without a live connection in tests, the list reloads when the week is opened again.
    fireEvent.click(screen.getByRole("radio", { name: "Next week" }));
    fireEvent.click(await screen.findByRole("radio", { name: "This week" }));
    expect(await screen.findByRole("list", { name: "Pantry" })).toHaveTextContent("750 g pastaFor Pasta");
  });
});
