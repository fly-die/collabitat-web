import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { UNDO_TIMEOUT_MS } from "./households/HouseholdView";
import { HOUSEHOLD_ID_STORAGE_KEY } from "./households/useHousehold";
import { createFakeHouseholdsServer } from "./test/fake-households-server";

function submitName(label: string, name: string, buttonName: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
}

async function createHousehold(name = "Langstrasse 12") {
  submitName("Household name", name, "Create");
  await screen.findByRole("heading", { level: 1, name });
}

async function addFlatmate(name: string) {
  submitName("Add a flatmate", name, "Add");
}

describe("household setup", () => {
  let server: ReturnType<typeof createFakeHouseholdsServer>;

  beforeEach(() => {
    localStorage.clear();
    server = createFakeHouseholdsServer();
    vi.stubGlobal("fetch", vi.fn(server.handle));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("creates a household and lists added flatmates", async () => {
    render(<App />);

    await createHousehold();
    expect(screen.getByText(/no one here yet/i)).toBeInTheDocument();

    await addFlatmate("Lea");
    expect(await screen.findByText("Lea")).toBeInTheDocument();
  });

  it("explains why a flatmate could not be added", async () => {
    render(<App />);
    await createHousehold();
    await addFlatmate("Lea");
    await screen.findByText("Lea");

    await addFlatmate("lea");

    expect(await screen.findByRole("alert")).toHaveTextContent("lea is already a member.");
  });

  it("lets me undo removing a flatmate", async () => {
    render(<App />);
    await createHousehold();
    await addFlatmate("Lea");
    await screen.findByText("Lea");

    fireEvent.click(screen.getByRole("button", { name: "Remove Lea" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));

    expect(await screen.findByText("Lea")).toBeInTheDocument();
  });

  it("hides the undo option after a while", async () => {
    render(<App />);
    await createHousehold();
    await addFlatmate("Lea");
    await screen.findByText("Lea");
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove Lea" }));
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(UNDO_TIMEOUT_MS));

    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("opens my household again after a reload", async () => {
    const { unmount } = render(<App />);
    await createHousehold();
    unmount();

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Langstrasse 12" })).toBeInTheDocument();
    expect(server.households.has(localStorage.getItem(HOUSEHOLD_ID_STORAGE_KEY) ?? "")).toBe(true);
  });

  it("starts over when the stored household id is not valid", async () => {
    localStorage.setItem(HOUSEHOLD_ID_STORAGE_KEY, "../admin");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Start your household" })).toBeInTheDocument();
    expect(localStorage.getItem(HOUSEHOLD_ID_STORAGE_KEY)).toBeNull();
  });

  it("offers a retry when the server is unreachable", async () => {
    localStorage.setItem(HOUSEHOLD_ID_STORAGE_KEY, crypto.randomUUID());
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
