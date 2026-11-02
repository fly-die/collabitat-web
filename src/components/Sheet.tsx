import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SheetProps {
  // What a screen reader announces for the dialog, e.g. "Add an expense".
  label: string;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

// A dialog over the current screen: a sheet from the bottom on phones, centred on computers.
// The screen behind it is made inert by its owner; Escape or a tap outside closes it, and
// focus goes back to whatever opened it.
export function Sheet({ label, onClose, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Read while rendering: once the screen behind turns inert, the browser has already moved focus away.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : undefined));
  const latestOnClose = useRef(onClose);
  useEffect(() => {
    latestOnClose.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }
    document.body.classList.add("has-sheet");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        latestOnClose.current();
        return;
      }
      if (event.key !== "Tab" || !panel) {
        return;
      }
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("has-sheet");
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [opener]);

  return createPortal(
    <div className="sheet">
      {/* The dimmed area behind the dialog closes it; keyboards use Escape, so it stays out of the tab order. */}
      <button className="sheet__backdrop" type="button" tabIndex={-1} aria-label="Close" onClick={onClose} />
      <div ref={panelRef} className="sheet__panel" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
