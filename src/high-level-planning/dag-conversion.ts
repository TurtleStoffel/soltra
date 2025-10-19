import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { Task, TaskStatus } from "src/entities/tasks/types";
import type { Workstream } from "src/entities/workstreams/types";
import { calculateDAGPositions } from "./dag-positioning";
import type { TaskNodeData } from "./dag-task-card";

export async function convertTasksToDAG(
    tasks: Task[],
    workstreams: Workstream[],
    onAsyncToggle: (taskId: string, newValue: boolean) => void,
): Promise<{ nodes: Node[]; edges: Edge[] }> {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const allNodes: { id: string; label: string; status?: TaskStatus }[] = [];

    // Convert tasks to node data
    tasks.forEach((task) => {
        allNodes.push({
            id: task.uuid,
            label: task.title,
            status: task.status,
        });
    });

    // Add edges from workstream dependencies
    const taskMap = new Map(tasks.map((t) => [t.uuid, t]));
    const addedEdges = new Set<string>();

    workstreams.forEach((ws) => {
        ws.dependencies.forEach((dep) => {
            const edgeId = `${dep.fromTaskUuid}-${dep.toTaskUuid}`;
            if (
                !addedEdges.has(edgeId) &&
                taskMap.has(dep.fromTaskUuid) &&
                taskMap.has(dep.toTaskUuid)
            ) {
                edges.push({
                    id: edgeId,
                    source: dep.fromTaskUuid,
                    target: dep.toTaskUuid,
                    type: "default",
                    style: {
                        stroke: dep.type === "blocks" ? "#10b981" : "#9333ea",
                        strokeWidth: 2,
                    },
                    animated: dep.type === "blocks",
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 20,
                        height: 20,
                        color: dep.type === "blocks" ? "#10b981" : "#9333ea",
                    },
                    interactionWidth: 20, // Wider invisible hit area for easier selection
                });
                addedEdges.add(edgeId);
            }
        });
    });

    // Separate tasks into workstreams and non-workstream tasks
    const taskToWorkstream = new Map<string, string>();
    workstreams.forEach((ws) => {
        ws.tasks.forEach((taskId) => {
            taskToWorkstream.set(taskId, ws.uuid);
        });
    });

    const workstreamTasks = new Map<string, typeof allNodes>();
    const nonWorkstreamTasks: typeof allNodes = [];

    allNodes.forEach((node) => {
        const wsId = taskToWorkstream.get(node.id);
        if (wsId) {
            if (!workstreamTasks.has(wsId)) {
                workstreamTasks.set(wsId, []);
            }
            workstreamTasks.get(wsId)!.push(node);
        } else {
            nonWorkstreamTasks.push(node);
        }
    });

    // Calculate positions for each workstream separately
    let currentY = 100;
    const WORKSTREAM_VERTICAL_SPACING = 150;
    const WORKSTREAM_PADDING = 80;

    // Position workstream tasks
    workstreams.forEach((ws) => {
        const wsTasks = workstreamTasks.get(ws.uuid) || [];
        if (wsTasks.length === 0) return;

        const workstreamX = 50;
        const workstreamY = currentY;

        // Get edges within this workstream
        const wsEdges = edges
            .filter(
                (e) =>
                    taskToWorkstream.get(e.source) === ws.uuid &&
                    taskToWorkstream.get(e.target) === ws.uuid,
            )
            .map((e) => ({ source: e.source, target: e.target }));

        // Calculate positions for this workstream's tasks
        const wsPositions = calculateDAGPositions(wsTasks, wsEdges);

        // Find bounding box for this workstream
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        wsPositions.forEach((pos) => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        });

        // Offset positions to workstream position and add padding
        const offsetX = workstreamX + 50;
        const offsetY = workstreamY;
        wsTasks.forEach((nodeData) => {
            const pos = wsPositions.get(nodeData.id)!;
            nodes.push({
                id: nodeData.id,
                type: "taskNode",
                position: {
                    x: pos.x + offsetX,
                    y: pos.y - minY + offsetY + WORKSTREAM_PADDING,
                },
                data: {
                    label: nodeData.label,
                    taskId: nodeData.id,
                    status: nodeData.status,
                    workstreamId: `workstream-${ws.uuid}`,
                    onAsyncToggle,
                } as TaskNodeData,
                style: {
                    transition: "all 0.3s ease-in-out",
                    zIndex: 10,
                },
                selectable: true,
            });
        });

        // Create workstream group node
        const wsWidth = Math.max(600, maxX - minX + 2 * WORKSTREAM_PADDING);
        const wsHeight = maxY - minY + 2 * WORKSTREAM_PADDING;
        nodes.push({
            id: `workstream-${ws.uuid}`,
            type: "group",
            position: { x: workstreamX, y: workstreamY },
            data: { label: ws.title },
            draggable: true,
            selectable: true,
            style: {
                width: wsWidth,
                height: wsHeight,
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                border: "2px solid rgba(99, 102, 241, 0.5)",
                borderRadius: "8px",
                padding: "20px",
                zIndex: 0,
            },
        });

        currentY += wsHeight + WORKSTREAM_VERTICAL_SPACING;
    });

    // Position non-workstream tasks below all workstreams
    if (nonWorkstreamTasks.length > 0) {
        const nonWsEdges = edges
            .filter(
                (e) =>
                    !taskToWorkstream.has(e.source) &&
                    !taskToWorkstream.has(e.target),
            )
            .map((e) => ({ source: e.source, target: e.target }));

        const nonWsPositions = calculateDAGPositions(
            nonWorkstreamTasks,
            nonWsEdges,
        );

        nonWorkstreamTasks.forEach((nodeData) => {
            const pos = nonWsPositions.get(nodeData.id)!;
            nodes.push({
                id: nodeData.id,
                type: "taskNode",
                position: { x: pos.x + 100, y: pos.y + currentY },
                data: {
                    label: nodeData.label,
                    taskId: nodeData.id,
                    status: nodeData.status,
                    onAsyncToggle,
                } as TaskNodeData,
                style: {
                    transition: "all 0.3s ease-in-out",
                },
            });
        });
    }

    return { nodes, edges };
}
