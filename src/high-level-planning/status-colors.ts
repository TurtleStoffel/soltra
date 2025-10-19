import type { TaskStatus } from "src/entities/tasks/types";

export function getStatusColors(status?: TaskStatus) {
    switch (status) {
        case "Triage":
            return {
                background: "bg-gradient-to-r from-gray-500 to-gray-600",
                border: "border-gray-400",
                text: "text-white",
                cursor: "cursor-grab active:cursor-grabbing hover:bg-gray-500",
            };
        case "Ready":
            return {
                background: "bg-gradient-to-r from-blue-500 to-blue-600",
                border: "border-blue-400",
                text: "text-white",
                cursor: "cursor-grab active:cursor-grabbing hover:bg-blue-500",
            };
        case "In Progress":
            return {
                background: "bg-gradient-to-r from-yellow-500 to-yellow-600",
                border: "border-yellow-400",
                text: "text-black",
                cursor: "cursor-grab active:cursor-grabbing hover:bg-yellow-500",
            };
        case "In Review":
            return {
                background: "bg-gradient-to-r from-orange-500 to-orange-600",
                border: "border-orange-400",
                text: "text-white",
                cursor: "cursor-grab active:cursor-grabbing hover:bg-orange-500",
            };
        case "Done":
            return {
                background: "bg-gradient-to-r from-green-500 to-green-600",
                border: "border-green-400",
                text: "text-white",
                cursor: "cursor-grab active:cursor-grabbing hover:bg-green-500",
            };
        default:
            return {
                background: "bg-slate-700",
                border: "border-cyan-400",
                text: "text-white",
                cursor: "cursor-grab active:cursor-grabbing hover:bg-slate-600",
            };
    }
}
