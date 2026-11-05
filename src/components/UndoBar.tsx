import { useEffect, useRef, useState, type CSSProperties } from "react";

export const UNDO_TIMEOUT_MS = 6000;

interface UndoBarProps {
  message: string;
  onUndo: () => void;
  // Called once the countdown runs out without anyone undoing.
  onExpire: () => void;
}

// Stays a few seconds, then fades out. Touching it while it fades brings it back fully and
// starts the countdown again; the fuse along the bottom shows how long is left.
export function UndoBar({ message, onUndo, onExpire }: UndoBarProps) {
  const [round, setRound] = useState(0);
  const latestOnExpire = useRef(onExpire);

  useEffect(() => {
    latestOnExpire.current = onExpire;
  });

  useEffect(() => {
    const timeout = setTimeout(() => latestOnExpire.current(), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [round]);

  return (
    <div
      key={round}
      className="undo-bar"
      role="status"
      style={{ "--undo-duration": `${UNDO_TIMEOUT_MS}ms` } as CSSProperties}
      onPointerDown={() => setRound((current) => current + 1)}
    >
      <span>{message}</span>
      <button className="button button--on-dark" type="button" onClick={onUndo}>
        Undo
      </button>
      <span className="undo-bar__fuse" aria-hidden="true" />
    </div>
  );
}
