import { loadTasks, storeTasks, addTask } from "./task-file-storage";
import type { Task } from "./types";
import {
    triggerTaskStatusChangeCallbacks,
    triggerTaskDeleteCallbacks,
    triggerTaskCreateCallbacks,
} from "./task-hooks";

/**
 * Create a new task with the given title and description.
 * @param title - The title of the new task
 * @param description - The description of the new task (optional)
 * @returns The created task
 */
export async function createTask(
    title: string,
    description: string = "",
): Promise<Task> {
    const newTask: Task = {
        uuid: crypto.randomUUID(),
        title,
        description,
        status: "Triage",
    };

    await addTask(newTask);
    await triggerTaskCreateCallbacks(newTask);
    return newTask;
}

export async function updateTask(task: Task): Promise<void> {
    const tasks = await loadTasks();
    const index = tasks.findIndex((t) => t.uuid === task.uuid);
    if (index !== -1) {
        const oldTask = tasks[index]!!;
        const oldStatus = oldTask.status;
        const newStatus = task.status;

        tasks[index] = task;
        await storeTasks(tasks);

        // Trigger callbacks if status changed
        if (oldStatus !== newStatus) {
            await triggerTaskStatusChangeCallbacks(task, oldStatus, newStatus);
        }
    } else {
        throw new Error(`Task with UUID ${task.uuid} not found for update.`);
    }
}

/**
 * Remove a Task and all its connections.
 */
export async function removeTask(taskId: string): Promise<void> {
    const tasks = await loadTasks();

    const removedTask = tasks.find((n) => n.uuid === taskId);
    if (!removedTask) {
        return; // Task doesn't exist, nothing to remove
    }

    // Filter out the task with the given ID
    const newTasks = tasks.filter((n) => n.uuid !== taskId);

    await storeTasks(newTasks);

    // Trigger delete callbacks
    await triggerTaskDeleteCallbacks(taskId);
}
