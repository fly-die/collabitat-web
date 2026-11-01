import { request, safeId } from "./client";

export type IntervalUnit = "day" | "week" | "month";

export interface Task {
  id: string;
  title: string;
  every: number;
  unit: IntervalUnit;
  firstDueOn: string;
  nextDueOn: string;
  lastCompletion: { id: string; doneOn: string; memberId: string | null } | null;
}

export interface NewTask {
  title: string;
  every: number;
  unit: IntervalUnit;
  firstDueOn: string;
}

export interface Tasks {
  tasks: Task[];
}

const TASK_NOT_FOUND_CODE = "TASK_NOT_FOUND";
const COMPLETION_NOT_FOUND_CODE = "COMPLETION_NOT_FOUND";

const taskPath = (taskId: string) =>
  `/household/tasks/${safeId(taskId, TASK_NOT_FOUND_CODE, "That chore is already gone.")}`;

export const tasksApi = {
  list: () => request<Tasks>("/household/tasks"),
  add: (task: NewTask) => request<Tasks>("/household/tasks", { method: "POST", body: JSON.stringify(task) }),
  remove: (taskId: string) => request<Tasks>(taskPath(taskId), { method: "DELETE" }),
  markDone: (taskId: string, doneOn: string) =>
    request<Tasks>(`${taskPath(taskId)}/completions`, { method: "POST", body: JSON.stringify({ doneOn }) }),
  undoDone: (taskId: string, completionId: string) =>
    request<Tasks>(
      `${taskPath(taskId)}/completions/${safeId(completionId, COMPLETION_NOT_FOUND_CODE, "That was already undone.")}`,
      { method: "DELETE" },
    ),
};
