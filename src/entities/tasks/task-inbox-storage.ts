import {
    readFile,
    writeFile,
    DataFileName,
} from "src/persistence/file-system-handles";

export interface InboxTask {
    title: string;
}

export async function loadInboxTasks(): Promise<InboxTask[]> {
    const text = await readFile(DataFileName.TASK_INBOX);
    if (!text) {
        console.log("[task-inbox-storage] loadInboxTasks: No file found, returning empty array");
        return [];
    }

    const taskTitles = JSON.parse(text);
    if (Array.isArray(taskTitles)) {
        const tasks = taskTitles.map((title) => ({
            title: title,
        }));
        console.log(`[task-inbox-storage] loadInboxTasks: Loaded ${tasks.length} inbox tasks`);
        return tasks;
    }
    throw new Error("Invalid task inbox file format");
}

export async function storeInboxTasks(tasks: InboxTask[]): Promise<void> {
    const taskTitles = tasks.map((task) => task.title);
    console.log(`[task-inbox-storage] storeInboxTasks: Saving ${tasks.length} inbox tasks`);
    await writeFile(
        DataFileName.TASK_INBOX,
        JSON.stringify(taskTitles, null, 2),
    );
}

export async function addInboxTask(task: InboxTask): Promise<InboxTask> {
    const existingTasks = await loadInboxTasks();
    const updatedTasks = [...existingTasks, task];
    await storeInboxTasks(updatedTasks);

    return task;
}

export async function updateInboxTask(
    originalTitle: string,
    updatedTask: InboxTask,
): Promise<void> {
    const tasks = await loadInboxTasks();
    const taskIndex = tasks.findIndex((t) => t.title === originalTitle);

    if (taskIndex === -1) {
        throw new Error(`Task with title "${originalTitle}" not found`);
    }

    tasks[taskIndex] = updatedTask;
    await storeInboxTasks(tasks);
}

export async function removeInboxTask(taskTitle: string): Promise<void> {
    const tasks = await loadInboxTasks();
    const filteredTasks = tasks.filter((t) => t.title !== taskTitle);
    await storeInboxTasks(filteredTasks);
}
