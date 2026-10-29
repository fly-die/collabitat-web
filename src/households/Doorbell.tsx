import type { ReactNode } from "react";

// The flatmate list looks like the name plates next to a building's doorbells.
export function Doorbell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className="doorbell" aria-label={label}>
      {children}
    </ul>
  );
}

interface DoorbellPlateProps {
  hasJoined: boolean;
  children: ReactNode;
  action?: ReactNode;
  onRing?: () => void;
}

export function DoorbellPlate({ hasJoined, children, action, onRing }: DoorbellPlateProps) {
  const content = (
    <>
      <span className={`doorbell__bell${hasJoined ? "" : " doorbell__bell--waiting"}`} aria-hidden="true" />
      <span className="doorbell__name">{children}</span>
    </>
  );

  if (onRing) {
    return (
      <li className="doorbell__plate doorbell__plate--ring">
        <button className="doorbell__ring" type="button" onClick={onRing}>
          {content}
        </button>
      </li>
    );
  }
  return (
    <li className="doorbell__plate">
      {content}
      {action}
    </li>
  );
}
