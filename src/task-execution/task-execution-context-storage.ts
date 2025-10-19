/**
 * Task Execution Context Storage Format
 *
 * Task execution contexts are stored in a single JSON file with the following structure:
 *
 * {
 *   "<taskId>": {
 *     "workingDirectory": string,  // Absolute path to the working directory
 *     "context": string[],         // List of files/folders relevant to the task
 *     "async": boolean             // Whether to run in worktree (true) or not (false)
 *   },
 *   ...
 * }
 *
 * Example:
 * {
 *   "8cd4a5d6-b7a7-4462-929e-ad599b0a5484": {
 *     "workingDirectory": "/home/user/projects/my-project",
 *     "context": ["src/main.ts", "package.json", "docs/"],
 *     "async": true
 *   },
 *   "42ac9c44-067f-4aed-8014-7fac3e0b890f": {
 *     "workingDirectory": "/home/user/documents/research",
 *     "context": ["data.csv", "analysis.py"],
 *     "async": false
 *   }
 * }
 */

import {
    readFile,
    writeFile,
    DataFileName,
} from "src/persistence/file-system-handles";
import { getProductByTaskUuid } from "src/entities/products/product-service";

export interface TaskExecutionContext {
    taskId: string;
    workingDirectory: string;
    context: string[];
    async: boolean;
}

/**
 * Gets the execution context for a task by checking the Product's working directory first,
 * then falling back to the task's execution context working directory.
 *
 * @returns The task execution context, or null if no directory is found
 */
export async function getTaskExecutionContext(
    taskId: string,
): Promise<TaskExecutionContext | null> {
    const executionContexts = await loadTaskExecutionContexts();

    // Get the current task's own context (if any)
    const ownTaskExecutionContext = executionContexts.find(
        (d) => d.taskId === taskId,
    );
    const ownContext = ownTaskExecutionContext?.context || [];
    const ownAsync = ownTaskExecutionContext?.async ?? false;

    // First, try to get the working directory from the Product
    const product = await getProductByTaskUuid(taskId);
    if (product?.workingDirectory) {
        return {
            taskId,
            workingDirectory: product.workingDirectory,
            context: ownContext,
            async: ownAsync,
        };
    }

    // If no Product working directory, fall back to the task's execution context
    if (ownTaskExecutionContext?.workingDirectory) {
        return {
            taskId,
            workingDirectory: ownTaskExecutionContext.workingDirectory,
            context: ownContext,
            async: ownAsync,
        };
    }

    return null;
}

export async function setTaskExecutionContext(
    taskId: string,
    workingDirectory: string,
    context: string[] = [],
    async: boolean = false,
): Promise<void> {
    const executionContexts = await loadTaskExecutionContexts();
    const existingIndex = executionContexts.findIndex(
        (d) => d.taskId === taskId,
    );

    if (existingIndex !== -1) {
        executionContexts[existingIndex].workingDirectory = workingDirectory;
        executionContexts[existingIndex].context = context;
        executionContexts[existingIndex].async = async;
    } else {
        executionContexts.push({ taskId, workingDirectory, context, async });
    }

    await storeTaskExecutionContexts(executionContexts);
}

export async function removeTaskExecutionContext(
    taskId: string,
): Promise<void> {
    const executionContexts = await loadTaskExecutionContexts();
    const filtered = executionContexts.filter((d) => d.taskId !== taskId);
    await storeTaskExecutionContexts(filtered);
}

export async function setFilesOnTaskExecutionContext(
    taskId: string,
    files: string[],
): Promise<void> {
    const executionContexts = await loadTaskExecutionContexts();
    const contextIndex = executionContexts.findIndex(
        (d) => d.taskId === taskId,
    );

    if (contextIndex !== -1) {
        executionContexts[contextIndex].context = files;
        await storeTaskExecutionContexts(executionContexts);
    } else {
        // If no context exists, get the execution context (which includes inherited working directory)
        const executionContext = await getTaskExecutionContext(taskId);
        if (executionContext?.workingDirectory) {
            // Create a new context entry with the inherited working directory
            executionContexts.push({
                taskId,
                workingDirectory: executionContext.workingDirectory,
                context: files,
                async: executionContext.async,
            });
            await storeTaskExecutionContexts(executionContexts);
        } else {
            throw new Error(
                "Task execution context must have a working directory before setting files",
            );
        }
    }
}

async function loadTaskExecutionContexts(): Promise<TaskExecutionContext[]> {
    const text = await readFile(DataFileName.TASK_EXECUTION_CONTEXT);
    if (!text) {
        return [];
    }
    const obj = JSON.parse(text);

    if (obj && typeof obj === "object") {
        return Object.entries(obj).map(([taskId, value]) => {
            const data = value as {
                workingDirectory: string;
                context?: string[];
                async?: boolean;
            };
            return {
                taskId,
                workingDirectory: data.workingDirectory,
                context: data.context || [],
                async: data.async ?? false,
            };
        });
    }

    throw new Error("Invlid Task Execution Context file format");
}

async function storeTaskExecutionContexts(
    executionContexts: TaskExecutionContext[],
): Promise<void> {
    const executionContextsObj = executionContexts.reduce(
        (acc, d) => {
            acc[d.taskId] = {
                workingDirectory: d.workingDirectory,
                context: d.context,
                async: d.async,
            };
            return acc;
        },
        {} as Record<
            string,
            { workingDirectory: string; context: string[]; async: boolean }
        >,
    );

    await writeFile(
        DataFileName.TASK_EXECUTION_CONTEXT,
        JSON.stringify(executionContextsObj, null, 2),
    );
}
