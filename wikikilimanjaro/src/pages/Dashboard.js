import React from "react";
import { fmt, pct } from "../utils/helpers";

function Progress({ label, target, result }) {
  const p = pct(result, target);
  const cls = p >= 100 ? "over" : p >= 60 ? "" : "amber";
  return (
    <div className="progress-wrap">
      <div className="progress-row">
        <span className="progress-label">{label}</span>
        <span className="progress-nums">
          {fmt(result)} / {fmt(target)}{" "}
          <span style={{ color: "#aaa", fontWeight: 400 }}>({p}%)</span>
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.min(p, 100)}%` }} data-cls={cls} />
      </div>
    </div>
  );
}

export default function Dashboard({ state, setPage, onViewActivity }) {
  const acts = state.activities || [];
  const totalSpent = Object.values(state.budget.spent).reduce((a, b) => a + b, 0);
  const proj = state.metrics.projects[0];

  // Application completeness
  const appFields = [
    state.application.title,
    state.application.startDate,
    state.application.endDate,
    state.application.location,
    state.application.programs,
    state.application.team,
    state.application.partners,
    state.org.name,
    state.org.country,
  ];
  const filled = appFields.filter((f) => f && f.trim().length > 0).length;
  const comp = Math.round((filled / appFields.length) * 100);

  const remaining = state.budget.total - totalSpent;

  return (
    <div>
      <div className="page-title">Dashboard</div>
      <div className="page-sub">{state.org.grantCycle} · {state.org.name}</div>

      {/* Completeness */}
      <div className="comp-wrap">
        <span className="comp-label">Application {comp}% complete</span>
        <div className="comp-bar">
          <div className="comp-fill" style={{ width: `${comp}%` }} />
        </div>
        <span className="comp-pct" style={{ color: comp === 100 ? "#2d7a4f" : "#b06a00" }}>
          {comp === 100 ? "✓ Ready" : `${comp}%`}
        </span>
        {comp < 100 && (
          <button className="btn btn-sm" onClick={() => setPage("application")}>
            Fill application →
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Total budget (TZS)</div>
          <div className="stat-value blue">{fmt(state.budget.total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total spent (TZS)</div>
          <div className="stat-value amber">{fmt(totalSpent)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Remaining (TZS)</div>
          <div className="stat-value" style={{ color: remaining < 0 ? "#c0392b" : "#2d7a4f" }}>
            {fmt(remaining)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Activities logged</div>
          <div className="stat-value green">{acts.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Participants (result)</div>
          <div className="stat-value green">{fmt(state.metrics.participants.result)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Wikipedia articles +</div>
          <div className="stat-value green">{fmt(proj.rCreated)}</div>
        </div>
      </div>

      {/* Progress */}
      <div className="panel">
        <div className="panel-title">Targets vs results</div>
        <Progress label="All participants" target={state.metrics.participants.target} result={state.metrics.participants.result} />
        <Progress label="New editors" target={state.metrics.newEditors.target} result={state.metrics.newEditors.result} />
        <Progress label="Retained editors" target={state.metrics.retainedEditors.target} result={state.metrics.retainedEditors.result} />
        <Progress label="Wikipedia articles created" target={proj.tCreated} result={proj.rCreated} />
        <Progress label="Wikipedia articles improved" target={proj.tImproved} result={proj.rImproved} />
      </div>

      {/* Recent activities */}
      <div className="panel">
        <div className="panel-title">Recent activities</div>
        {acts.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">◈</div>
            No activities logged yet.{" "}
            <button className="btn btn-sm btn-primary" onClick={() => setPage("activities")}>
              Log first activity
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Date</th>
                <th>Participants</th>
                <th>Articles +</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {acts
                .slice()
                .reverse()
                .slice(0, 8)
                .map((a, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{a.name}</strong>
                      <br />
                      <span style={{ color: "#888", fontSize: "11px" }}>{a.type}</span>
                    </td>
                    <td>{a.date}</td>
                    <td>
                      {a.participants}
                      <span style={{ color: "#888", fontSize: "11px" }}> ({a.women}♀)</span>
                    </td>
                    <td>+{fmt(a.created)}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        onClick={() => onViewActivity(acts.length - 1 - i)}
                      >
                        View report
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => setPage("activities")}>
          + Log new activity
        </button>
        <button className="btn" onClick={() => setPage("report")}>
          ▤ Generate final report
        </button>
      </div>
    </div>
  );
}
