import type { ReactNode } from "react";

export const CALENDAR_ICON_PATHS = (
  <>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </>
);

interface HomeRowProps {
  title: string;
  icon: ReactNode;
  onOpen: () => void;
  // What needs me in this part right now, shown under the row.
  children?: ReactNode;
  // Lets another part of Home render its status under this row.
  statusRef?: (element: HTMLDivElement | null) => void;
}

// One part of the app on Home. The whole header opens it; the tab bar keeps the plain names.
export function HomeRow({ title, icon, onOpen, children, statusRef }: HomeRowProps) {
  return (
    <div className="home-row">
      <div className="home-row__head">
        <svg className="home-row__icon" viewBox="0 0 24 24" aria-hidden="true">
          {icon}
        </svg>
        <button className="home-row__open" type="button" aria-label={`Open ${title}`} onClick={onOpen}>
          {title}
        </button>
        <svg className="home-row__chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </div>
      {(children || statusRef) && (
        <div className="home-row__status" ref={statusRef}>
          {children}
        </div>
      )}
    </div>
  );
}
