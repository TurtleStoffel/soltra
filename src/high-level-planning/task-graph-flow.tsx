import React, { useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    ReactFlow,
    type Node,
    type Edge,
    Controls,
    MiniMap,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    ConnectionMode,
    Position,
    Handle,
    type NodeDragHandler,
    type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TreeNode } from "./tree-utils";
import type { TaskStatus } from "src/entities/tasks/types";
import { centerOnTopmostNode } from "./camera-utils";
import { getStatusColors } from "./status-colors";

// Shared layout constants
const LAYOUT_CONFIG = {
    nodeWidth: 150,
    levelSpacing: 100,
    nodeHeight: 50,
} as const;

// Shared positioning algorithm - positions nodes with parent-centered approach
function calculateNodePositions(
    rootNodeId: string,
    childrenMap: Map<string, string[]>,
): Map<string, { x: number; y: number }> {
    let currentY = 0;
    const positions = new Map<string, { x: number; y: number }>();

    const positionSubtree = (nodeId: string, level = 0): number => {
        const x =
            level * (LAYOUT_CONFIG.nodeWidth + LAYOUT_CONFIG.levelSpacing);
        const children = childrenMap.get(nodeId) || [];

        if (children.length === 0) {
            // Leaf node: position at current Y and increment
            const y = currentY;
            currentY += LAYOUT_CONFIG.nodeHeight;
            positions.set(nodeId, { x, y });
            return y;
        } else {
            // Parent node: first position all children, then center parent among them
            const childYPositions: number[] = [];

            children.forEach((childId) => {
                const childY = positionSubtree(childId, level + 1);
                childYPositions.push(childY);
            });

            // Center parent among its children
            const minChildY = Math.min(...childYPositions);
            const maxChildY = Math.max(...childYPositions);
            const centerY = (minChildY + maxChildY) / 2;

            positions.set(nodeId, { x, y: centerY });
            return centerY;
        }
    };

    positionSubtree(rootNodeId);
    return positions;
}

interface TaskNodeData {
    label: string;
    taskId: string;
    status?: TaskStatus;
    level?: number;
    parentId?: string;
    siblingIds?: string[];
    navigate?: (path: string) => void;
}

function TaskNode({ data }: { data: TaskNodeData }) {
    const [dragStartPos, setDragStartPos] = React.useState<{
        x: number;
        y: number;
    } | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        setDragStartPos({ x: e.clientX, y: e.clientY });
    };

    const handleClick = (e: React.MouseEvent) => {
        // Only navigate if this wasn't a drag operation
        if (dragStartPos) {
            const distance = Math.sqrt(
                Math.pow(e.clientX - dragStartPos.x, 2) +
                    Math.pow(e.clientY - dragStartPos.y, 2),
            );

            // If the mouse moved less than 5px, treat it as a click
            if (distance < 5 && data.taskId && data.navigate) {
                data.navigate(`/task/${data.taskId}`);
            }
        } else {
            // If no drag position was recorded, treat as a simple click
            if (data.taskId && data.navigate) {
                data.navigate(`/task/${data.taskId}`);
            }
        }
        setDragStartPos(null);
    };

    // Function to wrap text with newlines for long titles
    const wrapText = (text: string, maxCharsPerLine: number = 60): string => {
        if (text.length <= maxCharsPerLine) return text;

        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
            if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
                currentLine += (currentLine ? " " : "") + word;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);

        return lines.join("\n");
    };

    const wrappedLabel = wrapText(data.label);
    const colors = getStatusColors(data.status);

    return (
        <div
            className={`px-2 py-1 shadow-md rounded-md border-2 ${colors.background} ${colors.border} ${colors.text} ${colors.cursor}`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            style={{
                minWidth: "80px",
                maxWidth: "200px",
                textAlign: "center",
                whiteSpace: "pre-line",
            }}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="w-2 h-2"
            />
            <div className="text-xs font-medium leading-tight">
                {wrappedLabel}
            </div>
            <Handle
                type="source"
                position={Position.Right}
                className="w-2 h-2"
            />
        </div>
    );
}

export interface TaskGraphFlowProps {
    trees: TreeNode[];
    width: number;
    height: number;
    onReorder?: (parentId: string, newOrder: string[]) => void;
}

