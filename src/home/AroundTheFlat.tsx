import { useState } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import { tasksApi, type Task } from "../api/tasks-api";
import { ChoreRow } from "../chores/ChoreRow";

interface AroundTheFlatProps {
  household: Household;
  // Chores that are due and someone else's turn.
  chores: Task[];
  onOpenChores: () => void;
}

// On Home: what flatmates still have to do today, with a way to remind them. Away when nobody is behind.
export function AroundTheFlat({ household, chores, onOpenChores }: AroundTheFlatProps) {
  const [nudgedTaskIds, setNudgedTaskIds] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  if (chores.length === 0) {
    return null;
  }
  const nameOf = (memberId: string | null) => household.members.find((member) => member.id === memberId)?.name ?? "them";

  async function nudge(task: Task) {
    setError(undefined);
    try {
      await tasksApi.nudge(task.id);
      setNudgedTaskIds((taskIds) => [...taskIds, task.id]);
    } catch (nudgeError) {
      setError((nudgeError as ApiError).message);
    }
  }

  return (
    <section className="today" aria-labelledby="around-heading">
      <h2 id="around-heading" className="section-title">
        Around the flat
      </h2>
      <ul className="panel" aria-labelledby="around-heading">
        {chores.map((task) => {
          const isNudged = nudgedTaskIds.includes(task.id);
          return (
            <ChoreRow
              key={task.id}
              task={task}
              household={household}
              onOpen={onOpenChores}
              action={
                <button
                  className="button button--quiet chore__nudge"
                  type="button"
                  aria-label={`Nudge ${nameOf(task.turnMemberId)} about ${task.title}`}
                  disabled={isNudged}
                  onClick={() => void nudge(task)}
                >
                  {isNudged ? "Nudged" : "Nudge"}
                </button>
              }
            />
          );
        })}
      </ul>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
