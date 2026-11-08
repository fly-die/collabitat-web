import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { todayIsoDate } from "../money/money-format";
import { createFakeHouseholdsServer } from "../test/fake-households-server";

const DAYS_AHEAD = 3;
const MILLISECONDS_PER_DAY = 86_400_000;

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
  await screen.findByRole("heading", { level: 2, name: "Today" });
}

async function addChore(title: string, firstDueOn = todayIsoDate()) {
  fireEvent.click(screen.getByRole("button", { name: "Add a chore" }));
  type("What needs doing?", title);
  type("First time", firstDueOn);
  fireEvent.click(screen.getByRole("button", { name: "Add chore" }));
  await screen.findByRole("button", { name: "Add a chore" });
}

const rowsOf = (name: string) =>
  within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((row) => row.textContent);

describe("today on Home", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(createFakeHouseholdsServer().handle));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("points to the first chore, then shows what's due and coming up, and ticks it off with undo", async () => {
    await openHome();
    fireEvent.click(screen.getByRole("button", { name: "Add a chore" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Nothing to track yet" })).toBeInTheDocument();

    await addChore("Take out the trash");
    await addChore("Water the plants", todayIsoDate(new Date(Date.now() + DAYS_AHEAD * MILLISECONDS_PER_DAY)));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    expect(await screen.findByRole("list", { name: "Due today" })).toBeInTheDocument();
    expect(rowsOf("Due today")).toEqual(["Take out the trashYour turnDue todayDone"]);
    expect(rowsOf("Coming up")).toEqual([`Water the plantsYour turnIn ${DAYS_AHEAD} days`]);

    fireEvent.click(screen.getByRole("button", { name: "Mark Take out the trash done" }));
    expect(await screen.findByText("Nothing due today.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/^Take out the trash done\. Next: /);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "Mark Take out the trash done" })).toBeInTheDocument();
  });
});
