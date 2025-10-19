import { HashRouter, Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import "./index.css";
import { ProductsPanel } from "./products/products-panel";
import { ConfigurationPanel } from "./configuration/ConfigurationPanel";
import { TaskScreen } from "./detailed-planning/task-screen";
import { TaskGraph } from "./high-level-planning/task-graph";

function Home() {
  return <div className="p-8">Home</div>;
}

export function App() {
  return (
    <HashRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/configuration" element={<ConfigurationPanel />} />
        <Route path="/task-graph" element={<TaskGraph />} />
        <Route path="/task" element={<TaskScreen />} />
        <Route path="/products" element={<ProductsPanel />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
