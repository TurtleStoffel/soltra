import type { Task } from "src/entities/tasks/types";
import { getProductHierarchyForTask } from "src/entities/products/product-service";
import { updateTask } from "src/entities/tasks/task-service";
import { startScript } from "./task-execution-api";

export interface TaskExecutionResult {
    success: boolean;
    error?: string;
}

export function createWorktreeName(taskTitle: string): string {
    return taskTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 50);
}

async function getTaskBreadcrumbs(taskUuid: string): Promise<string[]> {
    const productHierarchy = await getProductHierarchyForTask(taskUuid);
    return productHierarchy.map((product) => product.title);
}

export async function executeTask(
    task: Task,
    workingDirectory: string | null,
    context: string[] = [],
    async: boolean = false,
): Promise<TaskExecutionResult> {
    if (!workingDirectory) {
        return {
            success: false,
            error: "Working directory is required to execute task",
        };
    }

    if (context.length === 0) {
        return {
            success: false,
            error: "At least 1 file or folder must be added to the context",
        };
    }

    await updateTask({ ...task, status: "In Progress" });

    try {
        const breadcrumbs = (await getTaskBreadcrumbs(task.uuid)).join(" - ");
        const contextString =
            context.length > 0
                ? `, Relevant files or folders: ${context.map((ctx) => `@${ctx}`).join(", ")}`
                : "";

        const argumentWithBreadcrumbs = `${task.title} (Context: ${breadcrumbs}${contextString}) ${task.description}`;

        const requestBody: any = {
            argument: argumentWithBreadcrumbs,
            workingDirectory: workingDirectory,
        };

        // Only include worktree if async is true
        if (async) {
            const worktree = createWorktreeName(task.title);
            requestBody.worktree = worktree;
        }

        const response = await startScript(requestBody);

        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }

        return { success: true };
    } catch (err) {
        const error =
            err instanceof Error ? err.message : "Failed to execute task";
        return {
            success: false,
            error,
        };
    }
}
