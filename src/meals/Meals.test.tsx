import { fireEvent, render, screen, within } from "@testing-library/react";
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
  within(screen.getByRole("list", { name: "Dinners" }))
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
});
