import { spawn } from "bun";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { CONFIG } from "@/config";

export interface StartScriptRequest {
    argument: string;
    workingDirectory: string;
    worktree?: string;
}

/**
 * Handler for the /start-script endpoint
 * Starts Claude in a new terminal window with the specified arguments
 */
export async function startScriptHandler(req: Request): Promise<Response> {
    let body: StartScriptRequest;

    try {
        body = await req.json();
    } catch {
        return Response.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const { argument, workingDirectory, worktree } = body;

    // Validation
    if (typeof argument !== "string") {
        return Response.json(
            { error: "Argument must be a string." },
            { status: 400 }
        );
    }
    if (typeof workingDirectory !== "string") {
        return Response.json(
            { error: "Working directory must be a string." },
            { status: 400 }
        );
    }

    let targetWorkingDir = resolve(CONFIG.ROOT_CODE_DIR, workingDirectory);

    // Check if the working directory exists
    if (!existsSync(targetWorkingDir)) {
        return Response.json(
            { error: `Working directory does not exist: ${targetWorkingDir}` },
            { status: 400 }
        );
    }

    // If worktree is specified, create it and use it as the working directory
    if (worktree && typeof worktree === "string") {
        const worktreeDir = resolve(
            CONFIG.ROOT_CODE_DIR,
            `${workingDirectory}-worktrees`,
            worktree
        );

        // Run script to create worktree
        const createWorktreeScript = join(
            import.meta.dir,
            "..",
            "scripts",
            "create-worktree.sh"
        );

        try {
            const proc = spawn([
                "bash",
                createWorktreeScript,
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
                        error: "Failed to create worktree",
                        details: `Script exited with code ${proc.exitCode}`,
                    },
                    { status: 500 }
                );
            }

            targetWorkingDir = worktreeDir;
        } catch (error) {
            return Response.json(
                {
                    error: "Failed to create worktree",
                    details: error instanceof Error ? error.message : String(error),
                },
                { status: 500 }
            );
        }
    }

    // Modify argument if worktree is used - add commit and PR instructions
    let finalArgument = argument;
    if (worktree) {
        finalArgument = `${argument}. When you are done, create a commit and push it to the remote using the gh CLI. If there is no PR yet, create a PR to the main branch too.`;
    }

    console.log(`Opening new terminal window with claude argument: "${finalArgument}"`);
    console.log(`Working directory: ${targetWorkingDir}`);

    // Open new terminal window and run claude in it
    const script = `tell application "Terminal"
    do script "cd '${targetWorkingDir.replace(/'/g, "'\\''")}' && claude '${finalArgument.replace(/'/g, "'\\''")}'\"
    activate
  end tell`;

    try {
        const proc = spawn(["osascript", "-e", script], {
            stdout: "pipe",
            stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        await proc.exited;

        console.log(`Claude process exited with code: ${proc.exitCode}`);

        return Response.json({
            message: "Claude process completed",
            exitCode: proc.exitCode,
            command: `claude "${argument}"`,
            stdout: stdout,
            stderr: stderr,
        });
    } catch (error) {
        console.error("Process error:", error);
        return Response.json(
            {
                error: "Failed to start claude",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
