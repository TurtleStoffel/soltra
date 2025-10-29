import React, {
    useCallback,
    useMemo,
    useEffect,
    useRef,
    useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
    ReactFlow,
    type Node,
    type Edge,
    MiniMap,
    Background,
    useNodesState,
    useEdgesState,
    type Connection,
    ConnectionMode,
    type ReactFlowInstance,
    type OnConnect,
    ConnectionLineType,
} from "@xyflow/react";
import type { TaskStatus, Task } from "src/entities/tasks/types";
import { createTask, storeTasks } from "src/entities/tasks/task-file-storage";
import { removeTask, updateTask } from "src/entities/tasks/task-service";
import { storeWorkstreams, createWorkstream } from "src/entities/workstreams/workstream-file-storage";
import {
    addTaskToWorkstream,
    removeDependency,
    loadAndValidateWorkstreams,
} from "src/entities/workstreams/workstream-service";
import { connectTasks } from "src/entities/workstreams/workstream-task-service";
import type { Workstream } from "src/entities/workstreams/types";
import { centerOnTopmostNode } from "./camera-utils";
import { convertTasksToDAG } from "./dag-conversion";
import { getTaskExecutionContext, setTaskExecutionContext } from "src/task-execution/task-execution-context-storage";
import { executeTask } from "src/task-execution/task-execution-logic";
import { TaskNode, type TaskNodeData } from "./dag-task-card";
import { TaskSearchBar } from "./task-search-bar";
import { getGlobalOrder, updateGlobalOrder } from "./global-order-service";
import type { OrderItem, OrderItemType } from "./global-order-storage";

function WorkstreamGroupNode({ data }: { data: { label: string } }) {
    return (
        <div
            className="w-full h-full relative"
            style={{
                backgroundColor: "transparent",
            }}
        >
            <div className="absolute top-2 left-2 text-indigo-300 font-semibold text-sm px-3 py-1 bg-indigo-900/50 rounded">
                {data.label}
            </div>
        </div>
    );
}

function ExecuteTaskButton({ taskId, onExecute }: { taskId: string; onExecute: () => void }) {
    const [hasAsync, setHasAsync] = useState(false);

    useEffect(() => {
        getTaskExecutionContext(taskId).then((context) => {
            if (context) {
                setHasAsync(context.async);
            }
        });
    }, [taskId]);

    if (!hasAsync) {
        return null;
    }

    return (
        <button
            onClick={onExecute}
            className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 flex items-center gap-2"
        >
            <span className="text-purple-400">⚡</span>
            Execute Task
        </button>
    );
}

const nodeTypes = {
    taskNode: TaskNode,
    group: WorkstreamGroupNode,
};

// Reorder and persist tasks based on their Y position
function reorderTasksByPosition(currentNodes: Node[], currentTasks: Task[]) {
    const taskNodes = currentNodes.filter((n) => n.type === "taskNode");
    const reorderedNodes = taskNodes.sort(
        (a, b) => a.position.y - b.position.y,
    );

    // Reorder tasks array to match Y position order
    const reorderedTasks = reorderedNodes
        .map((sorted) => currentTasks.find((t) => t.uuid === sorted.id))
        .filter((t): t is Task => t !== undefined);

    return { reorderedTasks, reorderedNodes };
}

// Handle node clicks for navigation (moved inside component to access navigate hook)

export interface TaskDAGFlowProps {
    tasks: Task[];
    width: number;
    height: number;
    onConnectionsChange?: (
        connections: { source: string; target: string }[],
    ) => void;
    onTaskCreated: () => void;
}

