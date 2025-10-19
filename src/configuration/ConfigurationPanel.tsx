import { useState, useEffect } from "react";
import {
    DirectoryHandleType,
    getDirectoryHandle,
    setDirectoryHandle,
} from "../persistence/file-system-handles";

interface DirectoryState {
    [key: string]: string;
}

export function ConfigurationPanel() {
    const [directories, setDirectories] = useState<DirectoryState>({});

    // Load existing directory handles on mount
    useEffect(() => {
        async function loadDirectories() {
            const state: DirectoryState = {};
            for (const [key, value] of Object.entries(DirectoryHandleType)) {
                const handle = await getDirectoryHandle(value);
                if (handle) {
                    state[key] = handle.name;
                }
            }
            setDirectories(state);
        }
        loadDirectories();
    }, []);

    const handlePickDirectory = async (key: string, value: string) => {
        try {
            // @ts-expect-error: showDirectoryPicker is not in TS lib yet
            const dirHandle = await window.showDirectoryPicker({
                id: `${key.toLowerCase()}-folder`,
                mode: "readwrite",
            });

            await setDirectoryHandle(value, dirHandle);
            setDirectories((prev) => ({
                ...prev,
                [key]: dirHandle.name,
            }));
        } catch {
            // User cancelled
        }
    };

    const formatLabel = (key: string) => {
        return key
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    return (
        <div className="p-8">
            <h2 className="text-xl font-semibold mb-4">Configuration</h2>

            {Object.entries(DirectoryHandleType).map(([key, value]) => (
                <div key={key} className="mb-4">
                    <button
                        onClick={() => handlePickDirectory(key, value)}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        Pick {formatLabel(key)} Folder
                    </button>
                    {directories[key] && (
                        <span className="badge badge-info ml-4 text-base">
                            {directories[key]}
                        </span>
                    )}
                </div>
            ))}

            <div className="mt-6 p-4 bg-base-200 rounded">
                <div className="text-sm">
                    <p>
                        <strong>Note:</strong> The Data Dir folder will contain
                        standardized JSON files:
                    </p>
                    <ul className="list-disc ml-6 mt-2">
                        <li>tasks.json</li>
                        <li>products.json</li>
                        <li>task-execution-contexts.json</li>
                        <li>task-inbox.json</li>
                    </ul>
                    <p className="mt-2">
                        These files will be created automatically when needed.
                    </p>
                </div>
            </div>
        </div>
    );
}
