import type { ReactNode } from "react";
import type { Household } from "../api/households-api";
import type { Task } from "../api/tasks-api";
import { ChoreRow } from "../chores/ChoreRow";
import { ItemIcon } from "../components/item-icons";
import { describeEntryMeta, describeUpcomingDay } from "../calendar/calendar-format";
import { useCalendar } from "../calendar/useCalendar";
import { addDays } from "../meals/week";
import { todayIsoDate } from "../money/money-format";

const DAYS_AHEAD = 7;
const MAX_SHOWN = 3;

interface ComingUpProps {
  household: Household;
  // Chores due in the next days, already picked by Today.
  chores: Task[];
  onOpenChores: () => void;
  onOpenCalendar: () => void;
}

// On Home: the next week's chores and dates in one list by day, or a way to add the first date. Quiet while loading.
export function ComingUp({ household, chores, onOpenChores, onOpenCalendar }: ComingUpProps) {
  const today = todayIsoDate();
  const { state } = useCalendar(today);
  if (state.status !== "ready") {
    return null;
  }
  const lastDay = addDays(today, DAYS_AHEAD - 1);
  const upcoming = state.view.entries.filter((entry) => entry.day <= lastDay);
  const shown = upcoming.slice(0, MAX_SHOWN);
  const more = upcoming.length - shown.length;
  const rows: { day: string; row: ReactNode }[] = [
    ...chores.map((task) => ({
      day: task.nextDueOn,
      row: <ChoreRow key={`chore-${task.id}`} task={task} household={household} onOpen={onOpenChores} />,
    })),
    ...shown.map((entry) => ({
      day: entry.day,
      row: (
        <li key={`date-${entry.id}`} className="panel__row chore">
          <button className="chore__open" type="button" onClick={onOpenCalendar}>
            <ItemIcon name="calendar" />
            <span className="chore__text">
              <span className="chore__title">
                {describeUpcomingDay(entry.day, today)}: {entry.title}
              </span>
              <span className="chore__meta">{describeEntryMeta(state.view.columns, entry)}</span>
            </span>
          </button>
        </li>
      ),
    })),
  ].sort((first, second) => first.day.localeCompare(second.day));

  return (
    <section className="today" aria-labelledby="coming-up-heading">
      <h2 id="coming-up-heading" className="section-title">
        Coming up
      </h2>
      {rows.length > 0 ? (
        <>
          <ul className="panel" aria-labelledby="coming-up-heading">
            {rows.map(({ row }) => row)}
          </ul>
          <p className="today__note">
            {more > 0 && `${more} more this week. `}
            <button className="link-button" type="button" onClick={onOpenCalendar}>
              See the calendar
            </button>
          </p>
        </>
      ) : (
        <p className="today__note">
          Nothing in the next 7 days.{" "}
          <button className="link-button" type="button" onClick={onOpenCalendar}>
            Add a date
          </button>
        </p>
      )}
    </section>
  );
}
