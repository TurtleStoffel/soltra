/**
 * Global Order Storage
 *
 * This module manages the global ordering of both tasks and workstreams in the DAG view.
 * Instead of always showing workstreams first and then tasks, this allows a mixed ordering
 * where tasks and workstreams can be interleaved based on their Y position in the DAG.
 *
 * Storage Format:
 * {
 *   "order": [
 *     { "type": "workstream", "uuid": "workstream-uuid-1" },
 *     { "type": "task", "uuid": "task-uuid-1" },
 *     { "type": "task", "uuid": "task-uuid-2" },
 *     { "type": "workstream", "uuid": "workstream-uuid-2" },
 *     ...
 *   ]
 * }
 */

import {
    readFile,
    writeFile,
    DataFileName,
} from "src/persistence/file-system-handles";

export type OrderItemType = "task" | "workstream";

export interface OrderItem {
    type: OrderItemType;
    uuid: string;
}

/**
 * Load the global order from storage.
 * Returns null if the file doesn't exist (first time).
 * Throws an error if the file exists but is invalid/corrupted.
 * Does NOT automatically initialize or sync - use the service layer for that.
 */
export async function loadGlobalOrder(): Promise<OrderItem[] | null> {
    const text = await readFile(DataFileName.GLOBAL_ORDER);
    if (!text) {
        // File doesn't exist - this is expected on first load
        return null;
    }

    const obj = JSON.parse(text);

    if (obj && obj.order && Array.isArray(obj.order)) {
        return obj.order.map((item: any) => ({
            type: item.type,
            uuid: item.uuid,
        }));
    }

    // File exists but has invalid format
    throw new Error("Invalid global order file format");
}

/**
 * Store the global order to disk.
 */
export async function storeGlobalOrder(order: OrderItem[]): Promise<void> {
    await writeFile(
        DataFileName.GLOBAL_ORDER,
        JSON.stringify({ order }, null, 2),
    );
}

/**
 * Initialize global order from existing tasks and workstreams.
 * This is used when there's no saved order yet (first time setup).
 *
 * By default, workstreams come first, then tasks (matching old behavior).
 */
export function initializeGlobalOrder(
    workstreamUuids: string[],
    taskUuids: string[],
): OrderItem[] {
    const order: OrderItem[] = [];

    // Add all workstreams first
    workstreamUuids.forEach((uuid) => {
        order.push({ type: "workstream", uuid });
    });

    // Add all tasks
    taskUuids.forEach((uuid) => {
        order.push({ type: "task", uuid });
    });

    return order;
}

/**
 * Sync global order with current tasks and workstreams.
 * This ensures that:
 * - New items are added to the order
 * - Deleted items are removed from the order
 * - Existing items maintain their relative positions
 */
export function syncGlobalOrder(
    currentOrder: OrderItem[],
    workstreamUuids: string[],
    taskUuids: string[],
): OrderItem[] {
    const workstreamSet = new Set(workstreamUuids);
    const taskSet = new Set(taskUuids);
    const orderSet = new Set(currentOrder.map(item => `${item.type}:${item.uuid}`));

    // Remove items that no longer exist
    const filteredOrder = currentOrder.filter((item) => {
        if (item.type === "workstream") {
            return workstreamSet.has(item.uuid);
        } else {
            return taskSet.has(item.uuid);
        }
    });

    // Add new workstreams that aren't in the order yet
    workstreamUuids.forEach((uuid) => {
        if (!orderSet.has(`workstream:${uuid}`)) {
            filteredOrder.push({ type: "workstream", uuid });
        }
    });

    // Add new tasks that aren't in the order yet
    taskUuids.forEach((uuid) => {
        if (!orderSet.has(`task:${uuid}`)) {
            filteredOrder.push({ type: "task", uuid });
        }
    });

    return filteredOrder;
}
