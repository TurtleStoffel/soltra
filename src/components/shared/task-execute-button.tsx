import { useState } from "react";
import { updateTask } from "src/entities/tasks/task-service";
import type { Task } from "src/entities/tasks/types";
import { executeTask } from "src/task-execution/task-execution-logic";
import { getTaskExecutionContext } from "src/task-execution/task-execution-context-storage";

interface TaskExecuteButtonProps {
    task: Task;
    buttonClassName?: string;
}

export function TaskExecuteButton({
    task,
    buttonClassName = "btn btn-primary btn-sm",
}: TaskExecuteButtonProps) {
    const [isExecuting, setIsExecuting] = useState(false);
    const [executeError, setExecuteError] = useState<string | null>(null);
    const [executeSuccess, setExecuteSuccess] = useState(false);

    const handleExecuteTask = async () => {
        setIsExecuting(true);
        setExecuteError(null);
        setExecuteSuccess(false);

        try {
            // Update task status to 'In Progress'
            const updatedTask = { ...task, status: "In Progress" as const };
            await updateTask(updatedTask);

            const taskExecutionContext = await getTaskExecutionContext(
                task.uuid,
            );
            const taskWorkingDirectory =
                taskExecutionContext?.workingDirectory || null;

            const result = await executeTask(
                task,
                taskWorkingDirectory,
                taskExecutionContext?.context || [],
                taskExecutionContext?.async ?? false,
            );
            if (result.success) {
                setExecuteSuccess(true);
            } else {
                setExecuteError(result.error || "Failed to execute task");
            }
        } catch (error) {
            setExecuteError(
                error instanceof Error
                    ? error.message
                    : "Failed to execute task",
            );
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <>
            <button
                className={buttonClassName}
                onClick={handleExecuteTask}
                disabled={isExecuting}
                title="Execute Task"
            >
                {isExecuting ? "Executing..." : "Execute"}
            </button>
            {executeSuccess && (
                <span className="text-success ml-2">Executed!</span>
            )}
            {executeError && (
                <span className="text-error ml-2">{executeError}</span>
            )}
        </>
    );
}
