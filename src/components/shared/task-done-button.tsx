import { useNavigate } from "react-router-dom";
import { removeTask } from "src/entities/tasks/task-service";
import type { Task } from "src/entities/tasks/types";

interface TaskDoneButtonProps {
    task: Task;
}

export function TaskDoneButton({ task }: TaskDoneButtonProps) {
    const navigate = useNavigate();

    const handleDoneTask = async () => {
        await removeTask(task.uuid);
        navigate("/task");
    };

    return (
        <button
            className="btn btn-xs ml-2 btn-error hover:btn-error"
            onClick={handleDoneTask}
            title="Mark task as done"
        >
            Done
        </button>
    );
}
