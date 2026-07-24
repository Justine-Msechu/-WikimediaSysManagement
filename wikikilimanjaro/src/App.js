import React, { useState, useEffect } from "react";
import { load, save } from "./data/store";
import Dashboard from "./pages/Dashboard";
import Application from "./pages/Application";
import Activities from "./pages/Activities";
import ActivityReport from "./pages/ActivityReport";
import Metrics from "./pages/Metrics";
import Budget from "./pages/Budget";
import FinalReport from "./pages/FinalReport";
import Settings from "./pages/Settings";
import "./App.css";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "application", label: "Application", icon: "✎" },
  { id: "activities", label: "Activities", icon: "◈" },
  { id: "metrics", label: "Metrics", icon: "◑" },
  { id: "budget", label: "Budget", icon: "◎" },
  { id: "report", label: "Final report", icon: "▤" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [state, setState] = useState(() => load());
  const [viewActivity, setViewActivity] = useState(null);

  useEffect(() => {
    save(state);
  }, [state]);

  const update = (patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      return next;
    });
  };

  const props = { state, update, setPage };

  const renderPage = () => {
    if (viewActivity !== null) {
      const act = state.activities[viewActivity];
      return (
        <ActivityReport
          activity={act}
          index={viewActivity}
          state={state}
          update={update}
          onBack={() => setViewActivity(null)}
        />
      );
    }
    switch (page) {
      case "dashboard": return <Dashboard {...props} onViewActivity={setViewActivity} />;
      case "application": return <Application {...props} />;
      case "activities": return <Activities {...props} onViewActivity={setViewActivity} />;
      case "metrics": return <Metrics {...props} />;
      case "budget": return <Budget {...props} />;
      case "report": return <FinalReport {...props} />;
      case "settings": return <Settings {...props} />;
      default: return <Dashboard {...props} onViewActivity={setViewActivity} />;
    }
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">WK</div>
          <div>
            <div className="brand-name">Wiki Kilimanjaro</div>
            <div className="brand-sub">GSF Manager</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id && !viewActivity ? "active" : ""}`}
              onClick={() => { setViewActivity(null); setPage(n.id); }}
            >
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="grant-badge">
            <div className="grant-badge-label">Grant ID</div>
            <div className="grant-badge-id">{state.org.grantId || "R-GS-2606-22863"}</div>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <div className="page-wrap">{renderPage()}</div>
      </main>
    </div>
  );
}
