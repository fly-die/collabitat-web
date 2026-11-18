import type { ReactNode } from "react";
import type { Household } from "../api/households-api";
import type { Task } from "../api/tasks-api";
import { Avatar } from "../components/Avatar";
import { ItemIcon, iconFor } from "../components/item-icons";
import { daysUntil, describeDue } from "./chore-format";

interface ChoreRowProps {
  task: Task;
  household: Household;
  onOpen?: () => void;
  // Without it the row is for reading only, like the Home preview of what's coming up.
  onDone?: () => void;
  // Shown at the end of the row in place of Done, like asking a flatmate to get to it.
  action?: ReactNode;
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

export function ChoreRow({ task, household, onOpen, onDone, action }: ChoreRowProps) {
  const isMine = task.turnMemberId === household.currentMemberId;
  const isOverdue = daysUntil(task.nextDueOn) < 0;
  const turn = turnLabel(task, household);
  const content = (
    <>
      <ItemIcon name={iconFor(task.title, "chore")} />
      <span className="chore__text">
      <span className="chore__title">{task.title}</span>
      <span className="chore__meta">
        {turn && task.turnMemberId && (
          <span className={`with-avatar${isMine ? " chore__turn--mine" : ""}`}>
            <Avatar household={household} memberId={task.turnMemberId} size="small" />
            {turn}
          </span>
        )}
        <span className={isOverdue ? "chore__due--overdue" : undefined}>{describeDue(task.nextDueOn)}</span>
      </span>
      </span>
    </>
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
      {action}
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
