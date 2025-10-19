import { createWorktreeName } from "./task-execution-logic";
import { getTaskExecutionContext } from "./task-execution-context-storage";
import { deleteWorktree } from "./task-execution-api";
import { addTaskStatusChangeCallback } from "src/entities/tasks/task-service";
import type { Task, TaskStatus } from "src/entities/tasks/types";

export function registerWorktreeCleanupCallback() {
    addTaskStatusChangeCallback(worktreeCleanupCallback);
}

async function worktreeCleanupCallback(
    task: Task,
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
) {
    if (newStatus === "Done") {
        try {
            const taskExecutionContext = await getTaskExecutionContext(
                task.uuid,
            );
            const workingDirectory = taskExecutionContext?.workingDirectory;

            if (!workingDirectory) {
                console.warn(
                    `No working directory found for task ${task.uuid}, skipping worktree cleanup`,
                );
                return;
            }

            const worktree = createWorktreeName(task.title);
            await deleteWorktree(worktree, { workingDirectory });
        } catch (error) {
            console.error("Failed to cleanup worktree:", error);
        }
    }
}