function convertTreesToFlow(trees: TreeNode[], navigate: (path: string) => void): {
    nodes: Node[];
    edges: Edge[];
} {
    if (trees.length === 0) {
        return { nodes: [], edges: [] };
    }

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];
    let verticalOffset = 0;
    const TREE_SPACING = 150;

    trees.forEach((treeData, treeIndex) => {
        const { nodes, edges } = convertSingleTreeToFlow(
            treeData,
            verticalOffset,
            navigate,
        );
        allNodes.push(...nodes);
        allEdges.push(...edges);

        // Calculate the height of this tree to offset the next one
        const maxY = Math.max(...nodes.map((n) => n.position.y), 0);
        verticalOffset = maxY + TREE_SPACING;
    });

    return { nodes: allNodes, edges: allEdges };
}

function convertSingleTreeToFlow(
    treeData: TreeNode,
    verticalOffset: number = 0,
    navigate: (path: string) => void,
): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const parentChildMap: Record<string, string[]> = {};

    // First pass: collect parent-child relationships and build tree structure
    const nodeMap = new Map<string, TreeNode>();
    const collectRelationships = (node: TreeNode) => {
        nodeMap.set(node.id, node);
        if (node.children && node.children.length > 0) {
            const childIds = node.children.map((child) => child.id);
            parentChildMap[node.id] = childIds;
            node.children.forEach((child) => collectRelationships(child));
        }
    };
    collectRelationships(treeData);

    // Add root level children
    if (treeData.children && treeData.children.length > 0) {
        parentChildMap["root"] = treeData.children.map((child) => child.id);
    }

    // Second pass: calculate positions using shared algorithm
    const childrenMap = new Map<string, string[]>();
    Object.entries(parentChildMap).forEach(([parentId, children]) => {
        childrenMap.set(parentId, children);
    });

    const positions = calculateNodePositions(treeData.id, childrenMap);

    // Third pass: create nodes with calculated positions
    const createNodesRecursive = (
        node: TreeNode,
        level = 0,
        parentId?: string,
    ) => {
        const nodeId = node.id;
        const position = positions.get(nodeId)!;

        // Apply vertical offset
        const adjustedPosition = {
            x: position.x,
            y: position.y + verticalOffset,
        };

        // Determine siblings for drag and drop
        const siblingIds = parentId
            ? parentChildMap[parentId] || []
            : parentId === undefined
              ? parentChildMap["root"] || []
              : [];

        nodes.push({
            id: nodeId,
            type: "taskNode",
            position: adjustedPosition,
            data: {
                label: node.name,
                taskId: nodeId,
                status: node.status,
                level,
                parentId: parentId || "root",
                siblingIds,
                navigate,
            } as TaskNodeData,
            style: {
                transition: "all 0.3s ease-in-out",
            },
        });

        // Create edges
        if (parentId) {
            edges.push({
                id: `${parentId}-${nodeId}`,
                source: parentId,
                target: nodeId,
                type: "default",
                style: { stroke: "#374469", strokeWidth: 1 },
            });
        }

        // Process children
        node.children?.forEach((child) => {
            createNodesRecursive(child, level + 1, nodeId);
        });
    };

    createNodesRecursive(treeData);

    return { nodes, edges };
}

