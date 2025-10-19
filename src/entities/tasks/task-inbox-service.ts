import { addTask } from "./task-file-storage";
import type { Task } from "./types";
import {
    removeInboxTask,
    updateInboxTask,
    type InboxTask,
} from "./task-inbox-storage";

export async function convertInboxTaskToTask(
    inboxTask: InboxTask,
): Promise<Task> {
    const uuid = crypto.randomUUID();

    const task: Task = {
        uuid,
        title: inboxTask.title,
        description: "",
        status: "Triage",
    };

    await addTask(task);
    await removeInboxTask(inboxTask.title);

    return task;
}

export async function renameInboxTask(
    originalTitle: string,
    newTitle: string,
): Promise<void> {
    if (!newTitle.trim()) {
        throw new Error("Task title cannot be empty");
    }

    const updatedTask: InboxTask = {
        title: newTitle.trim(),
    };

    await updateInboxTask(originalTitle, updatedTask);
}
