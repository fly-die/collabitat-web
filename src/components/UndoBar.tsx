import type { CSSProperties } from "react";

export const UNDO_TIMEOUT_MS = 6000;

interface UndoBarProps {
  message: string;
  onUndo: () => void;
}

// The fuse along the bottom burns down while Undo is still available.
export function UndoBar({ message, onUndo }: UndoBarProps) {
  return (
    <div className="undo-bar" role="status" style={{ "--undo-duration": `${UNDO_TIMEOUT_MS}ms` } as CSSProperties}>
      <span>{message}</span>
      <button className="button button--on-dark" type="button" onClick={onUndo}>
        Undo
      </button>
      <span className="undo-bar__fuse" aria-hidden="true" />
    </div>
  );
}
