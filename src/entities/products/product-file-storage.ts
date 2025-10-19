/**
 * Product File Storage Format
 *
 * Products are stored in a single JSON file with the following structure:
 *
 * {
 *   "products": {
 *     "<productId>": {
 *       "title": string,
 *       "description": string,  // Detailed description of the product
 *       "tasks": string[],       // Array of UUIDs of tasks associated with this product
 *       "parent": string         // UUID of the parent product (optional)
 *     },
 *     ...
 *   }
 * }
 *
 * Example:
 * {
 *   "products": {
 *     "a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
 *       "title": "Mobile App Redesign",
 *       "description": "Complete redesign of the mobile application with modern UI/UX",
 *       "tasks": [
 *         "8cd4a5d6-b7a7-4462-929e-ad599b0a5484",
 *         "42ac9c44-067f-4aed-8014-7fac3e0b890f"
 *       ],
 *       "parent": "parent-product-uuid",
 *       "workingDirectory": "/home/user/projects/mobile-app"
 *     },
 *     "b2c3d4e5-f6g7-8901-bcde-fg2345678901": {
 *       "title": "API Integration",
 *       "description": "Integration of third-party APIs for payment and analytics",
 *       "tasks": [],
 *       "workingDirectory": "/home/user/projects/api-integration"
 *     }
 *   }
 * }
 *
 * - Each product is stored under a unique ID as the key, with "title", "description", "tasks", "parent", and "workingDirectory" properties.
 * - "title" is a short name for the product.
 * - "description" is a detailed description of the product.
 * - "tasks" is an array of UUIDs of tasks associated with this product.
 * - "parent" is the UUID of the parent product (optional for root products).
 * - "workingDirectory" is a relative path to the working directory for this product (optional).
 * - The file may contain additional fields in the future, but these are the primary structures.
 */

import {
    readFile,
    writeFile,
    DataFileName,
} from "src/persistence/file-system-handles";
import type { Product } from "./types";

export async function loadProducts(): Promise<Product[]> {
    const text = await readFile(DataFileName.PRODUCT);
    if (!text) {
        return [];
    }
    const obj = JSON.parse(text);
    if (obj && obj.products) {
        return Object.entries(obj.products).map(([uuid, value]) => {
            const product = value as {
                title: string;
                description?: string;
                tasks: string[];
                parent?: string;
                workingDirectory?: string;
            };
            return {
                uuid,
                title: product.title,
                description: product.description || "",
                tasks: product.tasks || [],
                parent: product.parent,
                workingDirectory: product.workingDirectory,
            };
        });
    }
    throw new Error("Invalid product file format");
}

export async function addProduct(product: Product): Promise<void> {
    const products = await loadProducts();
    products.push(product);
    await storeProducts(products);
}

export async function storeProducts(products: Product[]): Promise<void> {
    // Serialize products with title, description, tasks, parent, and workingDirectory
    const productsObj = products.reduce(
        (acc, p) => {
            acc[p.uuid] = {
                title: p.title,
                description: p.description,
                tasks: p.tasks,
                ...(p.parent && { parent: p.parent }),
                ...(p.workingDirectory && {
                    workingDirectory: p.workingDirectory,
                }),
            };
            return acc;
        },
        {} as Record<
            string,
            {
                title: string;
                description: string;
                tasks: string[];
                parent?: string;
                workingDirectory?: string;
            }
        >,
    );
    await writeFile(
        DataFileName.PRODUCT,
        JSON.stringify({ products: productsObj }, null, 2),
    );
}

/**
 * Create a new product with the given title, description, and optional parent.
 * @param title - The title of the new product
 * @param description - The description of the new product (optional)
 * @param parent - The UUID of the parent product (optional)
 * @param workingDirectory - The relative path to the working directory (optional)
 * @returns The created product
 */
export async function createProduct(
    title: string,
    description: string = "",
    parent?: string,
    workingDirectory?: string,
): Promise<Product> {
    const newProduct: Product = {
        uuid: crypto.randomUUID(),
        title,
        description,
        tasks: [],
        parent,
        workingDirectory,
    };

    await addProduct(newProduct);
    return newProduct;
}

/**
 * Update an existing product
 * @param updatedProduct - The product with updated fields
 */
export async function updateProduct(updatedProduct: Product): Promise<void> {
    const products = await loadProducts();
    const index = products.findIndex((p) => p.uuid === updatedProduct.uuid);
    if (index === -1) {
        throw new Error(`Product with uuid ${updatedProduct.uuid} not found`);
    }
    products[index] = updatedProduct;
    await storeProducts(products);
}
