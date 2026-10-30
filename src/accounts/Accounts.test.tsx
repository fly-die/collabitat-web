import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { SESSION_STORAGE_KEY } from "../api/client";
import { createFakeHouseholdsServer } from "../test/fake-households-server";

const PASSWORD = "correct horse battery";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function startHousehold(email = "mia@example.com") {
  fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
  type("Household name", "Langstrasse 12");
  type("Your name", "Mia");
  type("Email", email);
  type("Password", PASSWORD);
  fireEvent.click(screen.getByRole("button", { name: "Create household" }));
}

async function logIn(email: string, password: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Log in" }));
  type("Email", email);
  type("Password", password);
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

// A different browser or phone: nothing of this one's storage comes along.
function openInAnotherBrowser() {
  localStorage.clear();
  render(<App />);
}

describe("accounts", () => {
  let server: ReturnType<typeof createFakeHouseholdsServer>;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    server = createFakeHouseholdsServer();
    vi.stubGlobal("fetch", vi.fn(server.handle));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("opens my household in another browser after logging in", async () => {
    const { unmount } = render(<App />);
    await startHousehold();
    await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" });
    unmount();

    openInAnotherBrowser();
    await logIn("Mia@Example.com", PASSWORD);

    expect(await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" })).toBeInTheDocument();
  });

  it("says when email and password don't match", async () => {
    const { unmount } = render(<App />);
    await startHousehold();
    await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" });
    unmount();

    openInAnotherBrowser();
    await logIn("mia@example.com", "not my password");

    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password don't match.");
  });

  it("points to logging in when the email already has an account", async () => {
    const { unmount } = render(<App />);
    await startHousehold();
    await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" });
    unmount();

    openInAnotherBrowser();
    await startHousehold();

    expect(await screen.findByRole("alert")).toHaveTextContent("There's already an account with this email. Log in instead.");
  });

  it("logs me out back to the welcome page", async () => {
    render(<App />);
    await startHousehold();

    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("button", { name: "Start a household" })).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("lets me log in instead when an invite opens on a new device", async () => {
    const { unmount } = render(<App />);
    await startHousehold();
    await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" });
    unmount();
    localStorage.clear();
    window.history.replaceState(null, "", `/#invite=${[...server.households.values()][0].inviteCode}`);

    render(<App />);
    await screen.findByRole("heading", { name: "Join Langstrasse 12" });
    await logIn("mia@example.com", PASSWORD);

    expect(await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" })).toBeInTheDocument();
  });
});
