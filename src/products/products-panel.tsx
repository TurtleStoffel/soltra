import { useState, useEffect } from "react";
import {
    loadProducts,
    createProduct,
    storeProducts,
    updateProduct,
} from "src/entities/products/product-file-storage";
import type { Product } from "src/entities/products/types";
import {
    getDirectoryHandle,
    DirectoryHandleType,
} from "src/persistence/file-system-handles";

export function ProductsPanel() {
    const [products, setProducts] = useState<Product[]>([]);
    const [titleInput, setTitleInput] = useState("");
    const [descriptionInput, setDescriptionInput] = useState("");
    const [selectedParent, setSelectedParent] = useState<string>("");
    const [selectedWorkingDirectory, setSelectedWorkingDirectory] =
        useState<string>("");
    const [codingDirectories, setCodingDirectories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load products and coding directories on mount
    useEffect(() => {
        loadProductsFromStorage();
        loadCodingDirectories();
    }, []);

    const loadProductsFromStorage = async () => {
        try {
            setLoading(true);
            setError(null);
            const loadedProducts = await loadProducts();
            setProducts(loadedProducts);
        } catch (err) {
            console.error("Failed to load products:", err);
            setError("Failed to load products. Please check file permissions.");
        } finally {
            setLoading(false);
        }
    };

    const loadCodingDirectories = async () => {
        try {
            const codingDirHandle = await getDirectoryHandle(
                DirectoryHandleType.CODING_DIR,
            );
            if (!codingDirHandle) {
                return;
            }

            const directories: string[] = [];
            for await (const entry of codingDirHandle.values()) {
                if (entry.kind === "directory") {
                    directories.push(entry.name);
                }
            }
            setCodingDirectories(directories.sort());
        } catch (err) {
            console.error("Failed to load coding directories:", err);
            // Don't set error state here as this is not critical
        }
    };

    const handleAddProduct = async () => {
        if (!titleInput.trim()) {
            setError("Product title is required");
            return;
        }

        try {
            setError(null);
            const newProduct = await createProduct(
                titleInput.trim(),
                descriptionInput.trim(),
                selectedParent || undefined,
                selectedWorkingDirectory || undefined,
            );
            setProducts([...products, newProduct]);
            setTitleInput("");
            setDescriptionInput("");
            setSelectedParent("");
            setSelectedWorkingDirectory("");
        } catch (err) {
            console.error("Failed to add product:", err);
            setError("Failed to add product. Please try again.");
        }
    };

    const handleRemoveProduct = async (productId: string) => {
        try {
            setError(null);
            const updatedProducts = products.filter(
                (p) => p.uuid !== productId,
            );
            await storeProducts(updatedProducts);
            setProducts(updatedProducts);
        } catch (err) {
            console.error("Failed to remove product:", err);
            setError("Failed to remove product. Please try again.");
        }
    };

    const handleUpdateWorkingDirectory = async (
        productId: string,
        newWorkingDirectory: string,
    ) => {
        try {
            setError(null);
            const product = products.find((p) => p.uuid === productId);
            if (!product) {
                throw new Error("Product not found");
            }
            const updatedProduct = {
                ...product,
                workingDirectory: newWorkingDirectory || undefined,
            };
            await updateProduct(updatedProduct);
            setProducts(
                products.map((p) =>
                    p.uuid === productId ? updatedProduct : p,
                ),
            );
        } catch (err) {
            console.error("Failed to update working directory:", err);
            setError("Failed to update working directory. Please try again.");
        }
    };

    // Helper function to get children of a product
    const getChildren = (parentId: string): Product[] => {
        return products.filter((p) => p.parent === parentId);
    };

    // Helper function to get root products (products without a parent)
    const getRootProducts = (): Product[] => {
        return products.filter((p) => !p.parent);
    };

    // Recursive component to render product tree
    const renderProductTree = (product: Product, depth: number = 0) => {
        const children = getChildren(product.uuid);
        const indent = depth * 24; // 24px indent per level

        return (
            <div key={product.uuid}>
                <div
                    className="card bg-base-200 shadow-sm"
                    style={{ marginLeft: `${indent}px` }}
                >
                    <div className="card-body p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h3 className="font-bold text-lg">
                                    {product.title}
                                </h3>
                                {product.description && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        {product.description}
                                    </p>
                                )}
                                <div className="mt-2">
                                    <label className="text-xs text-gray-500 block mb-1">
                                        Working Directory
                                    </label>
                                    <select
                                        className="select select-bordered select-sm w-full max-w-xs"
                                        value={product.workingDirectory || ""}
                                        onChange={(e) =>
                                            handleUpdateWorkingDirectory(
                                                product.uuid,
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">None</option>
                                        {codingDirectories.map((dir) => (
                                            <option key={dir} value={dir}>
                                                {dir}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                    {product.tasks.length} task
                                    {product.tasks.length !== 1 ? "s" : ""}
                                    {children.length > 0 &&
                                        ` • ${children.length} sub-product${children.length !== 1 ? "s" : ""}`}
                                </div>
                            </div>
                            <button
                                className="btn btn-error btn-sm ml-4"
                                onClick={() =>
                                    handleRemoveProduct(product.uuid)
                                }
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
                {children.map((child) => renderProductTree(child, depth + 1))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex justify-center items-center py-12">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <h2 className="text-3xl font-bold mb-6">Products</h2>

            {/* Error Message */}
            {error && (
                <div className="alert alert-error mb-6">
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add Product Section - Left Side */}
                <div className="lg:col-span-1">
                    <div className="card bg-base-100 shadow-xl sticky top-6">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">
                                Add New Product
                            </h3>

                            <div className="form-control w-full">
                                <label className="label flex-col items-start">
                                    <span className="label-text font-semibold mb-1">
                                        Title *
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter product title..."
                                    className="input input-bordered w-full"
                                    value={titleInput}
                                    onChange={(e) =>
                                        setTitleInput(e.target.value)
                                    }
                                    onKeyPress={(e) =>
                                        e.key === "Enter" &&
                                        !e.shiftKey &&
                                        handleAddProduct()
                                    }
                                />
                            </div>

                            <div className="form-control w-full">
                                <label className="label flex-col items-start">
                                    <span className="label-text font-semibold mb-1">
                                        Description
                                    </span>
                                </label>
                                <textarea
                                    placeholder="Enter product description..."
                                    className="textarea textarea-bordered w-full"
                                    rows={3}
                                    value={descriptionInput}
                                    onChange={(e) =>
                                        setDescriptionInput(e.target.value)
                                    }
                                />
                            </div>

                            <div className="form-control w-full">
                                <label className="label flex-col items-start">
                                    <span className="label-text font-semibold mb-1">
                                        Parent Product
                                    </span>
                                </label>
                                <select
                                    className="select select-bordered w-full"
                                    value={selectedParent}
                                    onChange={(e) =>
                                        setSelectedParent(e.target.value)
                                    }
                                >
                                    <option value="">
                                        None (Root Product)
                                    </option>
                                    {products.map((product) => (
                                        <option
                                            key={product.uuid}
                                            value={product.uuid}
                                        >
                                            {product.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-control w-full">
                                <label className="label flex-col items-start">
                                    <span className="label-text font-semibold mb-1">
                                        Working Directory
                                    </span>
                                </label>
                                <select
                                    className="select select-bordered w-full"
                                    value={selectedWorkingDirectory}
                                    onChange={(e) =>
                                        setSelectedWorkingDirectory(
                                            e.target.value,
                                        )
                                    }
                                >
                                    <option value="">None</option>
                                    {codingDirectories.map((dir) => (
                                        <option key={dir} value={dir}>
                                            {dir}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                className="btn btn-primary mt-4"
                                onClick={handleAddProduct}
                            >
                                Add Product
                            </button>
                        </div>
                    </div>
                </div>

                {/* Products List - Right Side */}
                <div className="lg:col-span-2">
                    <div className="card bg-base-100 shadow-xl">
                        <div className="card-body">
                            <h3 className="card-title text-xl mb-4">
                                Your Products
                            </h3>
                            <div className="space-y-3">
                                {products.length === 0 ? (
                                    <div className="text-center text-gray-500 py-12">
                                        No products yet. Add a product to get
                                        started.
                                    </div>
                                ) : (
                                    getRootProducts().map((product) =>
                                        renderProductTree(product),
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
