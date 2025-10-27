/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerWorktreeCleanupCallback } from "./task-execution/task-execution-service";
import { registerWorkstreamTaskCleanupCallback } from "./entities/workstreams/workstream-hooks";

// Register task status change callbacks
registerWorktreeCleanupCallback();

// Register task deletion callbacks
registerWorkstreamTaskCleanupCallback();

function start() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<App />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
