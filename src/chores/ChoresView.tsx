import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import type { Task } from "../api/tasks-api";
import { UNDO_TIMEOUT_MS, UndoBar } from "../components/UndoBar";
import { formatDay, todayIsoDate } from "../money/money-format";
import { AddChoreScreen } from "./AddChoreScreen";
import { daysUntil, describeDue, describeInterval, plural } from "./chore-format";
import { useChores } from "./useChores";

interface ChoresViewProps {
  household: Household;
}

type ChoresScreen = { name: "overview" } | { name: "add" } | { name: "chore"; task: Task };

interface Undoable {
  message: string;
  undo: () => Promise<unknown>;
}

function myTurnHint(myDueCount: number, dueCount: number) {
  if (dueCount === 1) {
    return "It's your turn.";
  }
  if (myDueCount === dueCount) {
    return "All of them are your turn.";
  }
  return `${myDueCount} of them ${myDueCount === 1 ? "is" : "are"} your turn.`;
}

export function ChoresView({ household }: ChoresViewProps) {
  const { state, retry, addChore, removeChore, markDone, undoDone } = useChores();
  const [screen, setScreen] = useState<ChoresScreen>({ name: "overview" });
  const [undoable, setUndoable] = useState<Undoable>();
  const [error, setError] = useState<string>();
  const backToOverview = () => setScreen({ name: "overview" });
  const nameOf = (memberId: string | null) =>
    memberId === household.currentMemberId
      ? "you"
      : (household.members.find((member) => member.id === memberId)?.name ?? "someone who left");

  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const turnText = (memberId: string) =>
    memberId === household.currentMemberId ? "Your turn" : `${capitalize(nameOf(memberId))}'s turn`;

  useEffect(() => {
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
    }
  }, [screen]);

  useEffect(() => {
    if (!undoable) {
      return;
    }
    const timeout = setTimeout(() => setUndoable(undefined), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [undoable]);

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try {
      await action();
    } catch (actionError) {
      setError((actionError as ApiError).message);
    }
  }

  async function completeChore(task: Task) {
    const tasks = await markDone(task.id, todayIsoDate());
    const done = tasks.find((candidate) => candidate.id === task.id);
    const completionId = done?.lastCompletion?.id;
    if (done && completionId) {
      setUndoable({
        message: `${task.title} done. Next: ${formatDay(done.nextDueOn)}.`,
        undo: () => undoDone(task.id, completionId),
      });
    }
  }

  async function deleteChore(task: Task) {
    await removeChore(task.id);
    // Brought back from its next due date, so undo doesn't make it due again right away.
    const { title, every, unit, nextDueOn, rotation } = task;
    setUndoable({
      message: `${title} deleted.`,
      undo: () => addChore({ title, every, unit, firstDueOn: nextDueOn, rotationMemberIds: rotation }),
    });
  }

  if (state.status === "loading") {
    return <p className="screen hint">Looking at what needs doing…</p>;
  }
  if (state.status === "unreachable") {
    return (
      <div className="screen">
        <p role="alert">{state.message}</p>
        <button className="button" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }
  if (screen.name === "add") {
    return <AddChoreScreen onAdd={addChore} onBack={backToOverview} />;
  }
  if (screen.name === "chore") {
    const { task } = screen;
    return (
      <div className="screen">
        <button className="back-link" type="button" onClick={backToOverview}>
          Back
        </button>
        <h1 className="page-title">{task.title}</h1>
        <p className="chore-detail">
          {describeInterval(task.every, task.unit)}. {describeDue(task.nextDueOn)}.
        </p>
        {task.rotation.length > 0 && (
          <p className="chore-detail">Turns go {task.rotation.map((memberId) => capitalize(nameOf(memberId))).join(", then ")}.</p>
        )}
        <p className="chore-detail">
          {task.lastCompletion
            ? `Last done ${formatDay(task.lastCompletion.doneOn).toLowerCase()} by ${nameOf(task.lastCompletion.memberId)}.`
            : "Not done yet."}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button--quiet expense-screen__delete"
          type="button"
          onClick={() =>
            run(async () => {
              await deleteChore(task);
              backToOverview();
            })
          }
        >
          Delete chore
        </button>
      </div>
    );
  }

  const tasks = state.tasks;
  const dueCount = tasks.filter((task) => daysUntil(task.nextDueOn) <= 0).length;
  const headline = dueCount > 0 ? `${plural(dueCount, "chore")} to do` : "All done for now";
  const myDueCount = tasks.filter(
    (task) => daysUntil(task.nextDueOn) <= 0 && task.turnMemberId === household.currentMemberId,
  ).length;

  return (
    <div className="screen chores">
      <p className="eyebrow">Chores</p>
      <h1 className="page-title page-title--large">{tasks.length === 0 ? "Nothing to track yet" : headline}</h1>
      {myDueCount > 0 && (
        <p className="hint">{myTurnHint(myDueCount, dueCount)}</p>
      )}

      <button className="button button--block money__add" type="button" onClick={() => setScreen({ name: "add" })}>
        Add a chore
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="empty-state">
          Add what needs doing again and again, like taking out the trash every week. Tick it off when it's done and
          Collabitat works out when it's next due.
        </p>
      ) : (
        <ul className="panel" aria-label="Chores">
          {tasks.map((task) => {
            const isOverdue = daysUntil(task.nextDueOn) < 0;
            const isMyTurn = task.turnMemberId === household.currentMemberId;
            return (
              <li key={task.id} className="panel__row chore">
                <button className="chore__open" type="button" onClick={() => setScreen({ name: "chore", task })}>
                  <span className="chore__text">
                    <span className="chore__title">{task.title}</span>
                    <span className="chore__meta">
                      {task.turnMemberId && (
                        <span className={isMyTurn ? "chore__turn--mine" : undefined}>{turnText(task.turnMemberId)}</span>
                      )}
                      <span className={isOverdue ? "chore__due--overdue" : undefined}>{describeDue(task.nextDueOn)}</span>
                      <span>{describeInterval(task.every, task.unit)}</span>
                    </span>
                  </span>
                </button>
                <button
                  className="button button--outline chore__done"
                  type="button"
                  aria-label={`Mark ${task.title} done`}
                  onClick={() => run(() => completeChore(task))}
                >
                  Done
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {undoable && (
        <UndoBar
          message={undoable.message}
          onUndo={() => {
            const { undo } = undoable;
            setUndoable(undefined);
            void run(undo);
          }}
        />
      )}
    </div>
  );
}
