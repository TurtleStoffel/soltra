import { loadWorkstreams, storeWorkstreams } from "./workstream-file-storage";
import type { Workstream, WorkstreamDependency, DependencyType } from "./types";
import { loadTasks } from "src/entities/tasks/task-file-storage";

/**
 * Validate that all task references in workstreams exist.
 * @param workstreams - The workstreams to validate
 * @throws Error if any workstream references a non-existent task
 */
async function validateWorkstreamTaskReferences(workstreams: Workstream[]): Promise<void> {
    const tasks = await loadTasks();
    const taskUuids = new Set(tasks.map(t => t.uuid));

    for (const workstream of workstreams) {
        // Check tasks array
        for (const taskUuid of workstream.tasks) {
            if (!taskUuids.has(taskUuid)) {
                throw new Error(
                    `Workstream "${workstream.title}" (${workstream.uuid}) references non-existent task: ${taskUuid}`
                );
            }
        }

        // Check dependencies
        for (const dep of workstream.dependencies) {
            if (!taskUuids.has(dep.fromTaskUuid)) {
                throw new Error(
                    `Workstream "${workstream.title}" (${workstream.uuid}) has dependency with non-existent fromTask: ${dep.fromTaskUuid}`
                );
            }
            if (!taskUuids.has(dep.toTaskUuid)) {
                throw new Error(
                    `Workstream "${workstream.title}" (${workstream.uuid}) has dependency with non-existent toTask: ${dep.toTaskUuid}`
                );
            }
        }
    }
}

/**
 * Load workstreams and validate all task references.
 * @returns The loaded workstreams
 * @throws Error if any workstream references a non-existent task
 */
export async function loadAndValidateWorkstreams(): Promise<Workstream[]> {
    const workstreams = await loadWorkstreams();
    await validateWorkstreamTaskReferences(workstreams);
    return workstreams;
}

/**
 * Add a task to a workstream.
 * @param workstreamUuid - The UUID of the workstream
 * @param taskUuid - The UUID of the task to add
 */
export async function addTaskToWorkstream(
    workstreamUuid: string,
    taskUuid: string,
): Promise<void> {
    const workstreams = await loadAndValidateWorkstreams();
    const workstream = workstreams.find((w) => w.uuid === workstreamUuid);

    if (!workstream) {
        throw new Error(`Workstream with UUID ${workstreamUuid} not found`);
    }

    // Validate that task doesn't already belong to another workstream
    const existingWorkstream = workstreams.find(
        (w) => w.uuid !== workstreamUuid && w.tasks.includes(taskUuid)
    );
    if (existingWorkstream) {
        throw new Error(
            `Task ${taskUuid} already belongs to workstream ${existingWorkstream.uuid}`
        );
    }

    if (!workstream.tasks.includes(taskUuid)) {
        workstream.tasks.push(taskUuid);
        await storeWorkstreams(workstreams);
    }
}

/**
 * Remove a task from a workstream and clean up all related dependencies.
 * @param workstreamUuid - The UUID of the workstream
 * @param taskUuid - The UUID of the task to remove
 */
export async function removeTaskFromWorkstream(
    workstreamUuid: string,
    taskUuid: string,
): Promise<void> {
    const workstreams = await loadAndValidateWorkstreams();
    const workstream = workstreams.find((w) => w.uuid === workstreamUuid);

    if (!workstream) {
        throw new Error(`Workstream with UUID ${workstreamUuid} not found`);
    }

    // Remove task from tasks array
    workstream.tasks = workstream.tasks.filter((t) => t !== taskUuid);

    // Remove all dependencies involving this task
    workstream.dependencies = workstream.dependencies.filter(
        (dep) =>
            dep.fromTaskUuid !== taskUuid && dep.toTaskUuid !== taskUuid,
    );

    await storeWorkstreams(workstreams);
}

/**
 * Add a dependency between two tasks in a workstream.
 * @param workstreamUuid - The UUID of the workstream
 * @param fromTaskUuid - The task that must be completed first
 * @param toTaskUuid - The task that depends on fromTask
 * @param type - The type of dependency (blocks or related)
 */
