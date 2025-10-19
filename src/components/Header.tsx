import { Link } from "react-router-dom";

export function Header() {
  return (
    <header>
      <div className="navbar bg-base-200 shadow-md">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost text-2xl font-bold normal-case">
            Soltra
            <span
              id="env-indicator"
              className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-gray-600 text-white"
            ></span>
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
