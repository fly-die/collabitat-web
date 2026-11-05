import { useState, type ReactNode } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import type { NewTask, Task } from "../api/tasks-api";
import { Sheet } from "../components/Sheet";
import { UndoBar } from "../components/UndoBar";
import { useUndoable } from "../components/useUndoable";
import { formatDay } from "../money/money-format";
import { AddChoreScreen } from "./AddChoreScreen";
import { ChoreRow } from "./ChoreRow";
import { daysUntil, describeDue, describeInterval, plural } from "./chore-format";
import { useChores } from "./useChores";

interface ChoresViewProps {
  household: Household;
}

type ChoresScreen = { name: "overview" } | { name: "add" } | { name: "chore"; task: Task } | { name: "edit"; task: Task };

const asNewTask = ({ title, every, unit, firstDueOn, rotation }: Task) => ({ title, every, unit, firstDueOn, rotationMemberIds: rotation });

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
  const { state, retry, addChore, updateChore, removeChore, completeChore } = useChores();
  const [screen, setScreen] = useState<ChoresScreen>({ name: "overview" });
  const { undoable, offerUndo, takeUndo, dismissUndo } = useUndoable();
  const [error, setError] = useState<string>();
  const me = household.currentMemberId;
  const backToOverview = () => setScreen({ name: "overview" });
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const nameOf = (memberId: string | null) =>
    memberId === me ? "you" : (household.members.find((member) => member.id === memberId)?.name ?? "someone who left");
  const describeTurns = (rotation: string[]) => {
    if (rotation.length > 1) {
      return `Turns go ${rotation.map((memberId) => capitalize(nameOf(memberId))).join(", then ")}.`;
    }
    return rotation[0] === me ? "You do it every time." : `${capitalize(nameOf(rotation[0]))} does it every time.`;
  };

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try {
      await action();
    } catch (actionError) {
      setError((actionError as ApiError).message);
    }
  }

  async function markDone(task: Task) {
    offerUndo(await completeChore(task));
  }

  async function deleteChore(task: Task) {
    await removeChore(task.id);
    // Brought back from its next due date, so undo doesn't make it due again right away.
    const { title, every, unit, nextDueOn, rotation } = task;
    offerUndo({
      message: `${title} deleted.`,
      undo: () => addChore({ title, every, unit, firstDueOn: nextDueOn, rotationMemberIds: rotation }),
    });
  }

  async function changeChore(task: Task, changed: NewTask) {
    await updateChore(task.id, changed);
    offerUndo({ message: `${changed.title.trim()} saved.`, undo: () => updateChore(task.id, asNewTask(task)) });
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
  let sheet: ReactNode;
  if (screen.name === "add") {
    sheet = (
      <Sheet label="Add a chore" onClose={backToOverview}>
        <AddChoreScreen household={household} tasks={state.tasks} onSave={addChore} onBack={backToOverview} />
      </Sheet>
    );
  }
  if (screen.name === "edit") {
    const { task } = screen;
    sheet = (
      <Sheet label="Edit chore" onClose={backToOverview}>
        <AddChoreScreen
          household={household}
          tasks={state.tasks}
          task={task}
          onSave={(changed) => changeChore(task, changed)}
          onBack={backToOverview}
        />
      </Sheet>
    );
  }
  if (screen.name === "chore") {
    const { task } = screen;
    sheet = (
      <Sheet label={task.title} onClose={backToOverview}>
      <div className="screen">
        <button className="back-link" type="button" onClick={backToOverview}>
          Close
        </button>
        <h1 className="page-title">{task.title}</h1>
        <p className="chore-detail">
          {describeInterval(task.every, task.unit)}. {describeDue(task.nextDueOn)}.
        </p>
        {task.rotation.length > 0 && <p className="chore-detail">{describeTurns(task.rotation)}</p>}
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
        <button className="button button--block" type="button" onClick={() => setScreen({ name: "edit", task })}>
          Edit chore
        </button>
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
      </Sheet>
    );
  }

  const tasks = state.tasks;
  const due = tasks.filter((task) => daysUntil(task.nextDueOn) <= 0);
  const later = tasks.filter((task) => daysUntil(task.nextDueOn) > 0);
  const myDueCount = due.filter((task) => task.turnMemberId === me).length;
  const headline = due.length > 0 ? `${plural(due.length, "chore")} to do` : "All done for now";
  const choreList = (label: string, list: Task[]) => (
    <section className="chores__group">
      <h2 className="section-title">{label}</h2>
      <ul className="panel" aria-label={label}>
        {list.map((task) => (
          <ChoreRow
            key={task.id}
            task={task}
            household={household}
            onOpen={() => setScreen({ name: "chore", task })}
            onDone={() => run(() => markDone(task))}
          />
        ))}
      </ul>
    </section>
  );

  const isBehindSheet = sheet !== undefined;
  return (
    <>
    <div className="screen chores" inert={isBehindSheet} aria-hidden={isBehindSheet || undefined}>
      <p className="eyebrow">Chores</p>
      <h1 className="page-title page-title--large">{tasks.length === 0 ? "Nothing to track yet" : headline}</h1>
      {myDueCount > 0 && <p className="hint">{myTurnHint(myDueCount, due.length)}</p>}

      <button className="button button--block money__add" type="button" onClick={() => setScreen({ name: "add" })}>
        Add a chore
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {tasks.length === 0 && (
        <p className="empty-state">
          Add what needs doing again and again, like taking out the trash every week. Tick it off when it's done and
          Collabitat works out when it's next due and whose turn it is.
        </p>
      )}
      {due.length > 0 && choreList("Due", due)}
      {later.length > 0 && choreList("Later", later)}

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
    </div>
    {sheet}
    </>
  );
}
