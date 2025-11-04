import { serve } from "bun";
import index from "./index.html";
import { startScriptHandler } from "./task-execution/handlers/start-script";
import { deleteWorktreeHandler } from "./task-execution/handlers/delete-worktree";

const server = serve({
    routes: {
        // Serve index.html for all unmatched routes.
        "/*": index,

        "/api/hello": {
            async GET(req) {
                return Response.json({
                    message: "Hello, world!",
                    method: "GET",
                });
            },
            async PUT(req) {
                return Response.json({
                    message: "Hello, world!",
                    method: "PUT",
                });
            },
        },

        "/api/hello/:name": async (req) => {
            const name = req.params.name;
            return Response.json({
                message: `Hello, ${name}!`,
            });
        },

        // Task execution endpoints
        "/start-script": {
            async POST(req) {
                return await startScriptHandler(req);
            },
        },

        "/worktree/:worktree": {
            async DELETE(req) {
                const worktree = req.params.worktree;
                return await deleteWorktreeHandler(req, worktree);
            },
        },
    },

    development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,

        // Echo console logs from the browser to the server
        console: true,
    },
});

console.log(`🚀 Server running at ${server.url}`);
