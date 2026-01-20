// zaad-bakery/frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; // استيراد الـ Tailwind CSS
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

window.addEventListener("error", (e) => {
  console.error("Window error:", e.error || e.message || e);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason || e);
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
