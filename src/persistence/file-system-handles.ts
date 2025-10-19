import { set, get } from "idb-keyval";

export const DirectoryHandleType = {
    CONTENT_DIR: "contentDirHandle",
    PRIMARY_DIR: "primaryDirHandle",
    CODING_DIR: "codingDirHandle",
    DATA_DIR: "dataDirHandle",
} as const;
export type DirectoryHandleType =
    (typeof DirectoryHandleType)[keyof typeof DirectoryHandleType];

// Standardized file names for each type
export const DataFileName = {
    TASK: "tasks.json",
    TASK_EXECUTION_CONTEXT: "task-execution-contexts.json",
    TASK_INBOX: "task-inbox.json",
    PRODUCT: "products.json",
    WORKSTREAM: "workstreams.json",
} as const;
export type DataFileName = (typeof DataFileName)[keyof typeof DataFileName];

export async function getDirectoryHandle(
    type: DirectoryHandleType,
): Promise<FileSystemDirectoryHandle | null> {
    const handle = await get(type);
    if (!handle) {
        return null;
    }

    // Check if we still have permission to access the directory
    const permission = await handle.queryPermission({ mode: "read" });
    if (permission === "denied") {
        throw new Error(`Permission denied for directory handle ${type}`);
    }

    // Request permission if needed
    if (permission === "prompt") {
        const newPermission = await handle.requestPermission({
            mode: "readwrite",
        });
        if (newPermission === "denied") {
            throw new Error(`Permission denied for directory handle ${type}`);
        }
    }

    return handle;
}

export async function setDirectoryHandle(
    type: DirectoryHandleType,
    handle: FileSystemDirectoryHandle,
): Promise<void> {
    await set(type, handle);
}

export async function readFile(fileName: DataFileName): Promise<string | null> {
    const fileHandle = await getDataFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return text.trim() === "" ? null : text;
}

export async function writeFile(
    fileName: DataFileName,
    content: string,
): Promise<void> {
    const fileHandle = await getDataFileHandle(fileName);
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

async function getDataFileHandle(
    fileName: DataFileName,
): Promise<FileSystemFileHandle> {
    const dirHandle = await getDirectoryHandle(DirectoryHandleType.DATA_DIR);
    if (!dirHandle) {
        throw new Error(
            `No data directory configured. Please set up the data directory in settings.`,
        );
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, {
        create: true,
    });

    // Check if we still have permission to access the file
    const permission = await fileHandle.queryPermission({ mode: "readwrite" });
    if (permission === "denied") {
        throw new Error(`Permission denied for file ${fileName}`);
    }

    // Request permission if needed
    if (permission === "prompt") {
        const newPermission = await fileHandle.requestPermission({
            mode: "readwrite",
        });
        if (newPermission === "denied") {
            throw new Error(`Permission denied for file ${fileName}`);
        }
    }

    return fileHandle;
}
