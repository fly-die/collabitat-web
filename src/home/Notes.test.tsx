import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { createFakeHouseholdsServer } from "../test/fake-households-server";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function openHome() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
  type("Household name", "Langstrasse 12");
  type("Your name", "Mia");
  type("Email", "mia@example.com");
  type("Password", "correct horse battery");
  fireEvent.click(screen.getByRole("button", { name: "Create household" }));
  await screen.findByRole("region", { name: "Notes" });
}

async function addNote(text: string) {
  type("Add a note", text);
  fireEvent.click(screen.getByRole("button", { name: "Add note" }));
  await screen.findByRole("checkbox", { name: text });
}

// Each note as [text, ticked], in the order shown.
const notes = () =>
  within(screen.getByRole("list", { name: "Notes" }))
    .getAllByRole("checkbox")
    .map((checkbox) => [checkbox.getAttribute("aria-label"), (checkbox as HTMLInputElement).checked]);

describe("notes", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(createFakeHouseholdsServer().handle));
  });

  it("adds notes on Home, newest first, and moves ticked ones below", async () => {
    await openHome();
    expect(screen.getByText(/^Jot down what everyone should know/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Type a note first, like Bins out on Monday.");

    await addNote("Bins out on Monday");
    await addNote("Spare key is with Lea");
    expect(within(screen.getByRole("list", { name: "Notes" })).getAllByRole("listitem")[0]).toHaveTextContent("Spare key is with LeaYou");

    fireEvent.click(screen.getByRole("checkbox", { name: "Spare key is with Lea" }));
    await waitFor(() =>
      expect(notes()).toEqual([
        ["Bins out on Monday", false],
        ["Spare key is with Lea", true],
      ]),
    );
  });

  it("removes a note and clears done ones, both with undo", async () => {
    await openHome();
    await addNote("Water the plants");
    await addNote("Buy milk");
    fireEvent.click(screen.getByRole("checkbox", { name: "Buy milk" }));
    await screen.findByRole("button", { name: "Clear done notes" });

    fireEvent.click(screen.getByRole("button", { name: "Clear done notes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 done note cleared.");
    await waitFor(() => expect(notes()).toEqual([["Water the plants", false]]));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(notes()).toEqual([
        ["Water the plants", false],
        ["Buy milk", true],
      ]),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove note: Water the plants" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Note removed.");
    await waitFor(() => expect(notes()).toEqual([["Buy milk", true]]));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(notes()).toEqual([
        ["Water the plants", false],
        ["Buy milk", true],
      ]),
    );
  });
});
