import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

// Same key as the startup script in index.html, which applies the theme before React loads.
const THEME_STORAGE_KEY = "collabitat.theme";
const THEME_CHOICES: ThemeChoice[] = ["system", "light", "dark"];
const DARK_QUERY = "(prefers-color-scheme: dark)";

function storedChoice(): ThemeChoice {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_CHOICES.find((choice) => choice === stored) ?? "system";
}

function applyTheme(choice: ThemeChoice) {
  const prefersDark = window.matchMedia?.(DARK_QUERY).matches === true;
  const root = document.documentElement;
  root.dataset.theme = choice === "dark" || (choice === "system" && prefersDark) ? "dark" : "light";
  // The phone's status bar takes the canvas colour of the theme just applied.
  const canvas = getComputedStyle(root).getPropertyValue("--color-canvas").trim();
  if (canvas) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", canvas);
  }
}

// One per app: keeps the page in the chosen theme and, on "system", follows the device as it changes.
export function useTheme() {
  const [choice, setChoice] = useState(storedChoice);

  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system") {
      return;
    }
    const query = window.matchMedia?.(DARK_QUERY);
    const followDevice = () => applyTheme("system");
    query?.addEventListener("change", followDevice);
    return () => query?.removeEventListener("change", followDevice);
  }, [choice]);

  const choose = (next: ThemeChoice) => {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    setChoice(next);
  };

  return { choice, choose };
}

export type Theme = ReturnType<typeof useTheme>;
