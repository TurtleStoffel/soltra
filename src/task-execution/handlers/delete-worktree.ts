import { spawn } from "bun";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { CONFIG } from "@/config";

export interface DeleteWorktreeRequest {
    workingDirectory: string;
}

/**
 * Handler for the DELETE /worktree/:worktree endpoint
 * Removes a git worktree
 */
export async function deleteWorktreeHandler(
    req: Request,
    worktree: string
): Promise<Response> {
    let body: DeleteWorktreeRequest;

    try {
        body = await req.json();
    } catch {
        return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const { workingDirectory } = body;

    // Validation
    if (!worktree || typeof worktree !== "string") {
        return Response.json(
            { error: "Worktree name must be provided as a URL parameter." },
            { status: 400 }
        );
    }

    if (!workingDirectory || typeof workingDirectory !== "string") {
        return Response.json(
            { error: "Working directory must be provided in request body." },
            { status: 400 }
        );
    }

    const targetWorkingDir = resolve(CONFIG.ROOT_CODE_DIR, workingDirectory);
    const worktreeDir = resolve(
        CONFIG.ROOT_CODE_DIR,
        `${workingDirectory}-worktrees`,
        worktree
    );

    // Check if the working directory exists
    if (!existsSync(targetWorkingDir)) {
        return Response.json(
            { error: `Working directory does not exist: ${targetWorkingDir}` },
            { status: 400 }
        );
    }

    // Run script to remove worktree
    const removeWorktreeScript = join(
        import.meta.dir,
        "..",
        "scripts",
        "remove-worktree.sh"
    );

    try {
        const proc = spawn([
            "bash",
            removeWorktreeScript,
            targetWorkingDir,
            worktreeDir,
        ], {
            stdout: "inherit",
            stderr: "inherit",
        });

        await proc.exited;

        if (proc.exitCode !== 0) {
            return Response.json(
                {
                    error: "Failed to remove worktree",
                    details: `Script exited with code ${proc.exitCode}`,
                },
                { status: 500 }
            );
        }

        return Response.json({
            message: "Worktree removed successfully",
            worktree: worktree,
            workingDirectory: workingDirectory,
        });
    } catch (error) {
        return Response.json(
            {
                error: "Failed to remove worktree",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
