import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { addDays } from "../meals/week";
import { todayIsoDate } from "../money/money-format";
import { createFakeHouseholdsServer } from "../test/fake-households-server";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function openCalendar() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
  type("Household name", "Langstrasse 12");
  type("Your name", "Mia");
  type("Email", "mia@example.com");
  type("Password", "correct horse battery");
  fireEvent.click(screen.getByRole("button", { name: "Create household" }));
  const comingUp = await screen.findByRole("region", { name: "Coming up" });
  expect(comingUp).toHaveTextContent("Nothing in the next 7 days.");
  fireEvent.click(within(comingUp).getByRole("button", { name: "Add a date" }));
  await screen.findByRole("heading", { name: "Calendar" });
}

async function addColumn(name: string) {
  type("Add a column", name);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  await screen.findByRole("button", { name: `Remove ${name}` });
}

async function addDate(title: string, { day = todayIsoDate(), time = "", column = "Everyone" } = {}) {
  fireEvent.click(screen.getByRole("button", { name: "Add a date" }));
  type("What is it?", title);
  fireEvent.change(screen.getByLabelText("For"), { target: { value: screen.getByRole("option", { name: column }).getAttribute("value") } });
  type("Day", day);
  type("Time, if it has one", time);
  fireEvent.click(screen.getByRole("button", { name: "Add date" }));
  await screen.findByRole("button", { name: new RegExp(`${title}$`) });
}

// The text of each lane's cell in a day's row: Everyone first, then the columns.
const cellsOf = (dayLabel: string) =>
  within(screen.getByRole("row", { name: new RegExp(`^${dayLabel}`) }))
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

describe("calendar", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(createFakeHouseholdsServer().handle));
  });

  it("puts dates in their person's column and shows the week's on Home", async () => {
    await openCalendar();
    expect(screen.getByText(/^Nothing in the next 4 weeks\./)).toBeInTheDocument();
    await addColumn("Noah");

    await addDate("Dentist", { day: addDays(todayIsoDate(), 1), time: "14:30", column: "Noah" });
    await addDate("Bin day");
    await addDate("Too far for Home", { day: addDays(todayIsoDate(), 9) });

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Everyone", "Noah"]);
    expect(cellsOf("Today")).toEqual(["Bin day", ""]);
    expect(cellsOf("Tomorrow")).toEqual(["", "14:30Dentist"]);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    const comingUp = await screen.findByRole("list", { name: "Coming up" });
    expect(within(comingUp).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Today: Bin dayEveryone",
      "Tomorrow: DentistNoah, 14:30",
    ]);
  });

  it("edits and removes dates with undo, and keeps a column that still has dates", async () => {
    await openCalendar();
    await addColumn("Noah");
    fireEvent.click(screen.getByRole("button", { name: "Add a date" }));
    fireEvent.click(screen.getByRole("button", { name: "Add date" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Say what it is, like Dentist or Birthday.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await addDate("Dentist", { time: "09:15", column: "Noah" });

    fireEvent.click(screen.getByRole("button", { name: "Remove Noah" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Noah still has 1 upcoming date. Move or remove them first.");

    fireEvent.click(screen.getByRole("button", { name: "09:15Dentist" }));
    fireEvent.change(screen.getByLabelText("For"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));
    await waitFor(() => expect(cellsOf("Today")).toEqual(["09:15Dentist", ""]));

    fireEvent.click(screen.getByRole("button", { name: "Remove Noah" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Noah removed.");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "Remove Noah" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "09:15Dentist" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove date" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Dentist removed.");
    expect(await screen.findByText(/^Nothing in the next 4 weeks\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByRole("button", { name: "09:15Dentist" })).toBeInTheDocument();
  });
});
