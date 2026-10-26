import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("names the app and explains what it is for", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Collabitat" })).toBeInTheDocument();
    expect(screen.getByText(/split costs, rotate chores and plan meals/i)).toBeInTheDocument();
  });
});
