import { fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createFakeHouseholdsServer } from "./test/fake-households-server";

// jsdom has no layout, so contrast is checked in a real browser instead (light and dark, AA).
const AXE_OPTIONS: axe.RunOptions = { rules: { "color-contrast": { enabled: false } } };

async function violationsOn(screenName: string) {
  const { violations } = await axe.run(document.body, AXE_OPTIONS);
  return violations.map(({ id, nodes }) => `${screenName}: ${id} at ${nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const openTab = async (name: string, heading: string | RegExp) => {
  fireEvent.click(screen.getByRole("button", { name }));
  await screen.findByRole("heading", { level: 1, name: heading });
};

describe("accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(createFakeHouseholdsServer().handle));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("has no axe violations on every tab, the main sheets and Settings", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
    const found: string[] = [...(await violationsOn("start"))];
    type("Household name", "Langstrasse 12");
    type("Your name", "Mia");
    type("Email", "mia@example.com");
    type("Password", "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: "Create household" }));
    await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" });
    found.push(...(await violationsOn("home")));

    await openTab("Money", /./);
    found.push(...(await violationsOn("money")));
    fireEvent.click(screen.getByRole("button", { name: "Add an expense" }));
    found.push(...(await violationsOn("add expense")));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    await openTab("Chores", /./);
    found.push(...(await violationsOn("chores")));
    fireEvent.click(screen.getByRole("button", { name: "Add a chore" }));
    found.push(...(await violationsOn("add chore")));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    await openTab("Meals", /./);
    found.push(...(await violationsOn("meals")));
    fireEvent.click(screen.getByRole("button", { name: /^Today/ }));
    found.push(...(await violationsOn("plan a meal")));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a recipe" }));
    found.push(...(await violationsOn("add recipe")));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    await openTab("Home", "Langstrasse 12");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    found.push(...(await violationsOn("settings")));

    expect(found).toEqual([]);
  });
});
