import { useEffect, useState } from "react";
import { UNDO_TIMEOUT_MS } from "./UndoBar";

export interface Undoable {
  message: string;
  undo: () => Promise<unknown>;
}

// One undo offer at a time; it disappears on its own after the undo bar's countdown.
export function useUndoable() {
  const [undoable, setUndoable] = useState<Undoable>();

  useEffect(() => {
    if (!undoable) {
      return;
    }
    const timeout = setTimeout(() => setUndoable(undefined), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [undoable]);

  // Hands back the undo action and clears the offer, so it can only run once.
  const takeUndo = () => {
    setUndoable(undefined);
    return undoable?.undo;
  };

  return { undoable, offerUndo: setUndoable, takeUndo };
}
