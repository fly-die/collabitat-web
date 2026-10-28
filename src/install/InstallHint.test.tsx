import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallHint } from "./InstallHint";

const IPHONE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

function offerInstallPrompt() {
  const installEvent = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(() => Promise.resolve()),
  });
  act(() => {
    window.dispatchEvent(installEvent);
  });
  return installEvent;
}

function browseWith(userAgent: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
}

function runAsInstalledApp() {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("standalone") }));
}

describe("install hint", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens the browser's install dialog when the browser offers one", async () => {
    render(<InstallHint />);
    const installEvent = offerInstallPrompt();

    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    expect(installEvent.prompt).toHaveBeenCalledOnce();
    expect(installEvent.defaultPrevented).toBe(true);
    expect(screen.queryByRole("region", { name: "Install Collabitat" })).not.toBeInTheDocument();
  });

  it("explains how to install on an iPhone", () => {
    browseWith(IPHONE_USER_AGENT);

    render(<InstallHint />);

    expect(screen.getByText(/tap Share, then Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("stays hidden after Not now, also on the next visit", () => {
    browseWith(IPHONE_USER_AGENT);
    const { unmount } = render(<InstallHint />);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("region", { name: "Install Collabitat" })).not.toBeInTheDocument();

    unmount();
    render(<InstallHint />);
    expect(screen.queryByRole("region", { name: "Install Collabitat" })).not.toBeInTheDocument();
  });

  it("stays hidden inside the installed app", () => {
    browseWith(IPHONE_USER_AGENT);
    runAsInstalledApp();

    render(<InstallHint />);

    expect(screen.queryByRole("region", { name: "Install Collabitat" })).not.toBeInTheDocument();
  });
});
