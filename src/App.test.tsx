import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { SESSION_STORAGE_KEY } from "./api/client";
import { UNDO_TIMEOUT_MS } from "./components/UndoBar";
import { createFakeHouseholdsServer } from "./test/fake-households-server";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function createHousehold(name = "Langstrasse 12", memberName = "Mia") {
  fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
  type("Household name", name);
  type("Your name", memberName);
  type("Email", `${memberName.toLowerCase()}@example.com`);
  type("Password", TEST_PASSWORD);
  fireEvent.click(screen.getByRole("button", { name: "Create household" }));
  await screen.findByRole("heading", { level: 1, name });
}

async function addFlatmate(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "+ Add a flatmate" }));
  type("New flatmate's name", name);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

const TEST_PASSWORD = "correct horse battery";

function enterNewAccount(email: string) {
  type("Email", email);
  type("Password", TEST_PASSWORD);
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
}

function flatmateNames() {
  return within(screen.getByRole("list", { name: "Flatmates" }))
    .getAllByRole("listitem")
    .filter((item) => !item.querySelector("form, .doorbell__add-button"))
    .map((item) => item.textContent);
}

function openInviteLink(inviteCode: string) {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  window.history.replaceState(null, "", `/#invite=${inviteCode}`);
}

describe("household", () => {
  let server: ReturnType<typeof createFakeHouseholdsServer>;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    server = createFakeHouseholdsServer();
    vi.stubGlobal("fetch", vi.fn(server.handle));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("creates a household with me in it and lists added flatmates", async () => {
    render(<App />);

    await createHousehold();
    await addFlatmate("Lea");

    expect(await screen.findByText("Lea")).toBeInTheDocument();
    expect(flatmateNames()).toEqual(["MiaYou", "LeaNot joined yetRemove"]);
    expect(screen.queryByRole("button", { name: "Remove Mia" })).not.toBeInTheDocument();
  });

  it("adds a flatmate in a new row and waits for the name before offering another", async () => {
    render(<App />);
    await createHousehold();

    fireEvent.click(screen.getByRole("button", { name: "+ Add a flatmate" }));
    expect(screen.getByRole("button", { name: "+ Add a flatmate" })).toBeDisabled();
    type("New flatmate's name", "Lea");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Lea")).toBeInTheDocument();
    expect(screen.queryByLabelText("New flatmate's name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add a flatmate" })).toBeEnabled();
  });

  it("explains why a flatmate could not be added", async () => {
    render(<App />);
    await createHousehold();
    await addFlatmate("Lea");
    await screen.findByText("Lea");

    await addFlatmate("lea");

    expect(await screen.findByRole("alert")).toHaveTextContent("lea is already a member.");
  });

  it("lets me undo removing a flatmate, and hides undo after a while", async () => {
    render(<App />);
    await createHousehold();
    await addFlatmate("Lea");
    await screen.findByText("Lea");

    fireEvent.click(screen.getByRole("button", { name: "Remove Lea" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Lea")).toBeInTheDocument();

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Lea" }));
    });
    act(() => vi.advanceTimersByTime(UNDO_TIMEOUT_MS));
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("opens my household again after a reload", async () => {
    const { unmount } = render(<App />);
    await createHousehold();
    unmount();

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" })).toBeInTheDocument();
  });

  it("starts over when my session is no longer valid", async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "expired");

    render(<App />);

    expect(await screen.findByRole("button", { name: "Start a household" })).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("offers a retry when the server is unreachable", async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("copies the invite link when the phone can't share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    render(<App />);
    await createHousehold();

    fireEvent.click(screen.getByRole("button", { name: "Share invite link" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Link copied");
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/#invite=[0-9a-f]{32}$/));
  });

  it("welcomes me with a choice before asking for anything", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: /Shared flat/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join with an invite link" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Household name")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start a household" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Join with an invite link" })).toBeInTheDocument();
  });

  it("shows the next step until everyone has joined", async () => {
    const { unmount } = render(<App />);
    await createHousehold();
    expect(screen.getByText("Invite your flatmates")).toBeInTheDocument();

    await addFlatmate("Lea");
    expect(await screen.findByText("Get Lea to join")).toBeInTheDocument();
    unmount();

    openInviteLink([...server.households.values()][0].inviteCode);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Lea" }));
    enterNewAccount("lea@example.com");

    await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" });
    expect(screen.queryByRole("heading", { name: "Getting started" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share invite link" })).toBeInTheDocument();
  });

  describe("joining with an invite link", () => {
    async function householdWithLea() {
      const { unmount } = render(<App />);
      await createHousehold();
      await addFlatmate("Lea");
      await screen.findByText("Lea");
      unmount();
      return [...server.households.values()][0].inviteCode;
    }

    it("lets me join as a flatmate who was already added", async () => {
      openInviteLink(await householdWithLea());
      render(<App />);

      fireEvent.click(await screen.findByRole("button", { name: "Lea" }));
      expect(screen.getByRole("heading", { name: "Join Langstrasse 12 as Lea" })).toBeInTheDocument();
      enterNewAccount("lea@example.com");

      expect(await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" })).toBeInTheDocument();
      expect(flatmateNames()).toContain("LeaYou");
      expect(window.location.hash).toBe("");
    });

    it("lets me join under a new name", async () => {
      openInviteLink(await householdWithLea());
      render(<App />);
      await screen.findByRole("heading", { name: "Join Langstrasse 12" });

      type("Not on the list? Your name", "Noah");
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      enterNewAccount("noah@example.com");

      await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" });
      expect(flatmateNames()).toContain("NoahYou");
    });

    it("explains a broken link and offers to start a household", async () => {
      openInviteLink("0123456789abcdef0123456789abcdef");
      render(<App />);

      fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));

      expect(screen.getByRole("heading", { name: "Start your household" })).toBeInTheDocument();
    });
    it("opens a pasted invite link", async () => {
      const inviteCode = await householdWithLea();
      localStorage.removeItem(SESSION_STORAGE_KEY);
      render(<App />);

      fireEvent.click(await screen.findByRole("button", { name: "Join with an invite link" }));
      type("Invite link", `https://example.org/collabitat-web/#invite=${inviteCode}`);
      fireEvent.click(screen.getByRole("button", { name: "Open" }));

      expect(await screen.findByRole("heading", { name: "Join Langstrasse 12" })).toBeInTheDocument();
    });

    it("explains when pasted text is not an invite link", async () => {
      render(<App />);

      fireEvent.click(await screen.findByRole("button", { name: "Join with an invite link" }));
      type("Invite link", "see you at 8");
      fireEvent.click(screen.getByRole("button", { name: "Open" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("doesn't look like an invite link");
    });
  });
});
