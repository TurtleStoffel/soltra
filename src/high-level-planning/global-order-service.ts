/**
 * Global Order Service
 *
 * This module provides business logic for managing the global order,
 * including initialization and synchronization with current tasks/workstreams.
 */

import { loadGlobalOrder, storeGlobalOrder, initializeGlobalOrder, syncGlobalOrder, type OrderItem } from "./global-order-storage";

/**
 * Get the global order, initializing if necessary.
 * This is the main function to use when you need the global order.
 *
 * @param workstreamUuids - Array of current workstream UUIDs
 * @param taskUuids - Array of current task UUIDs
 * @returns The global order (initialized and synced if needed)
 */
export async function getGlobalOrder(
    workstreamUuids: string[],
    taskUuids: string[],
): Promise<OrderItem[]> {
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
