import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Sheet } from "./Sheet";

function SheetOpener() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      {isOpen && (
        <Sheet label="Add a chore" onClose={() => setIsOpen(false)}>
          <input aria-label="First" />
          <button type="button">Last</button>
        </Sheet>
      )}
    </>
  );
}

describe("sheet", () => {
  it("keeps Tab inside the dialog, locks the page behind it, and gives focus back when it closes", () => {
    render(<SheetOpener />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Add a chore" });
    expect(dialog).toHaveFocus();
    expect(document.body).toHaveClass("has-sheet");

    const first = screen.getByLabelText("First");
    const last = screen.getByRole("button", { name: "Last" });
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("has-sheet");
    expect(opener).toHaveFocus();
  });
});
