/**
 * Workstream File Storage Format
 *
 * Workstreams are stored in a single JSON file with the following structure:
 *
 * {
 *   "workstreams": [
 *     {
 *       "uuid": string,
 *       "title": string,
 *       "description": string,
 *       "tasks": string[],           // Array of UUIDs of tasks in this workstream
 *       "dependencies": [
 *         {
 *           "fromTaskUuid": string,  // Task that must be completed first
 *           "toTaskUuid": string,    // Task that depends on fromTask
 *           "type": "blocks" | "related"
 *         }
 *       ]
 *     },
 *     ...
 *   ]
 * }
 *
 * Note: The order of workstreams in the array determines their display order in the DAG view.
 *
 * Example:
 * {
 *   "workstreams": {
 *     "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
 *       "title": "Q1 Sprint",
 *       "description": "Tasks for Q1 sprint with all dependencies",
 *       "tasks": [
 *         "8cd4a5d6-b7a7-4462-929e-ad599b0a5484",
 *         "42ac9c44-067f-4aed-8014-7fac3e0b890f"
 *       ],
 *       "dependencies": [
 *         {
 *           "fromTaskUuid": "8cd4a5d6-b7a7-4462-929e-ad599b0a5484",
 *           "toTaskUuid": "42ac9c44-067f-4aed-8014-7fac3e0b890f",
 *           "type": "blocks"
 *         }
 *       ]
 *     }
 *   }
 * }
 *
 * - Each workstream is stored under a unique ID as the key
 * - "tasks" contains all task UUIDs that are part of this workstream
 * - "dependencies" represents the DAG structure showing how tasks relate to each other
 * - Dependencies are stored at the workstream level, creating a clear DAG representation
 */

import {
    readFile,
    writeFile,
    DataFileName,
} from "src/persistence/file-system-handles";
import type { Workstream, WorkstreamDependency } from "./types";
import { triggerWorkstreamCreateCallbacks } from "./workstream-hooks";

export async function loadWorkstreams(): Promise<Workstream[]> {
    const text = await readFile(DataFileName.WORKSTREAM);
    if (!text) {
        return [];
    }
    const obj = JSON.parse(text);

    // Support both array format (new) and object format (legacy)
    if (obj && obj.workstreams) {
        if (Array.isArray(obj.workstreams)) {
            // New array format - order is preserved by array order
            return obj.workstreams.map((ws: any) => ({
                uuid: ws.uuid,
                title: ws.title,
                description: ws.description || "",
                tasks: ws.tasks || [],
                dependencies: ws.dependencies || [],
            }));
        } else {
            // Legacy object format - convert to array
            return Object.entries(obj.workstreams).map(([uuid, value]) => {
                const workstream = value as {
                    title: string;
                    description?: string;
                    tasks: string[];
                    dependencies: WorkstreamDependency[];
                };
                return {
                    uuid,
                    title: workstream.title,
                    description: workstream.description || "",
                    tasks: workstream.tasks || [],
                    dependencies: workstream.dependencies || [],
                };
            });
        }
    }
    throw new Error("Invalid workstream file format");
}

export async function addWorkstream(workstream: Workstream): Promise<void> {
    const workstreams = await loadWorkstreams();
    workstreams.push(workstream);
    await storeWorkstreams(workstreams);
}

export async function storeWorkstreams(
    workstreams: Workstream[],
): Promise<void> {
    // Store as array to preserve order
    const workstreamsArray = workstreams.map(w => ({
        uuid: w.uuid,
        title: w.title,
        description: w.description,
        tasks: w.tasks,
        dependencies: w.dependencies,
    }));

    await writeFile(
        DataFileName.WORKSTREAM,
        JSON.stringify({ workstreams: workstreamsArray }, null, 2),
    );
}

/**
 * Create a new workstream with the given title and description.
 * @param title - The title of the new workstream
 * @param description - The description of the new workstream (optional)
 * @returns The created workstream
 */
export async function createWorkstream(
    title: string,
    description: string = "",
): Promise<Workstream> {
    const newWorkstream: Workstream = {
        uuid: crypto.randomUUID(),
        title,
        description,
        tasks: [],
        dependencies: [],
    };

    await addWorkstream(newWorkstream);
    await triggerWorkstreamCreateCallbacks(newWorkstream);
    return newWorkstream;
}
