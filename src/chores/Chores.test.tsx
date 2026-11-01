import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { createFakeHouseholdsServer } from "../test/fake-households-server";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function openChores(...flatmates: string[]) {
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
  fireEvent.click(await screen.findByRole("button", { name: "Chores" }));
  await screen.findByRole("button", { name: "Add a chore" });
}

async function addChore(title: string, every?: string, unit?: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add a chore" }));
  type("What needs doing?", title);
  if (every) {
    type("How many", every);
  }
  if (unit) {
    fireEvent.change(screen.getByLabelText("Days, weeks or months"), { target: { value: unit } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Add chore" }));
  await screen.findByRole("button", { name: "Add a chore" });
}

const rows = () =>
  within(screen.getByRole("list", { name: "Chores" }))
    .getAllByRole("listitem")
    .map((row) => row.textContent);

const heading = () => screen.getByRole("heading", { level: 1 });

describe("chores", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(createFakeHouseholdsServer().handle));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("teaches the first step, then lists a weekly chore that is due today", async () => {
    await openChores();

    expect(screen.getByRole("button", { name: "Chores" })).toHaveAttribute("aria-current", "page");
    expect(heading()).toHaveTextContent("Nothing to track yet");
    expect(screen.getByText(/like taking out the trash every week/)).toBeInTheDocument();

    await addChore("Take out the trash");
    await addChore("Water the plants", "3", "day");

    expect(heading()).toHaveTextContent("2 chores to do");
    expect(rows()).toEqual([
      "Take out the trashYour turnDue todayEvery weekDone",
      "Water the plantsYour turnDue todayEvery 3 daysDone",
    ]);
  });

  it("moves a chore one interval on when I tick it off, and can undo that", async () => {
    await openChores();
    await addChore("Take out the trash");

    fireEvent.click(screen.getByRole("button", { name: "Mark Take out the trash done" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/^Take out the trash done\. Next: .+\.Undo$/);
    expect(heading()).toHaveTextContent("All done for now");
    expect(rows()).toEqual(["Take out the trashYour turnIn 7 daysEvery weekDone"]);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("heading", { level: 1, name: "1 chore to do" })).toBeInTheDocument();
    expect(rows()).toEqual(["Take out the trashYour turnDue todayEvery weekDone"]);
  });

  it("takes turns: says whose turn it is and passes it on when done", async () => {
    await openChores("Lea");
    await addChore("Take out the trash");

    expect(rows()).toEqual(["Take out the trashYour turnDue todayEvery weekDone"]);
    expect(screen.getByText("It's your turn.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark Take out the trash done" }));
    expect(await screen.findByText("Lea's turn")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Take out the trash/ }));
    expect(screen.getByText("Turns go You, then Lea.")).toBeInTheDocument();
    expect(screen.getByText(/^Last done today by you\.$/)).toBeInTheDocument();
  });

  it("says what is missing before adding a chore", async () => {
    await openChores();

    fireEvent.click(screen.getByRole("button", { name: "Add a chore" }));
    type("How many", "0");
    fireEvent.click(screen.getByRole("button", { name: "Add chore" }));

    expect(screen.getByText("Say what needs doing.")).toBeInTheDocument();
    expect(screen.getByText("Pick a number from 1 to 365.")).toBeInTheDocument();
  });

  it("opens a chore to see it and delete it, with undo", async () => {
    await openChores();
    await addChore("Take out the trash");

    fireEvent.click(screen.getByRole("button", { name: /^Take out the trash/ }));
    expect(heading()).toHaveTextContent("Take out the trash");
    expect(screen.getByText("Every week. Due today.")).toBeInTheDocument();
    expect(screen.getByText("Not done yet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete chore" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Take out the trash deleted.");
    expect(heading()).toHaveTextContent("Nothing to track yet");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "Mark Take out the trash done" })).toBeInTheDocument();
  });
});
