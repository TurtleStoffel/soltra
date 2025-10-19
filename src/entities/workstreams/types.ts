export interface Workstream {
    uuid: string;
    title: string;
    description: string;
    tasks: string[]; // Array of UUIDs of tasks in this workstream
    dependencies: WorkstreamDependency[]; // All task dependencies within this workstream
}

export interface WorkstreamDependency {
    fromTaskUuid: string; // The task that must be completed first
    toTaskUuid: string; // The task that depends on the first task
    type: DependencyType;
}

export type DependencyType =
    | "blocks" // fromTask blocks toTask (toTask cannot start until fromTask is done)
    | "related"; // fromTask and toTask are related but not blocking