export async function addDependency(
    workstreamUuid: string,
    fromTaskUuid: string,
    toTaskUuid: string,
    type: DependencyType = "blocks",
): Promise<void> {
    const workstreams = await loadAndValidateWorkstreams();
    const workstream = workstreams.find((w) => w.uuid === workstreamUuid);

    if (!workstream) {
        throw new Error(`Workstream with UUID ${workstreamUuid} not found`);
    }

    // Validate that both tasks exist in the workstream
    if (!workstream.tasks.includes(fromTaskUuid)) {
        throw new Error(
            `Task ${fromTaskUuid} is not part of workstream ${workstreamUuid}`,
        );
    }
    if (!workstream.tasks.includes(toTaskUuid)) {
        throw new Error(
            `Task ${toTaskUuid} is not part of workstream ${workstreamUuid}`,
        );
    }

    // Check if dependency already exists
    const existingDep = workstream.dependencies.find(
        (dep) =>
            dep.fromTaskUuid === fromTaskUuid &&
            dep.toTaskUuid === toTaskUuid,
    );

    if (!existingDep) {
        workstream.dependencies.push({
            fromTaskUuid,
            toTaskUuid,
            type,
        });
        await storeWorkstreams(workstreams);
    }
}

/**
 * Remove a dependency between two tasks in a workstream.
 * @param workstreamUuid - The UUID of the workstream
 * @param fromTaskUuid - The task that must be completed first
 * @param toTaskUuid - The task that depends on fromTask
 */
export async function removeDependency(
    workstreamUuid: string,
    fromTaskUuid: string,
    toTaskUuid: string,
): Promise<void> {
    const workstreams = await loadAndValidateWorkstreams();
    const workstream = workstreams.find((w) => w.uuid === workstreamUuid);

    if (!workstream) {
        throw new Error(`Workstream with UUID ${workstreamUuid} not found`);
    }

    workstream.dependencies = workstream.dependencies.filter(
        (dep) =>
            !(dep.fromTaskUuid === fromTaskUuid && dep.toTaskUuid === toTaskUuid),
    );

    await storeWorkstreams(workstreams);
}

/**
 * Get all tasks that directly depend on a given task (children in the DAG).
 * @param workstreamUuid - The UUID of the workstream
 * @param taskUuid - The UUID of the task
 * @returns Array of task UUIDs that depend on this task
 */
export async function getDependentTasks(
    workstreamUuid: string,
    taskUuid: string,
): Promise<string[]> {
    const workstreams = await loadAndValidateWorkstreams();
    const workstream = workstreams.find((w) => w.uuid === workstreamUuid);

    if (!workstream) {
        throw new Error(`Workstream with UUID ${workstreamUuid} not found`);
    }

    return workstream.dependencies
        .filter((dep) => dep.fromTaskUuid === taskUuid)
        .map((dep) => dep.toTaskUuid);
}

/**
 * Get all tasks that a given task depends on (parents in the DAG).
 * @param workstreamUuid - The UUID of the workstream
 * @param taskUuid - The UUID of the task
 * @returns Array of task UUIDs that this task depends on
 */
export async function getDependencyTasks(
    workstreamUuid: string,
    taskUuid: string,
): Promise<string[]> {
    const workstreams = await loadAndValidateWorkstreams();
    const workstream = workstreams.find((w) => w.uuid === workstreamUuid);

    if (!workstream) {
        throw new Error(`Workstream with UUID ${workstreamUuid} not found`);
    }

    return workstream.dependencies
        .filter((dep) => dep.toTaskUuid === taskUuid)
        .map((dep) => dep.fromTaskUuid);
}

/**
 * Check if adding a dependency would create a cycle in the DAG.
 * @param workstreamUuid - The UUID of the workstream
 * @param fromTaskUuid - The task that would be completed first
 * @param toTaskUuid - The task that would depend on fromTask
 * @returns true if adding this dependency would create a cycle
 */
