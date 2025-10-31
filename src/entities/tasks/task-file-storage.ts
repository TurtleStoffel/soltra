/**
 * Task File Storage Format
 *
 * Tasks are stored in a single JSON file with the following structure:
 *
 * {
 *   "tasks": [
 *     {
 *       "uuid": string,
 *       "title": string,
 *       "description": string,    // Detailed description of the task
 *       "status": TaskStatus      // Current status of the task
 *     },
 *     ...
 *   ]
 * }
 *
 * Note: The order of tasks in the array determines their display order in the DAG view.
 *
 * Example:
 * {
 *   "tasks": [
 *     {
 *       "uuid": "8cd4a5d6-b7a7-4462-929e-ad599b0a5484",
 *       "title": "Research",
 *       "description": "Conduct thorough research on market trends and competitor analysis",
 *       "status": "Triage"
 *     },
 *     {
 *       "uuid": "42ac9c44-067f-4aed-8014-7fac3e0b890f",
 *       "title": "Graph Tooling",
 *       "description": "Develop and implement graph visualization and management tools",
 *       "status": "In Progress"
 *     },
 *     ...
 *   ]
 * }
 *
 * - Each task has "uuid", "title", "description", and "status" properties.
 * - "title" is a short name for the task.
 * - "description" is a detailed description of the task.
 */

import {
    readFile,
    writeFile,
    DataFileName,
} from "src/persistence/file-system-handles";
import type { Task } from "./types";
import { triggerTaskCreateCallbacks } from "./task-hooks";

export async function loadTasks(): Promise<Task[]> {
    const text = await readFile(DataFileName.TASK);
    if (!text) {
        console.log("[task-file-storage] loadTasks: No file found, returning empty array");
        return [];
    }
    const obj = JSON.parse(text);

    if (obj && obj.tasks && Array.isArray(obj.tasks)) {
        const tasks = obj.tasks.map((task: any) => ({
            uuid: task.uuid,
            title: task.title,
            description: task.description || "",
            status: task.status || "Triage",
        }));
        console.log(`[task-file-storage] loadTasks: Loaded ${tasks.length} tasks`);
        return tasks;
    }
    throw new Error("Invalid task file format");
}

export async function addTask(task: Task): Promise<void> {
    const tasks = await loadTasks();
    tasks.unshift(task);
    await storeTasks(tasks);
}

export async function storeTasks(tasks: Task[]): Promise<void> {
    // Store as array to preserve order
    const tasksArray = tasks.map((t) => ({
        uuid: t.uuid,
        title: t.title,
        description: t.description,
        status: t.status,
    }));

    console.log(`[task-file-storage] storeTasks: Saving ${tasks.length} tasks`);
    await writeFile(
        DataFileName.TASK,
        JSON.stringify({ tasks: tasksArray }, null, 2),
    );
}
