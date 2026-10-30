import type { ReactNode } from "react";

export const Tab = {
  Home: "home",
  Money: "money",
} as const;

export type Tab = (typeof Tab)[keyof typeof Tab];

const TAB_ICON_PATHS: Record<Tab, ReactNode> = {
  [Tab.Home]: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />,
  [Tab.Money]: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
};

const TAB_LABELS: Record<Tab, string> = {
  [Tab.Home]: "Home",
  [Tab.Money]: "Money",
};

interface TabBarProps {
  currentTab: Tab;
  onSelect: (tab: Tab) => void;
}

// Chores and Meals join the bar once they exist, never as disabled placeholders.
export function TabBar({ currentTab, onSelect }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {Object.values(Tab).map((tab) => (
        <button
          key={tab}
          className="tab-bar__tab"
          type="button"
          aria-current={tab === currentTab ? "page" : undefined}
          onClick={() => onSelect(tab)}
        >
          <svg className="tab-bar__icon" viewBox="0 0 24 24" aria-hidden="true">
            {TAB_ICON_PATHS[tab]}
          </svg>
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}
