import { useState } from "react";
import { createPortal } from "react-dom";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import type { Task } from "../api/tasks-api";
import { UndoBar } from "../components/UndoBar";
import { useUndoable } from "../components/useUndoable";
import { ChoreRow } from "../chores/ChoreRow";
import { daysUntil } from "../chores/chore-format";
import { useChores } from "../chores/useChores";
import { AroundTheFlat } from "./AroundTheFlat";
import { ComingUp } from "./ComingUp";

const COMING_UP_WITHIN_DAYS = 7;
const COMING_UP_LIMIT = 3;

interface TodayOverviewProps {
  household: Household;
  onOpenChores: () => void;
  onOpenCalendar: () => void;
  // Flatmates' due chores and what's coming up are cards of their own on Home, outside the block for my day.
  aroundSlot: HTMLElement | null;
  comingUpSlot: HTMLElement | null;
}

// The top of Home: what I need to do today. Flatmates' due chores and the next week's chores and dates
// go to their own cards.
// While chores load or the server is unreachable it stays out of the way; the Chores tab explains.
export function TodayOverview({ household, onOpenChores, onOpenCalendar, aroundSlot, comingUpSlot }: TodayOverviewProps) {
  const { state, completeChore } = useChores();
  const { undoable, offerUndo, takeUndo, dismissUndo } = useUndoable();
  const [error, setError] = useState<string>();

  if (state.status !== "ready") {
    return null;
  }

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try {
      await action();
    } catch (actionError) {
      setError((actionError as ApiError).message);
    }
  }

  const me = household.currentMemberId;
  // A chore without turns is everyone's, so it counts as mine too.
  const isSomeoneElses = (task: Task) => task.turnMemberId !== null && task.turnMemberId !== me;
  const allDue = state.tasks.filter((task) => daysUntil(task.nextDueOn) <= 0);
  const due = allDue.filter((task) => !isSomeoneElses(task));
  const aroundSection =
    aroundSlot &&
    createPortal(<AroundTheFlat household={household} chores={allDue.filter(isSomeoneElses)} onOpenChores={onOpenChores} />, aroundSlot);
  const comingUp = state.tasks
    .filter((task) => {
      const days = daysUntil(task.nextDueOn);
      return days > 0 && days <= COMING_UP_WITHIN_DAYS;
    })
    .slice(0, COMING_UP_LIMIT);

  const comingUpSection =
    comingUpSlot &&
    createPortal(
      <ComingUp household={household} chores={comingUp} onOpenChores={onOpenChores} onOpenCalendar={onOpenCalendar} />,
      comingUpSlot,
    );

  if (state.tasks.length === 0) {
    return (
      <>
      <section className="today" aria-labelledby="today-heading">
        <h2 id="today-heading" className="section-title">
          Today
        </h2>
        <p className="today__note">
          No chores yet.{" "}
          <button className="link-button" type="button" onClick={onOpenChores}>
            Add a chore
          </button>
        </p>
      </section>
      {comingUpSection}
      </>
    );
  }

  return (
    <>
      <section className="today" aria-labelledby="today-heading">
        <h2 id="today-heading" className="section-title">
          Today
        </h2>
        {due.length === 0 ? (
          <p className="today__note">Nothing due today.</p>
        ) : (
          <ul className="panel" aria-label="Due today">
            {due.map((task) => (
              <ChoreRow
                key={task.id}
                task={task}
                household={household}
                onOpen={onOpenChores}
                onDone={() => run(async () => offerUndo(await completeChore(task)))}
              />
            ))}
          </ul>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {aroundSection}
      {comingUpSection}

      {undoable && (
        <UndoBar
            key={undoable.id}
            onExpire={dismissUndo}
          message={undoable.message}
          onUndo={() => {
            const undo = takeUndo();
            if (undo) {
              void run(undo);
            }
          }}
        />
      )}
    </>
  );
}
