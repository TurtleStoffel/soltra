import { loadWorkstreams } from "./workstream-file-storage";
import { createWorkstream } from "./workstream-file-storage";
import { addTaskToWorkstream, addDependency } from "./workstream-service";
import type { Workstream, DependencyType } from "./types";
import type { Task } from "../tasks/types";

/**
 * Connect two tasks together, managing workstream membership and dependencies.
 * If one task has a workstream and the other doesn't, the task without a workstream
 * will join the existing workstream. If neither has a workstream, a new one is created.
 *
 * @param sourceId - The UUID of the source task (the task that blocks)
 * @param targetId - The UUID of the target task (the task that is blocked)
 * @param tasks - Array of all tasks (used to generate workstream title if needed)
 * @param dependencyType - The type of dependency (defaults to "blocks")
 */
export async function connectTasks(
    sourceId: string,
    targetId: string,
    tasks: Task[],
    dependencyType: DependencyType = "blocks",
): Promise<void> {
    if (sourceId === targetId) {
        throw new Error("Cannot connect a task to itself");
    }

    const workstreams = await loadWorkstreams();

    // Find workstream that contains the source task
    const sourceWorkstream = workstreams.find((ws) =>
        ws.tasks.includes(sourceId),
    );

    // Find workstream that contains the target task
    const targetWorkstream = workstreams.find((ws) =>
        ws.tasks.includes(targetId),
    );

    // Determine which workstream to use
    let finalWorkstream: Workstream;

    if (!sourceWorkstream && !targetWorkstream) {
        // Neither task has a workstream - create a new one
        finalWorkstream = await createWorkstream("", "");
    } else if (sourceWorkstream && !targetWorkstream) {
        // Source has a workstream, target doesn't - use source's workstream
        finalWorkstream = sourceWorkstream;
    } else if (!sourceWorkstream && targetWorkstream) {
        // Target has a workstream, source doesn't - use target's workstream
        finalWorkstream = targetWorkstream;
    } else {
        // Both have workstreams - use source's workstream
        finalWorkstream = sourceWorkstream!;
    }

    // Add both tasks to the final workstream if not already there
    if (!finalWorkstream.tasks.includes(sourceId)) {
        await addTaskToWorkstream(finalWorkstream.uuid, sourceId);
    }
    if (!finalWorkstream.tasks.includes(targetId)) {
        await addTaskToWorkstream(finalWorkstream.uuid, targetId);
    }

    // Check if connection already exists
    const existingDep = finalWorkstream.dependencies.find(
        (dep) =>
            dep.fromTaskUuid === sourceId && dep.toTaskUuid === targetId,
    );

    if (!existingDep) {
        // Add dependency to the workstream
        await addDependency(
            finalWorkstream.uuid,
            sourceId,
            targetId,
            dependencyType,
        );
    }
}
