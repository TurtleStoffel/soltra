export type TaskStatus =
    | "Triage"
    | "Ready"
    | "In Progress"
    | "In Review"
    | "Done";

export interface Task {
    uuid: string;
    title: string;
    description: string;
    status: TaskStatus;
}
