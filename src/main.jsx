import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./legacy/index.css";
import "./design.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
