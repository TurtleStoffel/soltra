import type { Node, ReactFlowInstance } from "@xyflow/react";

export function centerOnTopmostNode(
    instance: ReactFlowInstance,
    nodeList: Node[],
): void {
    if (nodeList.length === 0) return;

    const topmostNode = nodeList.reduce((highest, current) =>
        current.position.y < highest.position.y ? current : highest,
    );

    instance.setCenter(
        topmostNode.position.x + 100, // Add some offset to account for node width
        topmostNode.position.y + 25, // Add some offset to account for node height
        { zoom: 1 },
    );
}
