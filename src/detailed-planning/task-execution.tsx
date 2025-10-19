import { useEffect, useState } from "react";
import type { Task } from "src/entities/tasks/types";
import {
    getTaskExecutionContext,
    setTaskExecutionContext,
    removeTaskExecutionContext,
    setFilesOnTaskExecutionContext,
} from "src/task-execution/task-execution-context-storage";
import {
    listDirectoryFiles,
    type DirectoryEntry,
} from "src/task-execution/directory-files";
import { TaskExecuteButton } from "@/components/shared/task-execute-button";

interface TaskExecutionProps {
    task: Task;
}

export function TaskExecution({ task }: TaskExecutionProps) {
    const [workingDirectory, setWorkingDirectory] = useState<string | null>(
        null,
    );
    const [isEditingDirectory, setIsEditingDirectory] = useState(false);
    const [editedDirectory, setEditedDirectory] = useState("");
    const [directoryFiles, setDirectoryFiles] = useState<DirectoryEntry[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [fileListError, setFileListError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [contextFiles, setContextFiles] = useState<string[]>([]);
    const [isAsync, setIsAsync] = useState(true);

    const loadDirectoryFiles = async (directory: string) => {
        if (!directory) {
            setDirectoryFiles([]);
            setSearchQuery("");
            return;
        }

        setIsLoadingFiles(true);
        setFileListError(null);
        try {
            const files = await listDirectoryFiles(directory);
            setDirectoryFiles(files);
        } catch (error) {
            console.error("Error loading directory files:", error);
            setFileListError(
                error instanceof Error
                    ? error.message
                    : "Failed to load directory files",
            );
            setDirectoryFiles([]);
        } finally {
            setIsLoadingFiles(false);
        }
    };

    useEffect(() => {
        getTaskExecutionContext(task.uuid).then((executionContext) => {
            const directory = executionContext?.workingDirectory || null;
            setWorkingDirectory(directory);
            setEditedDirectory(directory || "");
            setContextFiles(executionContext?.context || []);
            setIsAsync(executionContext?.async ?? true);
            if (directory) {
                loadDirectoryFiles(directory);
            }
        });
    }, [task]);

    // Working directory handlers
    const handleStartEditDirectory = () => {
        setIsEditingDirectory(true);
        setEditedDirectory(workingDirectory || "");
    };

    const handleCancelEditDirectory = () => {
        setIsEditingDirectory(false);
        setEditedDirectory(workingDirectory || "");
    };

    const handleSaveEditDirectory = async () => {
        const trimmedDirectory = editedDirectory.trim();
        if (trimmedDirectory !== workingDirectory) {
            if (trimmedDirectory) {
                await setTaskExecutionContext(
                    task.uuid,
                    trimmedDirectory,
                    contextFiles,
                    isAsync,
                );
                setWorkingDirectory(trimmedDirectory);
                await loadDirectoryFiles(trimmedDirectory);
            } else if (workingDirectory) {
                await removeTaskExecutionContext(task.uuid);
                setWorkingDirectory(null);
                setDirectoryFiles([]);
                setContextFiles([]);
            }
        }
        setIsEditingDirectory(false);
    };

    const handleRemoveDirectory = async () => {
        await removeTaskExecutionContext(task.uuid);
        setWorkingDirectory(null);
        setEditedDirectory("");
        setDirectoryFiles([]);
        setSearchQuery("");
        setContextFiles([]);
        setIsAsync(true);
    };

    const handleToggleFileInContext = async (filePath: string) => {
        const newContextFiles = contextFiles.includes(filePath)
            ? contextFiles.filter((f) => f !== filePath)
            : [...contextFiles, filePath];

        await setFilesOnTaskExecutionContext(task.uuid, newContextFiles);
        setContextFiles(newContextFiles);
    };

    const handleToggleAsync = async (checked: boolean) => {
        setIsAsync(checked);
        if (workingDirectory) {
            await setTaskExecutionContext(
                task.uuid,
                workingDirectory,
                contextFiles,
                checked,
            );
        }
    };

    const filteredFiles = directoryFiles.filter((entry) =>
        entry.relativePath.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
        <div>
            <h3 className="text-lg font-semibold mb-3">Task Execution</h3>
            <div className="mb-2">
                Working Directory:
                {isEditingDirectory ? (
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="text"
                            value={editedDirectory}
                            onChange={(e) => setEditedDirectory(e.target.value)}
                            className="input input-sm input-bordered font-mono flex-1"
                            placeholder="Enter working directory path"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter")
                                    handleSaveEditDirectory();
                                if (e.key === "Escape")
                                    handleCancelEditDirectory();
                            }}
                        />
                        <button
                            className="btn btn-xs btn-primary"
                            onClick={handleSaveEditDirectory}
                        >
                            Save
                        </button>
                        <button
                            className="btn btn-xs btn-outline"
                            onClick={handleCancelEditDirectory}
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mt-1">
                        {workingDirectory ? (
                            <>
                                <span
                                    className="font-mono text-sm bg-gray-100 px-2 py-1 rounded cursor-pointer hover:bg-gray-200"
                                    onClick={handleStartEditDirectory}
                                    title="Click to edit working directory"
                                >
                                    {workingDirectory}
                                </span>
                                <button
                                    className="btn btn-xs btn-outline btn-warning"
                                    onClick={handleRemoveDirectory}
                                    title="Remove working directory"
                                >
                                    Remove
                                </button>
                            </>
                        ) : (
                            <button
                                className="btn btn-xs btn-outline"
                                onClick={handleStartEditDirectory}
                            >
                                Set Working Directory
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className="mb-2">
                <label className="cursor-pointer label justify-start gap-2">
                    <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={isAsync}
                        onChange={(e) => handleToggleAsync(e.target.checked)}
                    />
                    <span className="label-text text-sm">
                        Run in worktree (async)
                    </span>
                </label>
            </div>
            <div className="mb-4">
                <TaskExecuteButton
                    task={task}
                    buttonClassName="btn btn-primary btn-sm mr-2"
                />
            </div>

            {workingDirectory && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-md font-medium">
                            Working Directory Files
                        </h4>
                        <button
                            className="btn btn-xs btn-outline"
                            onClick={() => loadDirectoryFiles(workingDirectory)}
                            disabled={isLoadingFiles}
                        >
                            {isLoadingFiles ? "Loading..." : "Refresh"}
                        </button>
                    </div>

                    {directoryFiles.length > 0 && (
                        <div className="mb-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input input-sm input-bordered w-full"
                                placeholder="Search files..."
                            />
                        </div>
                    )}

                    {fileListError && (
                        <div className="alert alert-warning text-sm mb-2">
                            <span>⚠️ {fileListError}</span>
                        </div>
                    )}

                    {isLoadingFiles ? (
                        <div className="text-sm text-gray-500">
                            Loading files...
                        </div>
                    ) : directoryFiles.length > 0 ? (
                        filteredFiles.length > 0 ? (
                            <div className="bg-gray-50 rounded p-3 max-h-60 overflow-y-auto">
                                <div className="grid gap-1">
                                    {filteredFiles.map((entry, index) => {
                                        const isInContext =
                                            contextFiles.includes(
                                                entry.relativePath,
                                            );
                                        return (
                                            <div
                                                key={`${entry.relativePath}-${index}`}
                                                className={`flex items-center gap-2 text-sm font-mono p-1 rounded cursor-pointer hover:bg-gray-100 ${
                                                    isInContext
                                                        ? "bg-blue-50 border border-blue-200"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    handleToggleFileInContext(
                                                        entry.relativePath,
                                                    )
                                                }
                                                title={
                                                    isInContext
                                                        ? "Click to remove from context"
                                                        : "Click to add to context"
                                                }
                                            >
                                                <span className="text-gray-400 w-4">
                                                    {entry.kind === "directory"
                                                        ? "📁"
                                                        : "📄"}
                                                </span>
                                                <span
                                                    className={
                                                        entry.kind ===
                                                        "directory"
                                                            ? "text-blue-600 font-medium"
                                                            : "text-gray-700"
                                                    }
                                                >
                                                    {entry.relativePath}
                                                </span>
                                                {isInContext && (
                                                    <span className="ml-auto text-blue-500 text-xs">
                                                        ✓
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 italic">
                                No files match your search
                            </div>
                        )
                    ) : workingDirectory &&
                      !isLoadingFiles &&
                      !fileListError ? (
                        <div className="text-sm text-gray-500 italic">
                            No files found in directory
                        </div>
                    ) : null}
                </div>
            )}

            {contextFiles.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-md font-medium mb-2">
                        Task Execution Context Files
                    </h4>
                    <div className="bg-blue-50 rounded p-3 border border-blue-200">
                        <div className="grid gap-1">
                            {contextFiles.map((filePath, index) => (
                                <div
                                    key={`context-${filePath}-${index}`}
                                    className="flex items-center gap-2 text-sm font-mono p-1 rounded hover:bg-blue-100 cursor-pointer"
                                    onClick={() =>
                                        handleToggleFileInContext(filePath)
                                    }
                                    title="Click to remove from context"
                                >
                                    <span className="text-gray-400 w-4">
                                        📄
                                    </span>
                                    <span className="text-gray-700">
                                        {filePath}
                                    </span>
                                    <span className="ml-auto text-red-500 text-xs hover:text-red-700">
                                        ✕
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
