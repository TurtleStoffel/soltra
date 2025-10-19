import { Position, Handle } from "@xyflow/react";
import { useEffect, useState } from "react";
import type { TaskStatus } from "src/entities/tasks/types";
import { getStatusColors } from "./status-colors";
import { getProductByTaskUuid } from "src/entities/products/product-service";
import { getTaskExecutionContext } from "src/task-execution/task-execution-context-storage";

export interface TaskNodeData {
    label: string;
    taskId: string;
    status?: TaskStatus;
    workstreamId?: string;
    onAsyncToggle: (taskId: string, newValue: boolean) => void;
}

export function TaskNode({ data }: { data: TaskNodeData }) {
    const [productTitle, setProductTitle] = useState<string | undefined>();
    const [workingDirectory, setWorkingDirectory] = useState<string | undefined>();
    const [async, setAsync] = useState<boolean>(false);

    useEffect(() => {
        getProductByTaskUuid(data.taskId).then((product) => {
            if (product) {
                setProductTitle(product.title);
                setWorkingDirectory(product.workingDirectory);
            }
        });
    }, [data.taskId]);

    useEffect(() => {
        getTaskExecutionContext(data.taskId).then((context) => {
            if (context) {
                setAsync(context.async);
            }
        });
    }, [data.taskId]);
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

    const handleAsyncChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        data.onAsyncToggle(data.taskId, e.target.checked);
    };

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            className={`px-2 py-1 shadow-md rounded-md border-2 ${colors.background} ${colors.border} ${colors.text} ${colors.cursor}`}
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
            {productTitle && (
                <div className="text-[9px] opacity-60 mb-0.5 font-semibold">
                    {productTitle}
                    {workingDirectory && (
                        <span className="opacity-75 ml-1">
                            📁 [{workingDirectory}]
                        </span>
                    )}
                </div>
            )}
            <div className="text-xs font-medium leading-tight">
                {wrappedLabel}
            </div>
            <div className="flex items-center justify-center mt-0.5 gap-1" onClick={handleCheckboxClick}>
                <input
                    type="checkbox"
                    checked={async}
                    onChange={handleAsyncChange}
                    className="checkbox checkbox-xs"
                    title="Run in worktree (async)"
                />
                <span className="text-[10px] opacity-70">async</span>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                className="w-2 h-2"
            />
        </div>
    );
}
