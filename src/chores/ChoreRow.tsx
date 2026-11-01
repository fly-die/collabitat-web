import type { Household } from "../api/households-api";
import type { Task } from "../api/tasks-api";
import { daysUntil, describeDue } from "./chore-format";

interface ChoreRowProps {
  task: Task;
  household: Household;
  onOpen?: () => void;
  // Without it the row is for reading only, like the Home preview of what's coming up.
  onDone?: () => void;
}

export function turnLabel(task: Task, household: Household) {
  if (!task.turnMemberId) {
    return undefined;
  }
  if (task.turnMemberId === household.currentMemberId) {
    return "Your turn";
  }
  const name = household.members.find((member) => member.id === task.turnMemberId)?.name;
  return name ? `${name}'s turn` : undefined;
}

export function ChoreRow({ task, household, onOpen, onDone }: ChoreRowProps) {
  const isMine = task.turnMemberId === household.currentMemberId;
  const isOverdue = daysUntil(task.nextDueOn) < 0;
  const turn = turnLabel(task, household);
  const content = (
    <span className="chore__text">
      <span className="chore__title">{task.title}</span>
      <span className="chore__meta">
        {turn && <span className={isMine ? "chore__turn--mine" : undefined}>{turn}</span>}
        <span className={isOverdue ? "chore__due--overdue" : undefined}>{describeDue(task.nextDueOn)}</span>
      </span>
    </span>
  );

  return (
    <li className={`panel__row chore${isMine ? " chore--mine" : ""}`}>
      {onOpen ? (
        <button className="chore__open" type="button" onClick={onOpen}>
          {content}
        </button>
      ) : (
        <span className="chore__static">{content}</span>
      )}
      {onDone && (
        <button
          className={`button button--outline chore__done${isMine ? " chore__done--mine" : ""}`}
          type="button"
          aria-label={`Mark ${task.title} done`}
          onClick={onDone}
        >
          Done
        </button>
      )}
    </li>
  );
}
