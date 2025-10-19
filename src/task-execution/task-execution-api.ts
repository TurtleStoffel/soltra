import { CONFIG } from "@/config";

export interface StartScriptRequest {
    argument: string;
    workingDirectory: string;
    worktree?: string;
}

export interface DeleteWorktreeRequest {
    workingDirectory: string;
}

export async function startScript(
    request: StartScriptRequest,
): Promise<Response> {
    return await fetch(`${CONFIG.TASK_EXECUTION_SERVER_URL}/start-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });
}

export async function deleteWorktree(
    worktree: string,
    request: DeleteWorktreeRequest,
): Promise<Response> {
    return await fetch(
        `${CONFIG.TASK_EXECUTION_SERVER_URL}/worktree/${worktree}`,
        {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
        },
    );
}
