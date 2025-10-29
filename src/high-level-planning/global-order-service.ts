/**
 * Global Order Service
 *
 * This module provides business logic for managing the global order,
 * including initialization and synchronization with current tasks/workstreams.
 */

import { loadGlobalOrder, storeGlobalOrder, initializeGlobalOrder, syncGlobalOrder, type OrderItem } from "./global-order-storage";
import { loadTasks } from "src/entities/tasks/task-file-storage";
import { loadWorkstreams } from "src/entities/workstreams/workstream-file-storage";

/**
 * Get the global order, initializing if necessary.
 * This is the main function to use when you need the global order.
 * Automatically loads current tasks and workstreams to ensure sync.
 *
 * @returns The global order (initialized and synced if needed)
 */
export async function getGlobalOrder(): Promise<OrderItem[]> {
    // Load current tasks and workstreams
    const tasks = await loadTasks();
    const workstreams = await loadWorkstreams();

    const workstreamUuids = workstreams.map(ws => ws.uuid);
    const taskUuids = tasks.map(t => t.uuid);

    let order = await loadGlobalOrder();

    if (order === null) {
        // No order exists - initialize with default order
        order = initializeGlobalOrder(workstreamUuids, taskUuids);
        await storeGlobalOrder(order);
        return order;
    }

    // Sync with current data (add new items, remove deleted ones)
    const syncedOrder = syncGlobalOrder(order, workstreamUuids, taskUuids);

    // Store the synced order back if it changed
    if (JSON.stringify(order) !== JSON.stringify(syncedOrder)) {
        await storeGlobalOrder(syncedOrder);
    }

    return syncedOrder;
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
