import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { UNDO_TIMEOUT_MS } from "../households/HouseholdView";
import { createFakeHouseholdsServer } from "../test/fake-households-server";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function openMoneyWithLea() {
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
  await screen.findByText("Lea");
  fireEvent.click(screen.getByRole("button", { name: "Money" }));
  await screen.findByRole("heading", { level: 1 });
}

async function addExpense(description: string, amount: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add an expense" }));
  type("What was it for?", description);
  type("Amount", amount);
  fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
  await screen.findByRole("button", { name: "Add an expense" });
}

function rowsOf(listName: string) {
  return within(screen.getByRole("list", { name: listName }))
    .getAllByRole("listitem")
    .map((row) => row.textContent);
}

describe("money", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(createFakeHouseholdsServer().handle));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("teaches the first step, then adds an expense paid by me and split with everyone", async () => {
    await openMoneyWithLea();

    expect(screen.getByRole("button", { name: "Money" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You're all square");
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();

    await addExpense("Groceries", "45,50");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You get back 22.75");
    expect(rowsOf("Flatmates")).toEqual(["Lea owes 22.75"]);
    expect(rowsOf("Expenses")).toEqual(["GroceriesYou paidToday45.50Delete"]);
  });

  it("records who paid and splits only between the people I pick", async () => {
    await openMoneyWithLea();

    fireEvent.click(screen.getByRole("button", { name: "Add an expense" }));
    type("What was it for?", "Pizza");
    type("Amount", "12");
    const paidBy = screen.getByLabelText("Paid by");
    fireEvent.change(paidBy, {
      target: { value: within(paidBy).getByRole<HTMLOptionElement>("option", { name: "Lea" }).value },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Lea" }));
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    await screen.findByRole("button", { name: "Add an expense" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You owe 12.00");
    expect(rowsOf("Flatmates")).toEqual(["Lea gets back 12.00"]);
  });

  it("says what is missing before sending anything", async () => {
    await openMoneyWithLea();

    fireEvent.click(screen.getByRole("button", { name: "Add an expense" }));
    type("Amount", "12.505");
    fireEvent.click(screen.getByRole("checkbox", { name: "You" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Lea" }));
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));

    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      "Say what it was for.",
      "Enter an amount like 12.50.",
      "Pick at least one person to split with.",
    ]);
    expect(screen.getByLabelText("Amount")).toHaveAttribute("aria-invalid", "true");

    type("Amount", "12.50");
    expect(screen.getByLabelText("Amount")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Enter an amount like 12.50.")).not.toBeInTheDocument();
  });

  it("lets me undo deleting an expense, and hides undo after a while", async () => {
    await openMoneyWithLea();
    await addExpense("Groceries", "30");

    fireEvent.click(screen.getByRole("button", { name: "Delete Groceries" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Groceries deleted.");
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You get back 15.00");

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Groceries" }));
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(UNDO_TIMEOUT_MS));
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("keeps a flatmate who is part of an expense and says why", async () => {
    await openMoneyWithLea();
    await addExpense("Groceries", "30");

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove Lea" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lea is part of some expenses, so they stay in the household.",
    );
    expect(screen.getByText("Lea")).toBeInTheDocument();
  });
});
