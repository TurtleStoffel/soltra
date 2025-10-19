import type { Task, TaskStatus } from "./types";

export type TaskStatusChangeCallback = (
    task: Task,
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
) => Promise<void> | void;

export type TaskDeleteCallback = (taskId: string) => Promise<void> | void;

const statusChangeCallbacks: TaskStatusChangeCallback[] = [];
const deleteCallbacks: TaskDeleteCallback[] = [];

export function addTaskStatusChangeCallback(
    callback: TaskStatusChangeCallback,
): void {
    statusChangeCallbacks.push(callback);
}

export function addTaskDeleteCallback(callback: TaskDeleteCallback): void {
    deleteCallbacks.push(callback);
}

export async function triggerTaskStatusChangeCallbacks(
    task: Task,
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
): Promise<void> {
    await Promise.all(
        statusChangeCallbacks.map((callback) =>
            Promise.resolve(callback(task, oldStatus, newStatus)),
        ),
    );
}

export async function triggerTaskDeleteCallbacks(taskId: string): Promise<void> {
    await Promise.all(
        deleteCallbacks.map((callback) => Promise.resolve(callback(taskId))),
    );
}
