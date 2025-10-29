import { addTaskDeleteCallback } from "../tasks/task-hooks";
import { loadWorkstreams, storeWorkstreams } from "./workstream-file-storage";
import type { Workstream } from "./types";

export type WorkstreamCreateCallback = (workstream: Workstream) => Promise<void> | void;
export type WorkstreamDeleteCallback = (workstreamId: string) => Promise<void> | void;

const createCallbacks: WorkstreamCreateCallback[] = [];
const deleteCallbacks: WorkstreamDeleteCallback[] = [];

export function addWorkstreamCreateCallback(callback: WorkstreamCreateCallback): void {
    createCallbacks.push(callback);
}

export function addWorkstreamDeleteCallback(callback: WorkstreamDeleteCallback): void {
    deleteCallbacks.push(callback);
}

export async function triggerWorkstreamCreateCallbacks(workstream: Workstream): Promise<void> {
    await Promise.all(
        createCallbacks.map((callback) => Promise.resolve(callback(workstream))),
    );
}

export async function triggerWorkstreamDeleteCallbacks(workstreamId: string): Promise<void> {
    await Promise.all(
        deleteCallbacks.map((callback) => Promise.resolve(callback(workstreamId))),
    );
}

/**
 * Register workstream cleanup callback to remove deleted tasks from all workstreams.
 */
export function registerWorkstreamTaskCleanupCallback(): void {
    addTaskDeleteCallback(handleTaskDeletion);
}

async function handleTaskDeletion(taskId: string): Promise<void> {
    const workstreams = await loadWorkstreams();
    let modified = false;

    for (const workstream of workstreams) {
        // Remove task from tasks array
        const taskIndex = workstream.tasks.indexOf(taskId);
        if (taskIndex !== -1) {
            workstream.tasks.splice(taskIndex, 1);
            modified = true;
        }

        // Remove all dependencies involving this task
        const originalLength = workstream.dependencies.length;
        workstream.dependencies = workstream.dependencies.filter(
            (dep) =>
                dep.fromTaskUuid !== taskId && dep.toTaskUuid !== taskId,
        );
        if (workstream.dependencies.length !== originalLength) {
            modified = true;
        }
    }

    // Remove empty workstreams (no tasks left)
    const nonEmptyWorkstreams = workstreams.filter(
        (ws) => ws.tasks.length > 0,
    );

    // Track which workstreams were removed
    const removedWorkstreams = workstreams.filter(
        (ws) => !nonEmptyWorkstreams.includes(ws)
    );

    if (modified || nonEmptyWorkstreams.length !== workstreams.length) {
        await storeWorkstreams(nonEmptyWorkstreams);

        // Trigger deletion callbacks for removed workstreams
        for (const ws of removedWorkstreams) {
            await triggerWorkstreamDeleteCallbacks(ws.uuid);
        }
    }
}