export default function TaskDAGFlow({
    tasks,
    width,
    height,
    onConnectionsChange,
    onTaskCreated,
}: TaskDAGFlowProps) {
    const navigate = useNavigate();
    const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
    const [globalOrder, setGlobalOrder] = useState<OrderItem[]>([]);
    const [connectionInProgress, setConnectionInProgress] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        show: boolean;
        x: number;
        y: number;
        screenX: number;
        screenY: number;
        nodeId?: string;
    }>({ show: false, x: 0, y: 0, screenX: 0, screenY: 0 });
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [isCreatingWorkstream, setIsCreatingWorkstream] = useState(false);
    const [showWorkstreamMenu, setShowWorkstreamMenu] = useState(false);
    const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
    const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
    const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
    const connectionStart = useRef<{
        nodeId: string;
        handleType: "source" | "target";
        position: { x: number; y: number };
    } | null>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Track previous workstream positions to detect movement
    const prevWorkstreamPositions = useRef<
        Map<string, { x: number; y: number }>
    >(new Map());

    // Handle node changes and propagate workstream movement to children
    const handleNodesChange = useCallback(
        (changes: any[]) => {
            onNodesChange(changes);

            // Check if any workstream nodes were moved
            changes.forEach((change) => {
                if (
                    change.type === "position" &&
                    change.id.startsWith("workstream-") &&
                    change.position
                ) {
                    const workstreamId = change.id;
                    const newPosition = change.position;
                    const prevPosition =
                        prevWorkstreamPositions.current.get(workstreamId);

                    if (prevPosition) {
                        const deltaX = newPosition.x - prevPosition.x;
                        const deltaY = newPosition.y - prevPosition.y;

                        if (deltaX !== 0 || deltaY !== 0) {
                            // Update all task nodes that belong to this workstream
                            setNodes((currentNodes) =>
                                currentNodes.map((node) => {
                                    const nodeData = node.data as TaskNodeData;
                                    if (
                                        nodeData.workstreamId === workstreamId
                                    ) {
                                        return {
                                            ...node,
                                            position: {
                                                x: node.position.x + deltaX,
                                                y: node.position.y + deltaY,
                                            },
                                        };
                                    }
                                    return node;
                                }),
                            );
                        }
                    }

                    prevWorkstreamPositions.current.set(
                        workstreamId,
                        newPosition,
                    );
                }
            });
        },
        [onNodesChange, setNodes],
    );

    // Handle when a node drag ends
    const onNodeDragStop = useCallback(
        async (_event: any, node: Node) => {
            // Collect all nodes (both workstreams and standalone tasks) with their Y positions
            const allItems: Array<{ type: OrderItemType; uuid: string; y: number }> = [];

            nodes.forEach((n) => {
                if (n.id.startsWith("workstream-")) {
                    allItems.push({
                        type: "workstream",
                        uuid: n.id.replace("workstream-", ""),
                        y: n.position.y,
                    });
                } else if (n.type === "taskNode") {
                    // Only include standalone tasks (not part of a workstream)
                    const nodeData = n.data as TaskNodeData;
                    if (!nodeData.workstreamId) {
                        allItems.push({
                            type: "task",
                            uuid: n.id,
                            y: n.position.y,
                        });
                    }
                }
            });

            // Sort by Y position
            allItems.sort((a, b) => a.y - b.y);

            // Create new global order
            const newGlobalOrder: OrderItem[] = allItems.map(item => ({
                type: item.type,
                uuid: item.uuid,
            }));

            // Store the new global order
            await updateGlobalOrder(newGlobalOrder);
            setGlobalOrder(newGlobalOrder);

            // The UI will update automatically via the useEffect that watches globalOrder
        },
        [nodes, setGlobalOrder],
    );

    // Handle new connections
    const onConnect: OnConnect = useCallback(
        async (params: Connection) => {
            // Prevent self-connections
            if (params.source === params.target) return;

            const sourceId = params.source;
            const targetId = params.target;

            // Clear connection start since connection succeeded
            connectionStart.current = null;

            await connectTasks(sourceId, targetId, tasks, "blocks");

            // Reload workstreams to update the UI
            setWorkstreams(await loadAndValidateWorkstreams());
        },
        [tasks],
    );

    // Handle connection start
    const onConnectStart = useCallback((_event: any, params: { nodeId: string | null; handleType: "source" | "target" | null }) => {
        setConnectionInProgress(true);
        if (params.nodeId && params.handleType) {
            connectionStart.current = {
                nodeId: params.nodeId,
                handleType: params.handleType,
            };
        }
    }, []);

    // Handle connection end
    const onConnectEnd = useCallback(async (event: any) => {
        setConnectionInProgress(false);

        // Check if we have connection info and didn't connect to a valid target
        if (connectionStart.current && reactFlowInstance.current) {
            const position = reactFlowInstance.current.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const connectionInfo = connectionStart.current;
            connectionStart.current = null;

            // Immediately prompt for task title
            const taskTitle = prompt("Enter task title:");
            if (!taskTitle || taskTitle.trim() === "") {
                return;
            }

            setIsCreatingTask(true);

            try {
                const newTask = await createTask(taskTitle.trim());

                // Add the new task as a node at the drop position
                const newNode: Node = {
                    id: newTask.uuid,
                    type: "taskNode",
                    position: { x: position.x, y: position.y },
                    data: {
                        label: newTask.title,
                        taskId: newTask.uuid,
                        status: newTask.status,
                    } as TaskNodeData,
                    style: {
                        transition: "all 0.3s ease-in-out",
                    },
                };

                // Reorder all tasks based on Y position, including the new task
                const { reorderedTasks } = reorderTasksByPosition(
                    [...nodes, newNode],
                    [...tasks, newTask],
                );
                await storeTasks(reorderedTasks);

                // Create the connection based on which handle was used
                // source handle (right) = original task blocks new task
                // target handle (left) = new task blocks original task
                const sourceId = connectionInfo.handleType === "source"
                    ? connectionInfo.nodeId
                    : newTask.uuid;
                const targetId = connectionInfo.handleType === "source"
                    ? newTask.uuid
                    : connectionInfo.nodeId;

                await connectTasks(sourceId, targetId, [...tasks, newTask], "blocks");

                // Reload workstreams to update the UI
                setWorkstreams(await loadAndValidateWorkstreams());

                // Notify parent component that a task was created
                onTaskCreated();
            } catch (error) {
                console.error("Failed to create connected task:", error);
                alert("Failed to create connected task. Please try again.");
            } finally {
                setIsCreatingTask(false);
            }
        }
    }, [nodes, tasks, onTaskCreated]);

    // Handle edge deletion
    const onEdgesDelete = useCallback(
        async (edgesToDelete: Edge[]) => {
            for (const edge of edgesToDelete) {
                const sourceId = edge.source;
                const targetId = edge.target;

                // Find workstream(s) that contain this dependency
                const relevantWorkstreams = workstreams.filter((ws) =>
                    ws.dependencies.some(
                        (dep) =>
                            dep.fromTaskUuid === sourceId &&
                            dep.toTaskUuid === targetId,
                    ),
                );

                for (const workstream of relevantWorkstreams) {
                    try {
                        await removeDependency(
                            workstream.uuid,
                            sourceId,
                            targetId,
                        );
                    } catch (error) {
                        console.error("Failed to remove dependency:", error);
                        alert(
                            `Failed to delete connection: ${error instanceof Error ? error.message : "Unknown error"}`,
                        );
                    }
                }
            }

            // Reload workstreams to update the UI
            setWorkstreams(await loadAndValidateWorkstreams());
        },
        [workstreams],
    );

    // Handle right-click context menu on pane
    const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
        event.preventDefault();

        if (!reactFlowInstance.current || !reactFlowWrapper.current) return;

        const position = reactFlowInstance.current.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const rect = reactFlowWrapper.current.getBoundingClientRect();

        setContextMenu({
            show: true,
            x: position.x,
            y: position.y,
            screenX: event.clientX - rect.left,
            screenY: event.clientY - rect.top,
        });
    }, []);

    // Handle right-click context menu on node
    const onNodeContextMenu = useCallback(
        (event: React.MouseEvent, node: Node) => {
            event.preventDefault();

            if (!reactFlowWrapper.current) return;

            const rect = reactFlowWrapper.current.getBoundingClientRect();

            setContextMenu({
                show: true,
                x: node.position.x,
                y: node.position.y,
                screenX: event.clientX - rect.left,
                screenY: event.clientY - rect.top,
                nodeId: node.id,
            });
        },
        [],
    );

    // Hide context menu on any click
    const onPaneClick = useCallback(() => {
        setContextMenu({ show: false, x: 0, y: 0, screenX: 0, screenY: 0 });
        setShowWorkstreamMenu(false);
        connectionStart.current = null;
    }, []);

    // Handle node clicks for navigation
    const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        // Only handle task nodes, not workstream group nodes
        if (node.type === "taskNode") {
            const nodeData = node.data as TaskNodeData;
            if (nodeData.taskId) {
                navigate(`/task/${nodeData.taskId}`);
            }
        }
    }, [navigate]);

    // Handle highlight changes from search
    const handleHighlightChange = useCallback((nodeId: string | null) => {
        setHighlightedNodeId(nodeId);
    }, []);

    useEffect(() => {
        const initializeData = async () => {
            const loadedWorkstreams = await loadAndValidateWorkstreams();
            setWorkstreams(loadedWorkstreams);

            // Get global order (automatically loads, initializes, and syncs if needed)
            const order = await getGlobalOrder();

            setGlobalOrder(order);
        };

        initializeData();
    }, [tasks]);

    // Update nodes and edges when tasks or workstreams change
    useEffect(() => {
        convertTasksToDAG(tasks, workstreams, handleAsyncToggle, globalOrder).then(({ nodes: newNodes, edges: newEdges }) => {
            // Apply highlighting to matched node
            const nodesWithHighlight = newNodes.map(node => ({
                ...node,
                style: {
                    ...node.style,
                    ...(node.id === highlightedNodeId ? {
                        boxShadow: '0 0 0 3px #3b82f6',
                        transition: 'all 0.3s ease-in-out',
                    } : {}),
                },
            }));

            setNodes(nodesWithHighlight);
            setEdges(newEdges);

            // Initialize workstream positions
            prevWorkstreamPositions.current.clear();
            newNodes.forEach((node) => {
                if (node.id.startsWith("workstream-")) {
                    prevWorkstreamPositions.current.set(node.id, node.position);
                }
            });
        });
    }, [tasks, workstreams, globalOrder, highlightedNodeId, setNodes, setEdges]);

    // Show workstream selection menu
    const handleShowWorkstreamMenu = useCallback(() => {
        setShowWorkstreamMenu(true);
    }, []);

    // Add task to workstream
    const handleAddToWorkstream = useCallback(
        async (workstreamUuid: string) => {
            if (!contextMenu.nodeId) return;

            try {
                await addTaskToWorkstream(workstreamUuid, contextMenu.nodeId);
                alert("Task added to workstream successfully!");
            } catch (error) {
                console.error("Failed to add task to workstream:", error);
                alert(
                    `Failed to add task to workstream: ${error instanceof Error ? error.message : "Unknown error"}`,
                );
            } finally {
                setContextMenu({
                    show: false,
                    x: 0,
                    y: 0,
                    screenX: 0,
                    screenY: 0,
                });
                setShowWorkstreamMenu(false);
            }
        },
        [contextMenu.nodeId],
    );

    // Mark task as done (delete it)
    const handleMarkTaskAsDone = async () => {
        if (!contextMenu.nodeId) return;

        setContextMenu({ show: false, x: 0, y: 0, screenX: 0, screenY: 0 });

        await removeTask(contextMenu.nodeId);

        // Notify parent component to refresh
        // The naming is odd, but it signals a refresh
        onTaskCreated();
    };

    // Mark task as in progress
    const handleMarkTaskAsInProgress = async () => {
        if (!contextMenu.nodeId) return;

        setContextMenu({ show: false, x: 0, y: 0, screenX: 0, screenY: 0 });

        const task = tasks.find((t) => t.uuid === contextMenu.nodeId);
        if (!task) {
            throw new Error(`Task with UUID ${contextMenu.nodeId} not found.`);
        }

        await updateTask({ ...task, status: "In Progress" });

        // Notify parent component to refresh
        onTaskCreated();
    };

    // Mark task as triage
    const handleMarkTaskAsTriage = async () => {
        if (!contextMenu.nodeId) return;

        setContextMenu({ show: false, x: 0, y: 0, screenX: 0, screenY: 0 });

        const task = tasks.find((t) => t.uuid === contextMenu.nodeId);
        if (!task) {
            throw new Error(`Task with UUID ${contextMenu.nodeId} not found.`);
        }

        await updateTask({ ...task, status: "Triage" });

        // Notify parent component to refresh
        onTaskCreated();
    };

    // Handle async toggle
    const handleAsyncToggle = async (taskId: string, newValue: boolean) => {
        const context = await getTaskExecutionContext(taskId);
        if (!context) {
            throw new Error(`No execution context found for task ${taskId}`);
        }
        await setTaskExecutionContext(
            taskId,
            context.workingDirectory,
            context.context,
            newValue,
        );
        // Refresh the view to update the node
        onTaskCreated();
    };

    // Handle execute task
    const handleExecuteTask = async () => {
        if (!contextMenu.nodeId) return;

        setContextMenu({ show: false, x: 0, y: 0, screenX: 0, screenY: 0 });

        const task = tasks.find((t) => t.uuid === contextMenu.nodeId);
        if (!task) {
            throw new Error(`Task with UUID ${contextMenu.nodeId} not found.`);
        }

        const executionContext = await getTaskExecutionContext(task.uuid);
        if (!executionContext) {
            throw new Error(`No execution context found for task ${task.uuid}`);
        }

        const result = await executeTask(
            task,
            executionContext.workingDirectory,
            executionContext.context,
            executionContext.async,
        );

        if (!result.success) {
            throw new Error(result.error || "Unknown error executing task");
        }

        onTaskCreated();
    };

    // Create new task at context menu position
    const handleCreateTask = useCallback(async () => {
        setIsCreatingTask(true);
        setContextMenu({ show: false, x: 0, y: 0, screenX: 0, screenY: 0 });

        try {
            const taskTitle = prompt("Enter task title:");
            if (!taskTitle || taskTitle.trim() === "") {
                setIsCreatingTask(false);
                return;
            }

            const newTask = await createTask(taskTitle.trim());

            // Add the new task as a node at the context menu position
            const newNode: Node = {
                id: newTask.uuid,
                type: "taskNode",
                position: { x: contextMenu.x, y: contextMenu.y },
                data: {
                    label: newTask.title,
                    taskId: newTask.uuid,
                    status: newTask.status,
                } as TaskNodeData,
                style: {
                    transition: "all 0.3s ease-in-out",
                },
            };

            // Reorder all tasks based on Y position, including the new task
            const { reorderedTasks, reorderedNodes } = reorderTasksByPosition(
                [...nodes, newNode],
                [...tasks, newTask],
            );
            setNodes(reorderedNodes);
            await storeTasks(reorderedTasks);

            // Notify parent component that a task was created
            onTaskCreated();
        } catch (error) {
            console.error("Failed to create task:", error);
            alert("Failed to create task. Please try again.");
        } finally {
            setIsCreatingTask(false);
        }
    }, [contextMenu.x, contextMenu.y, onTaskCreated, nodes, tasks]);

    // Create new workstream
    const handleCreateWorkstream = useCallback(async () => {
        setIsCreatingWorkstream(true);
        setContextMenu({ show: false, x: 0, y: 0, screenX: 0, screenY: 0 });

        try {
            const title = prompt("Enter workstream title:");
            if (!title || title.trim() === "") {
                setIsCreatingWorkstream(false);
                return;
            }

            const description =
                prompt("Enter workstream description (optional):") || "";

            await createWorkstream(title.trim(), description.trim());

            // Refresh workstreams list
            setWorkstreams(await loadAndValidateWorkstreams());

            alert("Workstream created successfully!");
        } catch (error) {
            console.error("Failed to create workstream:", error);
            alert("Failed to create workstream. Please try again.");
        } finally {
            setIsCreatingWorkstream(false);
        }
    }, []);

    // Handle container size changes
    useEffect(() => {
        if (reactFlowInstance.current) {
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

    const onInit = (instance: ReactFlowInstance) => {
        reactFlowInstance.current = instance;
        // Center on topmost node immediately after initialization
        centerOnTopmostNode(instance, nodes);
    };

    return (
        <div
            ref={reactFlowWrapper}
            style={{ width, height }}
            className="bg-slate-800 rounded-lg relative"
        >
            {/* Search Bar */}
            <TaskSearchBar
                tasks={tasks}
                nodes={nodes}
                reactFlowInstance={reactFlowInstance.current}
                onHighlightChange={handleHighlightChange}
            />

            {connectionInProgress && (
                <div className="absolute top-2 left-2 z-10 bg-green-600 text-white px-3 py-1 rounded-md text-sm">
                    Drawing connection...
                </div>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onEdgesDelete={onEdgesDelete}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={handleNodeClick}
                onInit={onInit}
                onPaneContextMenu={onPaneContextMenu}
                onNodeContextMenu={onNodeContextMenu}
                onPaneClick={onPaneClick}
                connectionMode={ConnectionMode.Loose}
                connectionLineType={ConnectionLineType.SmoothStep}
                nodeTypes={nodeTypes}
                attributionPosition="bottom-left"
                className="rounded-lg"
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
                selectNodesOnDrag={false}
                deleteKeyCode={["Delete", "Backspace"]}
            >
                <Background variant="dots" gap={12} size={1} color="#374469" />
                <MiniMap nodeColor={() => "#10b981"} className="bg-slate-700" />
            </ReactFlow>

            {/* Context Menu */}
            {contextMenu.show && !showWorkstreamMenu && (
                <div
                    className="absolute bg-slate-700 border border-slate-600 rounded-md shadow-lg z-50 py-1"
                    style={{
                        left: contextMenu.screenX,
                        top: contextMenu.screenY,
                    }}
                >
                    {!contextMenu.nodeId ? (
                        <>
                            <button
                                onClick={handleCreateTask}
                                disabled={isCreatingTask}
                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isCreatingTask ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <span className="text-green-400">
                                            +
                                        </span>
                                        Create Task
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleCreateWorkstream}
                                disabled={isCreatingWorkstream}
                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isCreatingWorkstream ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <span className="text-purple-400">
                                            +
                                        </span>
                                        Create Workstream
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleShowWorkstreamMenu}
                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 flex items-center gap-2"
                            >
                                <span className="text-blue-400">→</span>
                                Add to Workstream
                            </button>
                            <ExecuteTaskButton
                                taskId={contextMenu.nodeId}
                                onExecute={handleExecuteTask}
                            />
                            {(() => {
                                const task = tasks.find(
                                    (t) => t.uuid === contextMenu.nodeId,
                                );
                                const isInProgress =
                                    task?.status === "In Progress";

                                return (
                                    <>
                                        {isInProgress ? (
                                            <button
                                                onClick={handleMarkTaskAsTriage}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 flex items-center gap-2"
                                            >
                                                <span className="text-gray-400">
                                                    ○
                                                </span>
                                                Mark as Triage
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleMarkTaskAsInProgress}
                                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 flex items-center gap-2"
                                            >
                                                <span className="text-yellow-400">
                                                    ▶
                                                </span>
                                                Mark as In Progress
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                            <button
                                onClick={handleMarkTaskAsDone}
                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 flex items-center gap-2"
                            >
                                <span className="text-green-400">✓</span>
                                Mark as Done
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Workstream Selection Menu */}
            {contextMenu.show && showWorkstreamMenu && (
                <div
                    className="absolute bg-slate-700 border border-slate-600 rounded-md shadow-lg z-50 py-1 max-h-64 overflow-y-auto"
                    style={{
                        left: contextMenu.screenX,
                        top: contextMenu.screenY,
                    }}
                >
                    {workstreams.length === 0 ? (
                        <div className="px-4 py-2 text-gray-400 text-sm">
                            No workstreams available
                        </div>
                    ) : (
                        workstreams.map((workstream) => (
                            <button
                                key={workstream.uuid}
                                onClick={() =>
                                    handleAddToWorkstream(workstream.uuid)
                                }
                                className="w-full px-4 py-2 text-left text-white hover:bg-slate-600 flex flex-col"
                            >
                                <span className="font-medium">
                                    {workstream.title}
                                </span>
                                {workstream.description && (
                                    <span className="text-xs text-gray-400 truncate">
                                        {workstream.description}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}

            <div className="absolute bottom-2 right-2 bg-slate-700 text-white p-2 rounded text-xs">
                <div>
                    • Drag to connect nodes (adds target to source workstream)
                </div>
                <div>• Delete key to remove connections</div>
                <div>• Right-click pane to create tasks/workstreams</div>
                <div>• Right-click node to add to workstream</div>
                <div>• Workstreams shown as colored boxes</div>
                <div>• Green edges = blocking, Purple = related</div>
                <div>• Click nodes to navigate</div>
            </div>
        </div>
    );
}
