import { Link } from "react-router-dom";
import { useMemo } from "react";

export function Header() {
    const envConfig = useMemo(() => {
        const mode = process.env.NODE_ENV || "Not configured";
        const label = mode.toUpperCase();

        let className = "ml-2 px-2 py-1 text-xs font-medium rounded-full";

        if (mode === "staging") {
            className += " bg-orange-500 text-white";
        } else if (mode === "development") {
            className += " bg-blue-500 text-white";
        } else if (mode === "production") {
            className += " bg-green-500 text-white";
        } else {
            className += " bg-gray-600 text-white";
        }

        return { label, className };
    }, []);

    return (
        <header>
            <div className="navbar bg-base-200 shadow-md">
                <div className="flex-1">
                    <Link
                        to="/"
                        className="btn btn-ghost text-2xl font-bold normal-case"
                    >
                        Soltra
                        <span className={envConfig.className}>
                            {envConfig.label}
                        </span>
                    </Link>
                </div>
                <div className="flex-none">
                    <ul className="menu menu-horizontal px-1">
                        <li>
                            <Link to="/configuration">Config</Link>
                        </li>
                        <li>
                            <Link to="/task-graph">Task Graph</Link>
                        </li>
                        <li>
                            <Link to="/task">Task Panel</Link>
                        </li>
                        <li>
                            <Link to="/products">Products</Link>
                        </li>
                    </ul>
                </div>
            </div>
        </header>
    );
}
