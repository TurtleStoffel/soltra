import { useState, useCallback } from "react";
import TaskGraphFlow from "./task-graph-flow";
import TaskDAGFlow from "./task-dag-flow";
import type { TreeNode } from "./tree-utils";
import type { Task } from "src/entities/tasks/types";

type VisualizationType = "tree" | "dag";

interface TaskVisualizationToggleProps {
    trees: TreeNode[];
    tasks: Task[];
    width: number;
    height: number;
    onReorder?: (parentId: string, newOrder: string[]) => void;
    onConnectionsChange?: (
        connections: { source: string; target: string }[],
    ) => void;
    onTaskCreated: () => void;
}

export default function TaskVisualizationToggle({
    trees,
    tasks,
    width,
    height,
    onReorder,
    onConnectionsChange,
    onTaskCreated,
}: TaskVisualizationToggleProps) {
    const [visualizationType, setVisualizationType] =
        useState<VisualizationType>(() => {
            const stored = localStorage.getItem("taskVisualizationType");
            return stored === "tree" || stored === "dag" ? stored : "tree";
        });

    const handleToggle = useCallback((type: VisualizationType) => {
        setVisualizationType(type);
        localStorage.setItem("taskVisualizationType", type);
    }, []);

    const handleConnectionsChange = useCallback(
        (connections: { source: string; target: string }[]) => {
            if (onConnectionsChange) {
                onConnectionsChange(connections);
            }
        },
        [onConnectionsChange],
    );

    return (
        <div className="flex flex-col">
            {/* Toggle Controls */}
            <div className="flex items-center justify-between mb-4 bg-slate-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-300">
                        View:
                    </span>
                    <div className="flex bg-slate-600 rounded-lg p-1">
                        <button
                            onClick={() => handleToggle("tree")}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                                visualizationType === "tree"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-gray-300 hover:text-white hover:bg-slate-500"
                            }`}
                        >
                            Tree View
                        </button>
                        <button
                            onClick={() => handleToggle("dag")}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ${
                                visualizationType === "dag"
                                    ? "bg-green-600 text-white shadow-sm"
                                    : "text-gray-300 hover:text-white hover:bg-slate-500"
                            }`}
                        >
                            DAG View
                        </button>
                    </div>
                </div>

                {/* View-specific info */}
                <div className="text-xs text-gray-400">
                    {visualizationType === "tree" ? (
                        <span>Hierarchical view with reordering</span>
                    ) : (
                        <span>Graph view with custom connections</span>
                    )}
                </div>
            </div>

            {/* Visualization Container */}
            <div className="relative">
                {visualizationType === "tree" ? (
                    <TaskGraphFlow
                        trees={trees}
                        width={width}
                        height={height}
                        onReorder={onReorder}
                    />
                ) : (
                    <TaskDAGFlow
                        tasks={tasks}
                        width={width}
                        height={height}
                        onConnectionsChange={handleConnectionsChange}
                        onTaskCreated={onTaskCreated}
                    />
                )}

                {/* View indicator badge */}
                <div className="absolute top-2 right-2 z-10">
                    <div
                        className={`px-2 py-1 rounded-md text-xs font-medium ${
                            visualizationType === "tree"
                                ? "bg-blue-600 text-white"
                                : "bg-green-600 text-white"
                        }`}
                    >
                        {visualizationType === "tree" ? "Tree" : "DAG"}
                    </div>
                </div>
            </div>

            {/* Help text */}
            <div className="mt-2 text-xs text-gray-500">
                {visualizationType === "tree" ? (
                    <div className="flex flex-wrap gap-4">
                        <span>• Drag nodes to reorder siblings</span>
                        <span>• Click nodes to navigate</span>
                        <span>• Right-click to set as root</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-4">
                        <span>
                            • Drag from node handles to create connections
                        </span>
                        <span>• Select and delete edges with Delete key</span>
                        <span>• Drag nodes to rearrange layout</span>
                    </div>
                )}
            </div>
        </div>
    );
}
