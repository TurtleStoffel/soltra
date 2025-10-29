/**
 * Global Order Hooks
 *
 * This module registers callbacks to automatically update the global order
 * when tasks or workstreams are created or deleted.
 */

import { addTaskCreateCallback, addTaskDeleteCallback } from "src/entities/tasks/task-hooks";
import { addWorkstreamCreateCallback, addWorkstreamDeleteCallback } from "src/entities/workstreams/workstream-hooks";
import { getGlobalOrder } from "./global-order-service";
import { loadTasks } from "src/entities/tasks/task-file-storage";
import { loadWorkstreams } from "src/entities/workstreams/workstream-file-storage";
import type { Task } from "src/entities/tasks/types";
import type { Workstream } from "src/entities/workstreams/types";

/**
 * Register all global order hooks.
 * This should be called once during app initialization.
 */
export function registerGlobalOrderHooks(): void {
    addTaskCreateCallback(handleTaskCreation);
    addTaskDeleteCallback(handleTaskDeletion);
    addWorkstreamCreateCallback(handleWorkstreamCreation);
    addWorkstreamDeleteCallback(handleWorkstreamDeletion);
}

async function handleTaskCreation(task: Task): Promise<void> {
    try {
        const tasks = await loadTasks();
        const workstreams = await loadWorkstreams();

        const workstreamUuids = workstreams.map(ws => ws.uuid);
        const taskUuids = tasks.map(t => t.uuid);

        // Get current order and it will auto-sync to include the new task
        await getGlobalOrder(workstreamUuids, taskUuids);

        // Order is automatically saved by getGlobalOrder during sync
        console.log(`Global order updated: added task ${task.uuid}`);
    } catch (error) {
        console.error("Failed to update global order after task creation:", error);
    }
}

async function handleTaskDeletion(taskId: string): Promise<void> {
    try {
        const tasks = await loadTasks();
        const workstreams = await loadWorkstreams();

        const workstreamUuids = workstreams.map(ws => ws.uuid);
        const taskUuids = tasks.map(t => t.uuid);

        // Get current order and it will auto-sync to remove the deleted task
        await getGlobalOrder(workstreamUuids, taskUuids);

        // Order is automatically saved by getGlobalOrder during sync
        console.log(`Global order updated: removed task ${taskId}`);
    } catch (error) {
        console.error("Failed to update global order after task deletion:", error);
    }
}

async function handleWorkstreamCreation(workstream: Workstream): Promise<void> {
    try {
        const tasks = await loadTasks();
        const workstreams = await loadWorkstreams();

        const workstreamUuids = workstreams.map(ws => ws.uuid);
        const taskUuids = tasks.map(t => t.uuid);

        // Get current order and it will auto-sync to include the new workstream
        await getGlobalOrder(workstreamUuids, taskUuids);

        // Order is automatically saved by getGlobalOrder during sync
        console.log(`Global order updated: added workstream ${workstream.uuid}`);
    } catch (error) {
        console.error("Failed to update global order after workstream creation:", error);
    }
}

async function handleWorkstreamDeletion(workstreamId: string): Promise<void> {
    try {
        const tasks = await loadTasks();
        const workstreams = await loadWorkstreams();

        const workstreamUuids = workstreams.map(ws => ws.uuid);
        const taskUuids = tasks.map(t => t.uuid);

        // Get current order and it will auto-sync to remove the deleted workstream
        await getGlobalOrder(workstreamUuids, taskUuids);

        // Order is automatically saved by getGlobalOrder during sync
        console.log(`Global order updated: removed workstream ${workstreamId}`);
    } catch (error) {
        console.error("Failed to update global order after workstream deletion:", error);
    }
}
