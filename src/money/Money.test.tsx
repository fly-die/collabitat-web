import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { UNDO_TIMEOUT_MS } from "../components/UndoBar";
import { createFakeHouseholdsServer } from "../test/fake-households-server";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function openMoneyWith(...flatmates: string[]) {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
  type("Household name", "Langstrasse 12");
  type("Your name", "Mia");
  type("Email", "mia@example.com");
  type("Password", "correct horse battery");
  fireEvent.click(screen.getByRole("button", { name: "Create household" }));
  for (const name of flatmates) {
    fireEvent.click(await screen.findByRole("button", { name: "+ Add a flatmate" }));
    type("New flatmate's name", name);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("button", { name: `Remove ${name}` });
  }
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

const heading = () => screen.getByRole("heading", { level: 1 });

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

  it("teaches the first step, then says who owes me after an expense", async () => {
    await openMoneyWith("Lea");

    expect(screen.getByRole("button", { name: "Money" })).toHaveAttribute("aria-current", "page");
    expect(heading()).toHaveTextContent("You're all square");
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();

    await addExpense("Groceries", "45,50");

    expect(heading()).toHaveTextContent("Lea owes you 22.75");
    expect(rowsOf("Settle up")).toEqual(["Lea owes you 22.75Mark paid"]);
    expect(rowsOf("History")).toEqual(["GroceriesYou paidToday45.50Delete"]);
  });

  it("names who I owe when someone else paid", async () => {
    await openMoneyWith("Lea");

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

    expect(heading()).toHaveTextContent("You owe Lea 12.00");
    expect(rowsOf("Settle up")).toEqual(["You owe Lea 12.00Settle up"]);
  });

  it("asks only for the payments the household really needs", async () => {
    await openMoneyWith("Lea", "Noah");

    await addExpense("Cleaning stuff", "30");

    expect(heading()).toHaveTextContent("You get back 20.00");
    expect(rowsOf("Settle up")).toEqual(["Lea owes you 10.00Mark paid", "Noah owes you 10.00Mark paid"]);
  });

  it("lists the payments I'm part of first", async () => {
    await openMoneyWith("Lea", "Noah");
    await addExpense("Groceries", "45,50");

    fireEvent.click(screen.getByRole("button", { name: "Add an expense" }));
    type("What was it for?", "Internet");
    type("Amount", "60");
    const paidBy = screen.getByLabelText("Paid by");
    fireEvent.change(paidBy, {
      target: { value: within(paidBy).getByRole<HTMLOptionElement>("option", { name: "Noah" }).value },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    await screen.findByRole("button", { name: "Add an expense" });

    expect(rowsOf("Settle up")).toEqual(["Lea owes you 10.33Mark paid", "Lea owes Noah 24.84Mark paid"]);
  });

  it("says what is missing before sending anything", async () => {
    await openMoneyWith("Lea");

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

  describe("settling up", () => {
    async function openSettleUp() {
      await openMoneyWith("Lea");
      await addExpense("Groceries", "30");
      fireEvent.click(screen.getByRole("button", { name: "Mark paid" }));
    }

    it("marks the full amount as paid, which squares everyone, and can be undone", async () => {
      await openSettleUp();

      expect(heading()).toHaveTextContent("Lea pays you");
      expect(screen.getByLabelText("Amount")).toHaveValue("15.00");
      fireEvent.click(screen.getByRole("button", { name: "Mark as paid" }));

      expect(await screen.findByRole("status")).toHaveTextContent("Marked 15.00 as paid.");
      expect(heading()).toHaveTextContent("You're all square");
      expect(screen.getByText("Everyone in Langstrasse 12 is square.")).toBeInTheDocument();
      expect(rowsOf("History")[0]).toBe("Lea paid youPaymentToday15.00Delete");

      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(await screen.findByRole("heading", { level: 1, name: "Lea owes you 15.00" })).toBeInTheDocument();
    });

    it("keeps the rest open after a partial payment", async () => {
      await openSettleUp();

      type("Amount", "10");
      fireEvent.click(screen.getByRole("button", { name: "Mark as paid" }));

      expect(await screen.findByRole("heading", { level: 1, name: "Lea owes you 5.00" })).toBeInTheDocument();
    });

    it("won't record more than what is owed", async () => {
      await openSettleUp();

      type("Amount", "20");
      fireEvent.click(screen.getByRole("button", { name: "Mark as paid" }));

      expect(screen.getByRole("alert")).toHaveTextContent("That's more than the 15.00 owed.");
    });

    it("deletes a payment with undo", async () => {
      await openSettleUp();
      fireEvent.click(screen.getByRole("button", { name: "Mark as paid" }));
      await screen.findByRole("status");

      fireEvent.click(screen.getByRole("button", { name: "Delete payment: Lea paid you" }));

      expect(await screen.findByRole("heading", { level: 1, name: "Lea owes you 15.00" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Payment deleted.");
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(await screen.findByRole("heading", { level: 1, name: "You're all square" })).toBeInTheDocument();
    });
  });

  it("lets me undo deleting an expense, and hides undo after a while", async () => {
    await openMoneyWith("Lea");
    await addExpense("Groceries", "30");

    fireEvent.click(screen.getByRole("button", { name: "Delete Groceries" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Groceries deleted.");
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(heading()).toHaveTextContent("Lea owes you 15.00");

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Groceries" }));
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(UNDO_TIMEOUT_MS));
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("keeps a flatmate who is part of an expense and says why", async () => {
    await openMoneyWith("Lea");
    await addExpense("Groceries", "30");

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove Lea" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lea is part of some expenses or payments, so they stay in the household.",
    );
  });
});
