import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { SESSION_STORAGE_KEY } from "../api/client";
import { createFakeHouseholdsServer } from "../test/fake-households-server";
import { installFakePush, removeFakePush } from "../test/fake-push";

// A real VAPID public key's shape: 65 bytes, base64url.
const PUBLIC_KEY = `B${"A".repeat(86)}`;

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const notificationSwitch = () => screen.getByRole("switch", { name: "Notifications on this device" });

describe("settings", () => {
  let server: ReturnType<typeof createFakeHouseholdsServer>;

  function useServer(options: Parameters<typeof createFakeHouseholdsServer>[0] = { pushPublicKey: PUBLIC_KEY }) {
    server = createFakeHouseholdsServer(options);
    vi.stubGlobal("fetch", vi.fn(server.handle));
  }

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    useServer();
  });

  afterEach(() => {
    removeFakePush();
    vi.unstubAllGlobals();
  });

  async function openSettings() {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Start a household" }));
    type("Household name", "Langstrasse 12");
    type("Your name", "Mia");
    type("Email", "mia@example.com");
    type("Password", "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: "Create household" }));
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
  }

  it("changes my name, says when a flatmate has it, and logs out from its own section", async () => {
    await openSettings();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Add a flatmate" }));
    type("New flatmate's name", "Lea");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("button", { name: "Remove Lea" });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    type("Your name", "lea");
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Lea is already a member.");
    type("Your name", "Mia Rossi");
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Mia Rossi in Langstrasse 12")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Account" })).toContainElement(screen.getByRole("button", { name: "Log out" }));
  });

  it("turns notifications on after asking, and off again, keeping the server in step", async () => {
    const push = installFakePush();
    await openSettings();

    expect(screen.getByText("Mia in Langstrasse 12")).toBeInTheDocument();
    expect(await screen.findByRole("switch", { checked: false })).toBe(notificationSwitch());
    expect(push.notification.requestPermission).not.toHaveBeenCalled();

    fireEvent.click(notificationSwitch());
    expect(await screen.findByRole("switch", { checked: true })).toBe(notificationSwitch());
    expect(push.notification.requestPermission).toHaveBeenCalledOnce();
    expect([...server.pushDevices.keys()]).toEqual([push.subscription()?.endpoint]);

    fireEvent.click(notificationSwitch());
    expect(await screen.findByRole("switch", { checked: false })).toBe(notificationSwitch());
    expect(server.pushDevices.size).toBe(0);
    expect(push.subscription()).toBeNull();
  });

  it("sends the device again when the server lost it", async () => {
    installFakePush();
    await openSettings();
    fireEvent.click(await screen.findByRole("switch", { checked: false }));
    await screen.findByRole("switch", { checked: true });
    server.pushDevices.clear();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("switch", { checked: true })).toBeInTheDocument();
    expect(server.pushDevices.size).toBe(1);
  });

  it("leaves the switch off and says why when the server can't save the device", async () => {
    const push = installFakePush();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "PUT"
          ? Promise.resolve(new Response(JSON.stringify({ error: "OOPS", message: "Something went wrong." }), { status: 500 }))
          : server.handle(input, init),
      ),
    );
    await openSettings();

    fireEvent.click(await screen.findByRole("switch", { checked: false }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
    expect(notificationSwitch()).toHaveAttribute("aria-checked", "false");
    expect(push.subscription()).toBeNull();
  });

  it.each([
    ["the browser blocks them", () => installFakePush({ permission: "denied" }), "Notifications are blocked for Collabitat."],
    ["the browser can't do them", () => undefined, "This browser can't show notifications."],
  ])("explains instead of showing a switch when %s", async (_label, setUp, explanation) => {
    setUp();
    await openSettings();

    expect(await screen.findByText(new RegExp(`^${explanation}`))).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("explains when the server has no notification keys", async () => {
    useServer({});
    installFakePush();
    await openSettings();

    expect(await screen.findByText("Notifications aren't set up on the server yet.")).toBeInTheDocument();
  });

  it("says when I said no at the browser's prompt", async () => {
    installFakePush({ answer: "denied" });
    await openSettings();

    fireEvent.click(await screen.findByRole("switch", { checked: false }));

    expect(await screen.findByText(/^Notifications are blocked for Collabitat\./)).toBeInTheDocument();
  });

  it("switches the look between light, dark and the device's, and remembers it", async () => {
    const prefersDark = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => prefersDark));
    await openSettings();
    const theme = () => document.documentElement.dataset.theme;

    expect(screen.getByRole("radio", { name: "Match device" })).toBeChecked();
    expect(theme()).toBe("dark");

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(theme()).toBe("light");
    expect(localStorage.getItem("collabitat.theme")).toBe("light");

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(theme()).toBe("dark");

    prefersDark.matches = false;
    fireEvent.click(screen.getByRole("radio", { name: "Match device" }));
    expect(theme()).toBe("light");
    expect(prefersDark.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("turns notifications off on this device when I log out", async () => {
    const push = installFakePush();
    await openSettings();
    fireEvent.click(await screen.findByRole("switch", { checked: false }));
    await screen.findByRole("switch", { checked: true });

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("button", { name: "Start a household" })).toBeInTheDocument();
    expect(server.pushDevices.size).toBe(0);
    expect(push.subscription()).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
