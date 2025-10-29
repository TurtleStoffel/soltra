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
 * If the file doesn't exist or is empty, initializes it with the provided tasks and workstreams.
 *
 * @param workstreamUuids - Array of workstream UUIDs (required for initialization)
 * @param taskUuids - Array of task UUIDs (required for initialization)
 * @returns The loaded or initialized global order
 */
export async function loadGlobalOrder(
    workstreamUuids: string[],
    taskUuids: string[],
): Promise<OrderItem[]> {
    try {
        const text = await readFile(DataFileName.GLOBAL_ORDER);
        if (!text) {
            // No file exists - initialize with default order
            const order = initializeGlobalOrder(workstreamUuids, taskUuids);
            await storeGlobalOrder(order);
            return order;
        }
        const obj = JSON.parse(text);

        if (obj && obj.order && Array.isArray(obj.order)) {
            const loadedOrder = obj.order.map((item: any) => ({
                type: item.type,
                uuid: item.uuid,
            }));

            // Sync with current data (add new items, remove deleted ones)
            const syncedOrder = syncGlobalOrder(loadedOrder, workstreamUuids, taskUuids);

            // Store the synced order back if it changed
            if (JSON.stringify(loadedOrder) !== JSON.stringify(syncedOrder)) {
                await storeGlobalOrder(syncedOrder);
            }

            return syncedOrder;
        }

        // Invalid format - initialize with default order
        const order = initializeGlobalOrder(workstreamUuids, taskUuids);
        await storeGlobalOrder(order);
        return order;
    } catch (error) {
        // File doesn't exist yet or is invalid - initialize with default order
        console.warn("Failed to load global order, initializing with default order:", error);
        const order = initializeGlobalOrder(workstreamUuids, taskUuids);
        await storeGlobalOrder(order);
        return order;
    }
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