export default function TaskGraphFlow({
    trees,
    width,
    height,
    onReorder,
}: TaskGraphFlowProps) {
    const navigate = useNavigate();

    const { nodes: initialNodes, edges: initialEdges } = useMemo(
        () => convertTreesToFlow(trees, navigate),
        [trees, navigate],
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

    const nodeTypes = useMemo(() => ({
        taskNode: TaskNode,
    }), []);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    // Effect to center on topmost node when graph initializes or data changes
    // Only center when data changes, not when nodes are moved manually
    useEffect(() => {
        if (reactFlowInstance.current && nodes.length > 0) {
            centerOnTopmostNode(reactFlowInstance.current, nodes);
        }
    }, [trees]);

    // Effect to handle container size changes
    useEffect(() => {
        if (reactFlowInstance.current) {
            // Force ReactFlow to recalculate its dimensions
            setTimeout(() => {
                if (reactFlowInstance.current) {
                    reactFlowInstance.current.fitView({
                        padding: 0.1,
                        includeHiddenNodes: false,
                    });
                }
            }, 100);
        }
    }, [width, height]);

    // Function to recalculate positions using shared positioning algorithm after reorder
    const repositionNodesAfterReorder = useCallback(
        (parentId: string, newOrder: string[]) => {
            setNodes((prevNodes) => {
                // Find the root node to start repositioning from (node with no parent or parentId 'root')
                const rootNode = prevNodes.find(
                    (n) => !n.data.parentId || n.data.parentId === "root",
                );
                if (!rootNode) return prevNodes;

                // Update the sibling order in the node data first
                const updatedNodes = prevNodes.map((node) => {
                    if (node.data.parentId === parentId) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                siblingIds: newOrder,
                            },
                        };
                    }
                    return node;
                });

                // Create children map that respects the new order
                const childrenMap = new Map<string, string[]>();
                const allParentIds = new Set(
                    updatedNodes.map((n) => n.data.parentId),
                );

                allParentIds.forEach((currentParentId) => {
                    const children = updatedNodes.filter(
                        (n) => n.data.parentId === currentParentId,
                    );

                    // If this parent was reordered, use the new order
                    if (currentParentId === parentId) {
                        childrenMap.set(currentParentId, newOrder);
                    } else {
                        // Otherwise, maintain current order based on Y position
                        const orderedChildren = children
                            .sort((a, b) => a.position.y - b.position.y)
                            .map((n) => n.id);
                        childrenMap.set(currentParentId, orderedChildren);
                    }
                });

                // Calculate new positions using shared algorithm
                const newPositions = calculateNodePositions(
                    rootNode.id,
                    childrenMap,
                );

                // Apply new positions to nodes
                return updatedNodes.map((node) => {
                    const newPos = newPositions.get(node.id);
                    if (newPos) {
                        return {
                            ...node,
                            position: newPos,
                            style: {
                                ...node.style,
                                transition: "all 0.3s ease-in-out",
                            },
                        };
                    }
                    return node;
                });
            });
        },
        [],
    );

    // Handle node drag stop to detect reordering
    const onNodeDragStop: NodeDragHandler = useCallback(
        (event, draggedNode, draggedNodes) => {
            if (!onReorder) return;

            const draggedNodeData = draggedNode.data as TaskNodeData;
            const parentId = draggedNodeData.parentId;
            const siblingIds = draggedNodeData.siblingIds;

            if (!parentId || !siblingIds) return;

            // Find all sibling nodes and their current positions
            const siblingNodes = nodes.filter(
                (node) =>
                    siblingIds.includes(node.id) && node.id !== draggedNode.id,
            );

            // Add the dragged node to the list
            const allNodes = [...siblingNodes, draggedNode];

            // Sort nodes by their current Y position (since we have a horizontal layout)
            allNodes.sort((a, b) => a.position.y - b.position.y);

            // Create the new order based on Y positions
            const newOrder = allNodes.map((node) => node.id);

            // Only proceed if the order actually changed
            const originalOrder = [...siblingIds].sort();
            const sortedNewOrder = [...newOrder].sort();

            if (
                JSON.stringify(originalOrder) !==
                    JSON.stringify(sortedNewOrder) ||
                JSON.stringify(siblingIds) !== JSON.stringify(newOrder)
            ) {
                // First, reposition the nodes to their proper grid positions
                repositionNodesAfterReorder(parentId, newOrder);

                // Then call the onReorder callback for data update
                onReorder(parentId, newOrder);
            }
        },
        [nodes, onReorder, repositionNodesAfterReorder],
    );

    const onInit = useCallback(
        (instance: ReactFlowInstance) => {
            reactFlowInstance.current = instance;
            // Center on topmost node immediately after initialization
            centerOnTopmostNode(instance, nodes);
        },
        [nodes],
    );

    return (
        <div
            style={{ width, height }}
            className="bg-slate-800 rounded-lg relative"
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onInit={onInit}
                connectionMode={ConnectionMode.Loose}
                nodeTypes={nodeTypes}
                attributionPosition="bottom-left"
                className="rounded-lg"
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
            >
                <Background variant="dots" gap={12} size={1} color="#374469" />
                <MiniMap nodeColor={() => "#0891b2"} className="bg-slate-700" />
            </ReactFlow>
        </div>
    );
}
