import { useState } from "react";

export interface Undoable {
  message: string;
  undo: () => Promise<unknown>;
}

// Each offer gets its own id, so a new offer restarts the undo bar's countdown.
let nextOfferId = 0;

// One undo offer at a time; the undo bar says when its countdown has run out.
export function useUndoable() {
  const [undoable, setUndoable] = useState<Undoable & { id: number }>();

  const offerUndo = (offer: Undoable | undefined) => {
    nextOfferId += 1;
    setUndoable(offer && { ...offer, id: nextOfferId });
  };

  // Hands back the undo action and clears the offer, so it can only run once.
  const takeUndo = () => {
    setUndoable(undefined);
    return undoable?.undo;
  };

  return { undoable, offerUndo, takeUndo, dismissUndo: () => setUndoable(undefined) };
}
