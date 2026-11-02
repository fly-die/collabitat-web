import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { SESSION_STORAGE_KEY } from "../api/client";
import { createFakeHouseholdsServer } from "../test/fake-households-server";
import { FakeWebSocket } from "../test/fake-web-socket";
import { todayIsoDate } from "../money/money-format";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("live updates", () => {
  let server: ReturnType<typeof createFakeHouseholdsServer>;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    server = createFakeHouseholdsServer();
    vi.stubGlobal("fetch", vi.fn(server.handle));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function openChoresLive() {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
    type("Household name", "Langstrasse 12");
    type("Your name", "Mia");
    type("Email", "mia@example.com");
    type("Password", "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: "Create household" }));
    fireEvent.click(await screen.findByRole("button", { name: "Chores" }));
    await screen.findByRole("heading", { level: 1, name: "Nothing to track yet" });
    const socket = FakeWebSocket.latest();
    act(() => socket.serverOpens());
    act(() => socket.serverSends({ type: "ready" }));
    return socket;
  }

  // What a flatmate's phone does: change it on the server, which then tells everyone.
  async function flatmateAddsChore(title: string) {
    await server.handle("http://localhost:3000/household/tasks", {
      method: "POST",
      headers: { authorization: `Bearer ${localStorage.getItem(SESSION_STORAGE_KEY)}` },
      body: JSON.stringify({ title, every: 1, unit: "week", firstDueOn: todayIsoDate() }),
    });
  }

  it("logs in over the live connection and shows a flatmate's change without reloading", async () => {
    const socket = await openChoresLive();
    expect(socket.sent).toEqual([{ token: localStorage.getItem(SESSION_STORAGE_KEY) }]);

    await flatmateAddsChore("Take out the trash");
    act(() => socket.serverSends({ type: "changed", topic: "chores" }));

    expect(await screen.findByRole("heading", { level: 1, name: "1 chore to do" })).toBeInTheDocument();
    expect(screen.queryByText("Looking at what needs doing…")).not.toBeInTheDocument();
  });

  it("reconnects after losing the connection and catches up on what it missed", async () => {
    const socket = await openChoresLive();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    act(() => socket.serverCloses());
    await flatmateAddsChore("Water the plants");
    act(() => vi.advanceTimersByTime(1_000));

    const reconnected = FakeWebSocket.latest();
    expect(reconnected).not.toBe(socket);
    act(() => reconnected.serverOpens());
    act(() => reconnected.serverSends({ type: "ready" }));
    vi.useRealTimers();

    expect(await screen.findByRole("heading", { level: 1, name: "1 chore to do" })).toBeInTheDocument();
  });

  it("stops trying when the server says the session is no longer valid", async () => {
    const socket = await openChoresLive();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    act(() => socket.serverCloses(4401));
    act(() => vi.advanceTimersByTime(60_000));

    expect(FakeWebSocket.latest()).toBe(socket);
  });
});
