import type { Household } from "../api/households-api";

const MEMBER_COLOR_COUNT = 6;

interface AvatarProps {
  household: Household;
  memberId: string;
  size?: "small";
}

// A flatmate's initial on their own color, so a row says who at a glance. The name always stands next to it,
// so the initial is drawn by CSS and stays out of what gets read aloud or copied.
export function Avatar({ household, memberId, size }: AvatarProps) {
  const position = household.members.findIndex((member) => member.id === memberId);
  if (position < 0) {
    return null;
  }
  const initial = (Array.from(household.members[position].name.trim())[0] ?? "?").toUpperCase();
  const color = (position % MEMBER_COLOR_COUNT) + 1;
  return <span className={`avatar avatar--${color}${size ? ` avatar--${size}` : ""}`} data-initial={initial} aria-hidden="true" />;
}
