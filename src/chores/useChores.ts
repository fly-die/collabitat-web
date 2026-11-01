import { useEffect, useState } from "react";
import type { ApiError } from "../api/client";
import { tasksApi, type NewTask, type Tasks } from "../api/tasks-api";

type ChoresState =
  | { status: "loading" }
  | { status: "ready"; tasks: Tasks["tasks"] }
  | { status: "unreachable"; message: string };

export function useChores() {
  const [state, setState] = useState<ChoresState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);

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

  return {
    state,
    retry,
    addChore: (task: NewTask) => apply(tasksApi.add(task)),
    removeChore: (taskId: string) => apply(tasksApi.remove(taskId)),
    markDone: (taskId: string, doneOn: string) => apply(tasksApi.markDone(taskId, doneOn)),
    undoDone: (taskId: string, completionId: string) => apply(tasksApi.undoDone(taskId, completionId)),
  };
}
