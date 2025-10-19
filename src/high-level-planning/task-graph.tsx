import { useEffect, useState, useCallback, useRef } from "react";
import TaskVisualizationToggle from "./task-visualization-toggle";
import { buildTreeFromGraph } from "./tree-utils";
import { loadTasks } from "src/entities/tasks/task-file-storage";
import { updateTask } from "src/entities/tasks/task-service";
import type { Task } from "src/entities/tasks/types";
import { loadProducts } from "src/entities/products/product-file-storage";
import type { Product } from "src/entities/products/types";

export function TaskGraph() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [graphWidth, setGraphWidth] = useState(600);
    const [graphHeight, setGraphHeight] = useState(400);

    useEffect(() => {
        Promise.all([loadTasks(), loadProducts()])
            .then(([loadedTasks, loadedProducts]) => {
                setTasks(loadedTasks);
                setProducts(loadedProducts);
            })
            .catch((err) => {
                console.warn("Could not load data:", err.message);
                setTasks([]);
                setProducts([]);
            });
    }, []);

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setGraphWidth(rect.width || 600);
                // Calculate height: full container height minus header and padding
                const headerHeight = 200; // approximate height for header + padding
                setGraphHeight(Math.max(400, rect.height - headerHeight));
            }
        };

        updateSize();

        // Add resize observer for responsive updates
        const resizeObserver = new ResizeObserver(updateSize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    const refreshTasks = useCallback(() => {
        Promise.all([loadTasks(), loadProducts()])
            .then(([loadedTasks, loadedProducts]) => {
                setTasks(loadedTasks);
                setProducts(loadedProducts);
            })
            .catch((err) => {
                console.warn("Could not load data:", err.message);
                setTasks([]);
                setProducts([]);
            });
    }, []);

    const handleReorder = async (parentId: string, newOrder: string[]) => {
        // Skip if trying to reorder root level
        if (parentId === "root") return;

        const parentTask = tasks.find((t) => t.uuid === parentId);
        if (!parentTask) return;

        // Update the children order
        const updatedParent = { ...parentTask, children: newOrder };
        await updateTask(updatedParent);
        refreshTasks();
    };

    const handleConnectionsChange = async (
        connections: { source: string; target: string }[],
    ) => {
        console.log("DAG connections changed:", connections);
        // TODO: Implement persistence of DAG connections
        // This would require extending the Task model to support arbitrary connections
        // For now, just log the connections for proof of concept
    };

    const treesData = buildTreeFromGraph(tasks, products);

    return (
        <div ref={containerRef} className="flex flex-col h-screen p-4 gap-4">
            <div className="mb-2">
                {tasks.length > 0 ? (
                    <TaskVisualizationToggle
                        trees={treesData}
                        tasks={tasks}
                        width={graphWidth}
                        height={graphHeight}
                        onReorder={handleReorder}
                        onConnectionsChange={handleConnectionsChange}
                        onTaskCreated={refreshTasks}
                    />
                ) : (
                    <div
                        className="bg-slate-800 rounded-lg p-8 text-center text-gray-400"
                        style={{ width: graphWidth, height: graphHeight }}
                    >
                        <div className="flex flex-col items-center justify-center h-full">
                            <p className="mb-2">No tasks loaded</p>
                            <p className="text-sm">
                                Configure a task file in Settings to get started
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
