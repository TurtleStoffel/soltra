import { addTaskDeleteCallback } from "../tasks/task-service";
import { loadWorkstreams, storeWorkstreams } from "./workstream-file-storage";

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

    if (modified || nonEmptyWorkstreams.length !== workstreams.length) {
        await storeWorkstreams(nonEmptyWorkstreams);
    }
}
