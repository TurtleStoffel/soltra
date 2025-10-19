import {
    getDirectoryHandle,
    DirectoryHandleType,
} from "src/persistence/file-system-handles";

export interface DirectoryEntry {
    name: string;
    kind: "file" | "directory";
    relativePath: string;
}

/**
 * Lists all files and directories in the given working directory using the CODING_DIR handle
 */
export async function listDirectoryFiles(
    workingDirectory: string,
): Promise<DirectoryEntry[]> {
    try {
        const codingDirHandle = await getDirectoryHandle(
            DirectoryHandleType.CODING_DIR,
        );
        if (!codingDirHandle) {
            throw new Error(
                "No coding directory configured. Please set up the coding directory in settings.",
            );
        }

        // Navigate to the working directory from the coding directory
        const targetDirHandle = await navigateToDirectory(
            codingDirHandle,
            workingDirectory,
        );
        if (!targetDirHandle) {
            return [];
        }

        const entries: DirectoryEntry[] = [];

        // Recursively collect files and directories
        await collectEntries(targetDirHandle, entries, "");

        // Sort all entries alphabetically by full path
        entries.sort((a, b) => {
            return a.relativePath.localeCompare(b.relativePath, undefined, {
                numeric: true,
                sensitivity: "base",
            });
        });

        return entries;
    } catch (error) {
        console.error("Error listing directory files:", error);
        throw error;
    }
}

/**
 * Navigate to a target directory from a base directory handle
 */
async function navigateToDirectory(
    baseDirHandle: FileSystemDirectoryHandle,
    targetPath: string,
): Promise<FileSystemDirectoryHandle | null> {
    try {
        let currentHandle = baseDirHandle;

        // Handle absolute paths and relative paths
        const normalizedPath = targetPath.replace(/\\/g, "/");
        const pathParts = normalizedPath
            .split("/")
            .filter((part) => part.length > 0);

        for (const part of pathParts) {
            if (part === "." || part === "") continue;
            if (part === "..") {
                // Can't navigate up from base directory in this context
                continue;
            }

            try {
                currentHandle = await currentHandle.getDirectoryHandle(part);
            } catch (error) {
                // Directory doesn't exist or no permission
                console.warn(`Could not access directory: ${part}`);
                return null;
            }
        }

        return currentHandle;
    } catch (error) {
        console.error("Error navigating to directory:", error);
        return null;
    }
}

/**
 * Recursively collect all entries in a directory
 */
async function collectEntries(
    dirHandle: FileSystemDirectoryHandle,
    entries: DirectoryEntry[],
    basePath: string,
): Promise<void> {
    try {
        for await (const [name, handle] of dirHandle.entries()) {
            // Skip hidden files and common ignore patterns
            if (
                name.startsWith(".") ||
                name === "node_modules" ||
                name === ".git"
            ) {
                continue;
            }

            const relativePath = basePath ? `${basePath}/${name}` : name;

            if (handle.kind === "file") {
                entries.push({
                    name,
                    kind: "file",
                    relativePath,
                });
            } else if (handle.kind === "directory") {
                entries.push({
                    name,
                    kind: "directory",
                    relativePath,
                });

                // Recursively collect entries from subdirectories
                await collectEntries(
                    handle as FileSystemDirectoryHandle,
                    entries,
                    relativePath,
                );
            }
        }
    } catch (error) {
        console.error(`Error reading directory contents:`, error);
    }
}
