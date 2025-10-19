import { HashRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import "./index.css";

function Home() {
  return <div className="p-8">Home</div>;
}

function Configuration() {
  return <div className="p-8">Configuration</div>;
}

function TaskGraph() {
  return <div className="p-8">Task Graph</div>;
}

function TaskPanel() {
  return <div className="p-8">Task Panel</div>;
}

function Products() {
  return <div className="p-8">Products</div>;
}

export function App() {
  return (
    <HashRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/configuration" element={<Configuration />} />
        <Route path="/task-graph" element={<TaskGraph />} />
        <Route path="/task" element={<TaskPanel />} />
        <Route path="/products" element={<Products />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
