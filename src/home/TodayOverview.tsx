import { useState } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import type { Task } from "../api/tasks-api";
import { UndoBar } from "../components/UndoBar";
import { useUndoable } from "../components/useUndoable";
import { ChoreRow } from "../chores/ChoreRow";
import { daysUntil } from "../chores/chore-format";
import { useChores } from "../chores/useChores";

const COMING_UP_WITHIN_DAYS = 7;
const COMING_UP_LIMIT = 3;

interface TodayOverviewProps {
  household: Household;
  onOpenChores: () => void;
}

// The top of Home: what needs doing today (my turns first) and the next few things after that.
// While chores load or the server is unreachable it stays out of the way; the Chores tab explains.
export function TodayOverview({ household, onOpenChores }: TodayOverviewProps) {
  const { state, completeChore } = useChores();
  const { undoable, offerUndo, takeUndo } = useUndoable();
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
  const isMine = (task: Task) => task.turnMemberId === me;
  const due = state.tasks
    .filter((task) => daysUntil(task.nextDueOn) <= 0)
    .sort((first, second) => Number(isMine(second)) - Number(isMine(first)));
  const comingUp = state.tasks
    .filter((task) => {
      const days = daysUntil(task.nextDueOn);
      return days > 0 && days <= COMING_UP_WITHIN_DAYS;
    })
    .slice(0, COMING_UP_LIMIT);

  if (state.tasks.length === 0) {
    return (
      <section className="today" aria-labelledby="today-heading">
        <h2 id="today-heading" className="section-title">
          Today
        </h2>
        <p className="today__note">
          Nothing to do yet.{" "}
          <button className="link-button" type="button" onClick={onOpenChores}>
            Add your first chore
          </button>{" "}
          and this is where you see whose turn it is.
        </p>
      </section>
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

      {comingUp.length > 0 && (
        <section className="today" aria-labelledby="coming-up-heading">
          <h2 id="coming-up-heading" className="section-title">
            Coming up
          </h2>
          <ul className="panel" aria-label="Coming up">
            {comingUp.map((task) => (
              <ChoreRow key={task.id} task={task} household={household} onOpen={onOpenChores} />
            ))}
          </ul>
        </section>
      )}

      {undoable && (
        <UndoBar
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
