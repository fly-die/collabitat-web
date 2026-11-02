import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import { useLiveTopic } from "../live/live-updates";
import { tasksApi, type NewTask, type Task, type Tasks } from "../api/tasks-api";
import type { Undoable } from "../components/useUndoable";
import { formatDay, todayIsoDate } from "../money/money-format";

type ChoresState =
  | { status: "loading" }
  | { status: "ready"; tasks: Tasks["tasks"] }
  | { status: "unreachable"; message: string };

export function useChores() {
  const [state, setState] = useState<ChoresState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  // A flatmate changed something: reload in place, without showing the loading state.
  useLiveTopic("chores", () => setLoadAttempt((attempt) => attempt + 1));

  useEffect(() => {
    let isCurrent = true;
    tasksApi
      .list()
      .then(({ tasks }) => {
        if (isCurrent) {
          setState({ status: "ready", tasks });
        }
      })
      .catch((error: ApiError) => {
        if (isCurrent) {
          setState({ status: "unreachable", message: error.message });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [loadAttempt]);

  const retry = () => {
    setState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  };

  // Each change answers with the whole list, so what's shown is always what the server has.
  const apply = async (change: Promise<Tasks>) => {
    const { tasks } = await change;
    setState({ status: "ready", tasks });
    return tasks;
  };

  // Marks it done today and hands back how to take that back, for the undo bar.
  const completeChore = async (task: Task): Promise<Undoable | undefined> => {
    const tasks = await apply(tasksApi.markDone(task.id, todayIsoDate()));
    const done = tasks.find((candidate) => candidate.id === task.id);
    const completionId = done?.lastCompletion?.id;
    if (!done || !completionId) {
      return undefined;
    }
    return {
      message: `${task.title} done. Next: ${formatDay(done.nextDueOn)}.`,
      undo: () => apply(tasksApi.undoDone(task.id, completionId)),
    };
  };

  return {
    state,
    completeChore,
    retry,
    addChore: (task: NewTask) => apply(tasksApi.add(task)),
    removeChore: (taskId: string) => apply(tasksApi.remove(taskId)),
  };
}
