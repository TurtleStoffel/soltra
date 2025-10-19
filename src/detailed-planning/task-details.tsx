import { useEffect, useState } from "react";
import { updateTask } from "src/entities/tasks/task-service";
import { TaskExecution } from "./task-execution";
import type { Task } from "src/entities/tasks/types";
import {
    loadProducts,
    storeProducts,
} from "src/entities/products/product-file-storage";
import type { Product } from "src/entities/products/types";
import { TaskDoneButton } from "@/components/shared/task-done-button";

export function TaskDetails({
    task,
    onUpdate,
}: {
    task: Task;
    onUpdate: () => void;
}) {
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [linkedProduct, setLinkedProduct] = useState<Product | undefined>(
        undefined,
    );

    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.title);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState(
        task.description,
    );

    useEffect(() => {
        loadProducts().then((products) => {
            setAllProducts(products);
            const productContainingTask = products.find((p) =>
                p.tasks.includes(task.uuid),
            );
            setLinkedProduct(productContainingTask);
        });
        setEditedTitle(task.title);
        setEditedDescription(task.description);
    }, [task]);

    const handleStartEdit = () => {
        setIsEditing(true);
        setEditedTitle(task.title);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedTitle(task.title);
    };

    const handleSaveEdit = async () => {
        if (editedTitle.trim() && editedTitle !== task.title) {
            const updatedTask = { ...task, title: editedTitle.trim() };
            await updateTask(updatedTask);
            onUpdate();
        }
        setIsEditing(false);
    };

    const handleStartEditDescription = () => {
        setIsEditingDescription(true);
        setEditedDescription(task.description);
    };

    const handleCancelEditDescription = () => {
        setIsEditingDescription(false);
        setEditedDescription(task.description);
    };

    const handleSaveEditDescription = async () => {
        if (editedDescription !== task.description) {
            const updatedTask = { ...task, description: editedDescription };
            await updateTask(updatedTask);
            onUpdate();
        }
        setIsEditingDescription(false);
    };

    const handleSetProduct = async (productId: string) => {
        // Remove from current product if exists
        if (linkedProduct) {
            linkedProduct.tasks = linkedProduct.tasks.filter(
                (taskId) => taskId !== task.uuid,
            );
        }

        // Add to new product
        const product = allProducts.find((p) => p.uuid === productId);
        if (!product) return;

        if (!product.tasks.includes(task.uuid)) {
            product.tasks.push(task.uuid);
        }

        await storeProducts(allProducts);
        setLinkedProduct(product);
    };

    const handleRemoveFromProduct = async () => {
        if (!linkedProduct) return;

        linkedProduct.tasks = linkedProduct.tasks.filter(
            (taskId) => taskId !== task.uuid,
        );
        await storeProducts(allProducts);
        setLinkedProduct(undefined);
    };

    return (
        <div>
            <div className="mb-2 flex items-center gap-2">
                {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                        <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="input input-sm input-bordered font-mono flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit();
                                if (e.key === "Escape") handleCancelEdit();
                            }}
                        />
                        <button
                            className="btn btn-xs btn-primary"
                            onClick={handleSaveEdit}
                        >
                            Save
                        </button>
                        <button
                            className="btn btn-xs btn-outline"
                            onClick={handleCancelEdit}
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 w-full">
                        <span
                            className="font-mono cursor-pointer hover:border hover:border-gray-300 px-1 py-0.5 rounded flex-1"
                            onClick={handleStartEdit}
                            title="Click to rename task"
                        >
                            {task.title}
                        </span>
                        <TaskDoneButton task={task} />
                    </div>
                )}
            </div>
            <div className="mb-4">
                <div className="text-sm font-medium mb-1">Status:</div>
                <div className="text-sm text-gray-700 px-2 py-1 bg-gray-100 rounded border inline-block">
                    {task.status}
                </div>
            </div>
            <div className="mb-4">
                <div className="text-sm font-medium mb-1">Description:</div>
                {isEditingDescription ? (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={editedDescription}
                            onChange={(e) =>
                                setEditedDescription(e.target.value)
                            }
                            className="textarea textarea-bordered text-sm"
                            rows={3}
                            placeholder="Add a description for this task..."
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                className="btn btn-xs btn-primary"
                                onClick={handleSaveEditDescription}
                            >
                                Save
                            </button>
                            <button
                                className="btn btn-xs btn-outline"
                                onClick={handleCancelEditDescription}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="text-sm text-gray-600 cursor-pointer hover:border hover:border-gray-300 px-2 py-2 rounded min-h-[2.5rem] border border-transparent"
                        onClick={handleStartEditDescription}
                        title="Click to edit description"
                    >
                        {task.description || "Click to add description..."}
                    </div>
                )}
            </div>
            <div className="mb-4">
                <div className="text-sm font-medium mb-2">Product:</div>
                <div className="flex gap-2 items-center">
                    <select
                        className="select select-bordered select-sm"
                        onChange={(e) => {
                            if (e.target.value) {
                                handleSetProduct(e.target.value);
                            } else {
                                handleRemoveFromProduct();
                            }
                        }}
                        value={linkedProduct?.uuid || ""}
                    >
                        <option value="">None</option>
                        {allProducts.map((product) => (
                            <option key={product.uuid} value={product.uuid}>
                                {product.title}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <TaskExecution task={task} />
        </div>
    );
}
