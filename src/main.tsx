import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import Landing from "./Landing";
import "./styles.css";
import "./landing.css";

// The landing never mounts wallet providers or discovery hooks.
const DashboardRoot = lazy(() => import("./DashboardRoot"));
const dashboard =
  window.location.pathname === "/app" || window.location.pathname === "/app/";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {dashboard ? (
      <Suspense
        fallback={
          <div className="route-loading" role="status">
            Opening Veto… <a href="/">Back to Veto</a>
          </div>
        }
      >
        <DashboardRoot />
      </Suspense>
    ) : (
      <Landing />
    )}
  </React.StrictMode>,
);
