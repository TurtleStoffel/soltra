import type { Task, TaskStatus } from "src/entities/tasks/types";
import type { Product } from "src/entities/products/types";

export interface TreeNode {
    name: string;
    id: string;
    status?: TaskStatus;
    children?: TreeNode[];
    isProduct?: boolean;
}

/**
 * Converts flat task and product arrays to a visx-compatible tree structure.
 * Products form the primary hierarchy, with tasks appearing under products.
 * Tasks not assigned to products appear as standalone nodes.
 * Each task appears only once, with product placement taking precedence.
 */
export function buildTreeFromGraph(
    tasks: Task[],
    products: Product[],
): TreeNode[] {
    if (!tasks.length && !products.length) return [];

    const taskMap = new Map<string, Task>();
    tasks.forEach((t) => taskMap.set(t.uuid, t));

    const productMap = new Map<string, Product>();
    products.forEach((p) => productMap.set(p.uuid, p));

    // Track which tasks are assigned to products
    const tasksInProducts = new Set<string>();
    products.forEach((product) => {
        product.tasks.forEach((taskId) => tasksInProducts.add(taskId));
    });

    // Find root products (no parent)
    const rootProducts = products.filter((p) => !p.parent);

    // Find standalone tasks (not in any product)
    const standaloneTasks = tasks.filter(
        (task) => !tasksInProducts.has(task.uuid),
    );

    // Build product subtree
    function buildProductSubtree(
        product: Product,
        visited: Set<string>,
    ): TreeNode {
        if (visited.has(product.uuid)) {
            return { name: product.title, id: product.uuid, isProduct: true };
        }
        visited.add(product.uuid);

        const children: TreeNode[] = [];

        // Add child products
        const childProducts = products.filter((p) => p.parent === product.uuid);
        childProducts.forEach((childProduct) => {
            children.push(buildProductSubtree(childProduct, visited));
        });

        // Add tasks assigned to this product
        product.tasks.forEach((taskId) => {
            if (taskMap.has(taskId)) {
                children.push(buildTaskNode(taskMap.get(taskId)!, visited));
            }
        });

        return children.length > 0
            ? {
                  name: product.title,
                  id: product.uuid,
                  isProduct: true,
                  children,
              }
            : { name: product.title, id: product.uuid, isProduct: true };
    }

    // Build task node (for tasks under products)
    function buildTaskNode(task: Task, visited: Set<string>): TreeNode {
        if (visited.has(task.uuid)) {
            return { name: task.title, id: task.uuid, status: task.status };
        }
        visited.add(task.uuid);

        return { name: task.title, id: task.uuid, status: task.status };
    }

    const visited = new Set<string>();
    const trees: TreeNode[] = [];

    // Add product trees
    rootProducts.forEach((product) => {
        trees.push(buildProductSubtree(product, visited));
    });

    // Add standalone tasks (tasks not in any product)
    standaloneTasks.forEach((task) => {
        trees.push(buildTaskNode(task, visited));
    });

    return trees;
}
