export interface Product {
    uuid: string;
    title: string;
    description: string;
    tasks: string[]; // Array of UUIDs of tasks associated with this product
    parent?: string; // UUID of the parent product (optional for root products)
    workingDirectory?: string; // Relative path to the working directory for this product
}
