import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { SESSION_STORAGE_KEY } from "./api/households-api";
import { UNDO_TIMEOUT_MS } from "./households/HouseholdView";
import { createFakeHouseholdsServer } from "./test/fake-households-server";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function createHousehold(name = "Langstrasse 12", memberName = "Mia") {
  type("Household name", name);
  type("Your name", memberName);
  fireEvent.click(screen.getByRole("button", { name: "Create household" }));
  await screen.findByRole("heading", { level: 1, name });
}

async function addFlatmate(name: string) {
  type("Add a flatmate", name);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

function flatmateNames() {
  return within(screen.getByRole("list", { name: "Flatmates" }))
    .getAllByRole("listitem")
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
    expect(flatmateNames()).toEqual(["Mia (you)", "LeaNot joined yetRemove"]);
    expect(screen.queryByRole("button", { name: "Remove Mia" })).not.toBeInTheDocument();
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

    expect(await screen.findByRole("heading", { name: "Start your household" })).toBeInTheDocument();
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

      expect(await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" })).toBeInTheDocument();
      expect(flatmateNames()).toContain("Lea (you)");
      expect(window.location.hash).toBe("");
    });

    it("lets me join under a new name", async () => {
      openInviteLink(await householdWithLea());
      render(<App />);
      await screen.findByRole("heading", { name: "Join Langstrasse 12" });

      type("Not on the list? Your name", "Noah");
      fireEvent.click(screen.getByRole("button", { name: "Join" }));

      await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" });
      expect(flatmateNames()).toContain("Noah (you)");
    });

    it("explains a broken link and offers to start a household", async () => {
      openInviteLink("0123456789abcdef0123456789abcdef");
      render(<App />);

      fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));

      expect(screen.getByRole("heading", { name: "Start your household" })).toBeInTheDocument();
    });
  });
});