export async function wouldCreateCycle(
    workstreamUuid: string,
    fromTaskUuid: string,
    toTaskUuid: string,
): Promise<boolean> {
    const workstreams = await loadAndValidateWorkstreams();
    const workstream = workstreams.find((w) => w.uuid === workstreamUuid);

    if (!workstream) {
        throw new Error(`Workstream with UUID ${workstreamUuid} not found`);
    }

    // Build adjacency list from dependencies
    const adjList = new Map<string, string[]>();
    for (const task of workstream.tasks) {
        adjList.set(task, []);
    }
    for (const dep of workstream.dependencies) {
        adjList.get(dep.fromTaskUuid)?.push(dep.toTaskUuid);
    }

    // Add the proposed dependency temporarily
    adjList.get(fromTaskUuid)?.push(toTaskUuid);

    // DFS to detect cycle starting from toTaskUuid
    // If we can reach fromTaskUuid from toTaskUuid, we have a cycle
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
        if (!visited.has(node)) {
            visited.add(node);
            recStack.add(node);

            const neighbors = adjList.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor) && hasCycle(neighbor)) {
                    return true;
                } else if (recStack.has(neighbor)) {
                    return true;
                }
            }
        }
        recStack.delete(node);
        return false;
    };

    // Check for cycles from any node
    for (const task of workstream.tasks) {
        if (hasCycle(task)) {
            return true;
        }
        visited.clear();
        recStack.clear();
    }

    return false;
}

/**
 * Get a topological sort of tasks in the workstream (respecting dependencies).
 * @param workstreamUuid - The UUID of the workstream
 * @returns Array of task UUIDs in topological order, or null if cycle exists
 */
export async function getTopologicalSort(
    workstreamUuid: string,
): Promise<string[] | null> {
    const workstreams = await loadAndValidateWorkstreams();
    const workstream = workstreams.find((w) => w.uuid === workstreamUuid);

    if (!workstream) {
        throw new Error(`Workstream with UUID ${workstreamUuid} not found`);
    }

    // Build adjacency list and in-degree map
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const task of workstream.tasks) {
        adjList.set(task, []);
        inDegree.set(task, 0);
    }

    for (const dep of workstream.dependencies) {
        adjList.get(dep.fromTaskUuid)?.push(dep.toTaskUuid);
        inDegree.set(dep.toTaskUuid, (inDegree.get(dep.toTaskUuid) || 0) + 1);
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const result: string[] = [];

    // Add all tasks with in-degree 0 to queue
    for (const [task, degree] of inDegree.entries()) {
        if (degree === 0) {
            queue.push(task);
        }
    }

    while (queue.length > 0) {
        const task = queue.shift()!;
        result.push(task);

        const neighbors = adjList.get(task) || [];
        for (const neighbor of neighbors) {
            const newDegree = (inDegree.get(neighbor) || 0) - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }

    // If result doesn't contain all tasks, there's a cycle
    if (result.length !== workstream.tasks.length) {
        return null;
    }

    return result;
}

/**
 * Update a workstream.
 * @param workstream - The workstream to update
 */
export async function updateWorkstream(workstream: Workstream): Promise<void> {
    const workstreams = await loadAndValidateWorkstreams();
    const index = workstreams.findIndex((w) => w.uuid === workstream.uuid);

    if (index !== -1) {
        workstreams[index] = workstream;
        await storeWorkstreams(workstreams);
    } else {
        throw new Error(
            `Workstream with UUID ${workstream.uuid} not found for update.`,
        );
    }
}

/**
 * Remove a workstream.
 * @param workstreamUuid - The UUID of the workstream to remove
 */
export async function removeWorkstream(
    workstreamUuid: string,
): Promise<void> {
    const workstreams = await loadAndValidateWorkstreams();
    const newWorkstreams = workstreams.filter(
        (w) => w.uuid !== workstreamUuid,
    );
    await storeWorkstreams(newWorkstreams);
}
