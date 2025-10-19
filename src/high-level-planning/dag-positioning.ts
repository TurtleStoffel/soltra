/**
 * DAG Positioning Utilities
 *
 * This module contains functions for calculating positions of nodes in a Directed Acyclic Graph (DAG).
 * The layout algorithm groups connected components and arranges them left-to-right with topological ordering.
 */

/**
 * Calculate positions for nodes in a DAG layout with connected component grouping and left-to-right flow.
 *
 * @param nodes - Array of nodes with id and label
 * @param edges - Array of edges with source and target node IDs
 * @returns Map of node IDs to their calculated positions {x, y}
 *
 * Algorithm:
 * 1. Find connected components using DFS
 * 2. For each component, perform topological sort using Kahn's algorithm
 * 3. Position nodes left-to-right by topological level
 * 4. Stack components vertically with appropriate spacing
 *
 * @throws Error if a cycle is detected in the dependencies
 */
export function calculateDAGPositions(
    nodes: { id: string; label: string }[],
    edges: { source: string; target: string }[],
): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();

    if (nodes.length === 0) return positions;

    // Build adjacency lists for both directions
    const adjacencyList = new Map<string, Set<string>>();
    const reverseAdjacencyList = new Map<string, Set<string>>();

    nodes.forEach((node) => {
        adjacencyList.set(node.id, new Set());
        reverseAdjacencyList.set(node.id, new Set());
    });

    edges.forEach((edge) => {
        adjacencyList.get(edge.source)?.add(edge.target);
        reverseAdjacencyList.get(edge.target)?.add(edge.source);
    });

    // Find connected components using DFS
    const visited = new Set<string>();
    const components: string[][] = [];

    const dfs = (nodeId: string, component: string[]) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        component.push(nodeId);

        // Visit connected nodes (both directions)
        adjacencyList
            .get(nodeId)
            ?.forEach((neighbor) => dfs(neighbor, component));
        reverseAdjacencyList
            .get(nodeId)
            ?.forEach((neighbor) => dfs(neighbor, component));
    };

    nodes.forEach((node) => {
        if (!visited.has(node.id)) {
            const component: string[] = [];
            dfs(node.id, component);
            components.push(component);
        }
    });

    // Layout each component separately
    const nodeSpacing = 250;
    const levelSpacing = 50;
    const componentSpacing = 50;
    let currentComponentY = 0;

    components.forEach((component) => {
        if (component.length === 1) {
            // Single node - place it simply
            positions.set(component[0], { x: 0, y: currentComponentY });
            currentComponentY += 100; // Reduced spacing for single nodes
            return;
        }

        // Topological sort for left-to-right layout within component
        const componentAdjacency = new Map<string, Set<string>>();
        const inDegree = new Map<string, number>();

        component.forEach((nodeId) => {
            componentAdjacency.set(nodeId, new Set());
            inDegree.set(nodeId, 0);
        });

        edges.forEach((edge) => {
            if (
                component.includes(edge.source) &&
                component.includes(edge.target)
            ) {
                componentAdjacency.get(edge.source)?.add(edge.target);
                inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
            }
        });

        // Kahn's algorithm for topological sorting
        const levels: string[][] = [];
        const queue: string[] = [];
        const currentInDegree = new Map(inDegree);

        // Find nodes with no incoming edges
        component.forEach((nodeId) => {
            if (currentInDegree.get(nodeId) === 0) {
                queue.push(nodeId);
            }
        });

        while (queue.length > 0) {
            const currentLevel: string[] = [];
            const levelSize = queue.length;

            for (let i = 0; i < levelSize; i++) {
                const nodeId = queue.shift()!;
                currentLevel.push(nodeId);

                componentAdjacency.get(nodeId)?.forEach((neighbor) => {
                    const newInDegree =
                        (currentInDegree.get(neighbor) || 0) - 1;
                    currentInDegree.set(neighbor, newInDegree);
                    if (newInDegree === 0) {
                        queue.push(neighbor);
                    }
                });
            }

            if (currentLevel.length > 0) {
                levels.push(currentLevel);
            }
        }

        // Check for cycles - throw error if any nodes remain unprocessed
        const processedNodes = new Set(levels.flat());
        const remainingNodes = component.filter(
            (nodeId) => !processedNodes.has(nodeId),
        );
        if (remainingNodes.length > 0) {
            throw new Error(
                `Cycle detected in task dependencies involving nodes: ${remainingNodes.join(", ")}`,
            );
        }

        // Position nodes within the component - minimize vertical spacing
        const isSimpleChain = levels.every((level) => level.length <= 1);
        const baseY = currentComponentY;

        levels.forEach((level, levelIndex) => {
            const startX = levelIndex * nodeSpacing;

            level.forEach((nodeId, nodeIndex) => {
                let yPosition = baseY;

                if (isSimpleChain) {
                    // For simple chains (A -> B -> C), keep all nodes at the same Y level
                    yPosition = baseY;
                } else {
                    // For complex layouts, use vertical spacing between levels and within levels
                    const levelY = baseY + levelIndex * levelSpacing * 0.3; // Reduced vertical spacing between levels
                    const offsetY =
                        level.length > 1
                            ? (nodeIndex - (level.length - 1) / 2) *
                              (nodeSpacing * 0.5) // Reduced node spacing within level
                            : 0;
                    yPosition = levelY + offsetY;
                }

                positions.set(nodeId, {
                    x: startX,
                    y: yPosition,
                });
            });
        });

        // Calculate component height for next component positioning
        const componentHeight = isSimpleChain
            ? levelSpacing // Minimal height for simple chains
            : Math.max(levels.length * levelSpacing * 0.3, 100);

        currentComponentY += componentHeight + componentSpacing;
    });

    return positions;
}
