/**
 * Global Order Service
 *
 * This module provides business logic for managing the global order,
 * including initialization and synchronization with current tasks/workstreams.
 */

import { loadGlobalOrder, storeGlobalOrder, initializeGlobalOrder, type OrderItem } from "./global-order-storage";
import { loadTasks } from "src/entities/tasks/task-file-storage";
import { loadWorkstreams } from "src/entities/workstreams/workstream-file-storage";

/**
 * Get the global order, initializing if necessary.
 * This is the main function to use when you need the global order.
 *
 * Note: Does not sync - assumes hooks keep the order up to date.
 * Use addToGlobalOrder/removeFromGlobalOrder for updates.
 *
 * @returns The global order (initialized if needed)
 */
export async function getGlobalOrder(): Promise<OrderItem[]> {
    let order = await loadGlobalOrder();

    if (order === null) {
        // No order exists - initialize with current tasks and workstreams
        const tasks = await loadTasks();
        const workstreams = await loadWorkstreams();

        const workstreamUuids = workstreams.map(ws => ws.uuid);
        const taskUuids = tasks.map(t => t.uuid);

        order = initializeGlobalOrder(workstreamUuids, taskUuids);
        await storeGlobalOrder(order);
    }

    return order;
}

/**
 * Update the global order and persist to storage.
 * This should be called after manual reordering (e.g., drag and drop).
 *
 * @param order - The new order to save
 */
export async function updateGlobalOrder(order: OrderItem[]): Promise<void> {
    await storeGlobalOrder(order);
}

/**
 * Add a new item to the global order.
 * The item is added at the end of the order by default.
 *
 * @param type - The type of item to add ("task" or "workstream")
 * @param uuid - The UUID of the item to add
 */
export async function addToGlobalOrder(type: "task" | "workstream", uuid: string): Promise<void> {
    let order = await loadGlobalOrder();

    // If no order exists, initialize with just this item
    if (order === null) {
        order = [{ type, uuid }];
        await storeGlobalOrder(order);
        return;
    }

    // Check if item already exists
    const exists = order.some(item => item.type === type && item.uuid === uuid);
    if (exists) {
        // Item already in order, nothing to do
        return;
    }

    // Add to the end
    order.push({ type, uuid });
    await storeGlobalOrder(order);
}

/**
 * Remove an item from the global order.
 *
 * @param type - The type of item to remove ("task" or "workstream")
 * @param uuid - The UUID of the item to remove
 */
export async function removeFromGlobalOrder(type: "task" | "workstream", uuid: string): Promise<void> {
    const order = await loadGlobalOrder();

    if (order === null) {
        // No order exists, nothing to remove
        return;
    }

    // Filter out the item
    const newOrder = order.filter(item => !(item.type === type && item.uuid === uuid));

    // Only save if something changed
    if (newOrder.length !== order.length) {
        await storeGlobalOrder(newOrder);
    }
}
