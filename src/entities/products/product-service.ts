import type { Product } from "./types";
import { loadProducts } from "./product-file-storage";

/**
 * Fetch the Product that a given task is associated with.
 * @param taskUuid - The UUID of the task
 * @returns The Product containing the task, or null if not found
 */
export async function getProductByTaskUuid(
    taskUuid: string,
): Promise<Product | null> {
    const products = await loadProducts();

    for (const product of products) {
        if (product.tasks.includes(taskUuid)) {
            return product;
        }
    }

    return null;
}

/**
 * Get the product hierarchy for a task.
 * @param taskUuid - The UUID of the task
 * @returns Array of products from root to the product containing the task
 */
export async function getProductHierarchyForTask(
    taskUuid: string,
): Promise<Product[]> {
    const products = await loadProducts();
    const productMap = new Map<string, Product>();

    for (const product of products) {
        productMap.set(product.uuid, product);
    }

    // Find the product that contains this task
    const taskProduct = products.find((p) => p.tasks.includes(taskUuid));
    if (!taskProduct) {
        return [];
    }

    const hierarchy: Product[] = [];
    let currentProduct: Product | null = taskProduct;

    while (currentProduct) {
        hierarchy.unshift(currentProduct);
        currentProduct = currentProduct.parent
            ? productMap.get(currentProduct.parent)!
            : null;
    }

    return hierarchy;
}
