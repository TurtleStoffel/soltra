import { useEffect, useState } from "react";
import {
    loadInboxTasks,
    removeInboxTask,
    type InboxTask,
} from "src/entities/tasks/task-inbox-storage";
import {
    convertInboxTaskToTask,
    renameInboxTask,
} from "src/entities/tasks/task-inbox-service";

export function TaskInbox() {
    const [tasks, setTasks] = useState<InboxTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingTask, setEditingTask] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    useEffect(() => {
        fetchTasks();
    }, []);

    async function fetchTasks() {
        setLoading(true);
        const loadedTasks = await loadInboxTasks();
        setTasks(loadedTasks);
        setLoading(false);
    }

    async function handleRemoveTask(taskTitle: string) {
        try {
            await removeInboxTask(taskTitle);
            await fetchTasks();
        } catch (error) {
            console.error("Error removing task:", error);
        }
    }

    async function handleCreateTask(inboxTask: InboxTask) {
        try {
            await convertInboxTaskToTask(inboxTask);
            await fetchTasks();
        } catch (error) {
            console.error("Error creating task:", error);
        }
    }

    function handleStartEdit(task: InboxTask) {
        setEditingTask(task.title);
        setEditValue(task.title);
    }

    function handleCancelEdit() {
        setEditingTask(null);
        setEditValue("");
    }

    async function handleSaveEdit() {
        if (!editingTask || !editValue.trim()) return;

        try {
            await renameInboxTask(editingTask, editValue.trim());
            setEditingTask(null);
            setEditValue("");
            await fetchTasks();
        } catch (error) {
            console.error("Error renaming task:", error);
        }
    }

    function handleKeyPress(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            handleSaveEdit();
        } else if (e.key === "Escape") {
            handleCancelEdit();
        }
    }

    if (loading) {
        return <div className="text-gray-400">Loading tasks...</div>;
    }

    if (tasks.length === 0) {
        return (
            <div className="text-center text-gray-400 py-8">
                <p>No inbox tasks found.</p>
                <p className="text-sm mt-2">
                    Configure the Task Inbox file to get started.
                </p>
            </div>
        );
    }

    const sortedTasks = tasks.sort((a, b) => a.title.localeCompare(b.title));

    return (
        <div className="space-y-6">
            <div className="text-center text-gray-500 mb-4">
                <p>
                    Select a task from the search above or browse inbox tasks
                    below.
                </p>
            </div>

            <div>
                <h3 className="text-md font-semibold mb-3">Inbox Tasks</h3>
                <div className="grid gap-2">
                    {sortedTasks.map((task) => (
                        <div
                            key={task.title}
                            className="card bg-base-200 p-3 flex flex-row justify-between items-center"
                        >
                            {editingTask === task.title ? (
                                <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) =>
                                        setEditValue(e.target.value)
                                    }
                                    onKeyDown={handleKeyPress}
                                    className="input input-sm flex-1 mr-2"
                                    autoFocus
                                />
                            ) : (
                                <div className="font-medium flex-1">
                                    {task.title}
                                </div>
                            )}
                            <div className="flex gap-2">
                                {editingTask === task.title ? (
                                    <>
                                        <button
                                            className="btn btn-sm btn-success"
                                            onClick={handleSaveEdit}
                                            title="Save changes"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={handleCancelEdit}
                                            title="Cancel editing"
                                        >
                                            ✕
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={() =>
                                                handleStartEdit(task)
                                            }
                                            title="Rename task"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() =>
                                                handleCreateTask(task)
                                            }
                                            title="Create task"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            className="btn btn-sm btn-error"
                                            onClick={() =>
                                                handleRemoveTask(task.title)
                                            }
                                            title="Remove task"
                                        >
                                            ✕
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
