import React, { useState, useCallback } from "react";
import type { Node } from "@xyflow/react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Task } from "src/entities/tasks/types";

export interface TaskSearchBarProps {
    tasks: Task[];
    nodes: Node[];
    reactFlowInstance: ReactFlowInstance | null;
    onHighlightChange: (nodeId: string | null) => void;
}

export function TaskSearchBar({
    tasks,
    nodes,
    reactFlowInstance,
    onHighlightChange,
}: TaskSearchBarProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);

        if (!query.trim() || !reactFlowInstance) {
            onHighlightChange(null);
            return;
        }

        // Find matching task nodes (case-insensitive)
        const taskNodes = nodes.filter(node => node.type === 'taskNode');
        const matchingNode = taskNodes.find(node => {
            const task = tasks.find(t => t.uuid === node.id);
            return task?.title.toLowerCase().includes(query.toLowerCase());
        });

        if (matchingNode) {
            onHighlightChange(matchingNode.id);

            // Navigate to the node with smooth animation
            reactFlowInstance.setCenter(
                matchingNode.position.x + 100, // offset by half node width
                matchingNode.position.y + 50,  // offset by half node height
                { zoom: 1.5, duration: 800 }
            );
        } else {
            onHighlightChange(null);
        }
    }, [nodes, tasks, reactFlowInstance, onHighlightChange]);

    return (
        <div className="absolute top-2 right-2 z-10">
            <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-md text-sm focus:outline-none focus:border-blue-400 w-64"
            />
        </div>
    );
}
