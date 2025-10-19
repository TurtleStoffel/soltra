import { fuzzyMatch } from "@/components/shared/fuzzy-search";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadTasks } from "src/entities/tasks/task-file-storage";
import type { Task } from "src/entities/tasks/types";

export const TaskSelector: React.FC<unknown> = () => {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [query, setQuery] = useState("");
    const [filtered, setFiltered] = useState<Task[]>([]);

    useEffect(() => {
        loadTasks().then((loaded) => {
            setTasks(loaded);
        });
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setFiltered([]);
        } else {
            setFiltered(tasks.filter((n) => fuzzyMatch(n.title, query)));
        }
    }, [query, tasks]);

    if (tasks.length === 0) {
        return <div className="p-4">No tasks found.</div>;
    }

    return (
        <div>
            <input
                className="input input-bordered input-sm w-full"
                placeholder="Fuzzy search tasks..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                data-testid="taskPanelTaskFuzzySearch"
            />
            <ul
                className="menu bg-base-100 w-full rounded-box mt-1"
                data-testid="taskPanelTaskFuzzyResults"
            >
                {query.trim() ? (
                    filtered.length ? (
                        filtered.map((n) => (
                            <li key={n.uuid}>
                                <button
                                    className="btn btn-ghost btn-sm w-full text-left"
                                    onClick={() => navigate(`/task/${n.uuid}`)}
                                >
                                    {n.title}
                                </button>
                            </li>
                        ))
                    ) : (
                        <li className="text-gray-400 px-2">No matches</li>
                    )
                ) : null}
            </ul>
        </div>
    );
};
