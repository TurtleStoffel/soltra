import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TaskSelector } from "./task-selector.tsx";
import { TaskDetails } from "./task-details.tsx";
import { TaskInbox } from "./task-inbox.tsx";
import { createTask, loadTasks } from "src/entities/tasks/task-file-storage.ts";
import type { Task } from "src/entities/tasks/types.ts";

export function TaskScreen({ taskId }: { taskId?: string }) {
    const navigate = useNavigate();
    const [selectedTask, setSelectedTask] = useState<Task | undefined>(
        undefined,
    );

    useEffect(() => {
        async function fetchTasks() {
            const loadedTasks = await loadTasks();
            setSelectedTask(loadedTasks.find((t) => t.uuid === taskId));
        }
        fetchTasks();
    }, [taskId]);

    const handleUpdate = useCallback(async () => {
        const updatedTasks = await loadTasks();
        setSelectedTask(updatedTasks.find((t) => t.uuid === taskId));
    }, [taskId]);

    const handleCreateTask = useCallback(async () => {
        const title = prompt("Enter task title:");
        if (!title) return;

        const description = prompt("Enter task description (optional):") || "";

        const newTask = await createTask(title, description);
        setSelectedTask(newTask);

        // Navigate to the new task
        navigate(`/task/${newTask.uuid}`);
    }, [navigate]);

    return (
        <div className="p-4">
            <h2 className="text-lg font-bold mb-2">Task Panel</h2>
            <div id="taskPanelTaskSelector">
                <TaskSelector />
            </div>
            <button
                onClick={handleCreateTask}
                className="btn btn-primary btn-sm mb-4"
            >
                + Create New Task
            </button>
            <div id="taskPanelTaskDetails">
                {selectedTask ? (
                    <TaskDetails task={selectedTask} onUpdate={handleUpdate} />
                ) : (
                    <TaskInbox />
                )}
            </div>
        </div>
    );
}
