import React, { useState, useEffect } from "react";
import { listenActivities } from "../services/activityService";
import { listenParticipants } from "../services/participantService";
import { listenSettings } from "../services/settingsService";
import { listenMetrics, DEFAULT_METRICS } from "../services/metricsService";
import { listenBudgetEntries } from "../services/budgetService";

function pct(r, t) { if (!t) return 0; return Math.min(999, Math.round((r / t) * 100)); }
function fmt(n) { return (n || 0).toLocaleString(); }

export default function Dashboard({ profile, goPage }) {
  const [activities,    setActivities]    = useState([]);
  const [participants,  setParticipants]  = useState([]);
  const [settings,      setSettings]      = useState(null);
  const [metrics,       setMetrics]       = useState(DEFAULT_METRICS);
  const [budgetEntries, setBudgetEntries] = useState([]);

  useEffect(() => {
    const u1 = listenActivities(setActivities);
    const u2 = listenParticipants(setParticipants);
    const u3 = listenSettings(setSettings);
    const u4 = listenMetrics(setMetrics);
    const u5 = listenBudgetEntries(setBudgetEntries);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const grant = settings?.grant || {};
  const totalBudgetTZS = grant.totalUSD ? Math.round(grant.totalUSD / (grant.conversionRate || 0.000413)) : 0;
  const approvedSpend  = budgetEntries.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct      = totalBudgetTZS ? Math.min(100, Math.round((approvedSpend / totalBudgetTZS) * 100)) : 0;

  const canApprove = ["admin", "finance_officer"].includes(profile?.role);
  const pendingEntries = budgetEntries.filter(e => e.status === "submitted");
  const myDrafts       = budgetEntries.filter(e => e.status === "draft" && e.requestedBy === profile?.name);
  const actionItems    = [
    canApprove && pendingEntries.length > 0 && {
      label: `${pendingEntries.length} budget ${pendingEntries.length === 1 ? "entry" : "entries"} pending your approval`,
      color: "#d97706", bg: "#fff8e1", border: "#ffe082", page: "review",
    },
    myDrafts.length > 0 && {
      label: `You have ${myDrafts.length} draft budget ${myDrafts.length === 1 ? "entry" : "entries"} not yet submitted`,
      color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", page: "review",
    },
  ].filter(Boolean);
  const totalParticipants = activities.reduce((s, a) => s + (a.participants || 0), 0);
  const totalWomen        = activities.reduce((s, a) => s + (a.women || 0), 0);
  const totalNewEditors   = activities.reduce((s, a) => s + (a.newEditors || 0), 0);
  const STAT_METRICS = [
    { key: "participants",  label: "Participants" },
    { key: "allEditors",    label: "Editors" },
    { key: "newEditors",    label: "New editors" },
    { key: "allOrganizers", label: "Organizers" },
  ];
  return (
    <div>
      <div className="page-title">Dashboard</div>

      {/* Action-required alerts */}
      {actionItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {actionItems.map((item, i) => (
            <div
              key={i}
              onClick={() => goPage(item.page)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: item.bg, border: `1px solid ${item.border}`, borderLeft: `4px solid ${item.color}`, borderRadius: 8, cursor: "pointer" }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: 12, color: item.color, fontWeight: 500 }}>Go to Review →</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-grid" style={{ marginBottom: 24 }}>
        {[
          { label: "Activities logged",  value: activities.length,      color: "#1c2b1e" },
          { label: "Total participants", value: fmt(totalParticipants), color: "#2d7a4f" },
          { label: "Women participants", value: fmt(totalWomen),        color: "#9333ea" },
          { label: "New editors",        value: fmt(totalNewEditors),   color: "#2563eb" },
          { label: "Registry size",      value: participants.length,    color: "#0891b2" },
          { label: "Budget used",        value: `${budgetPct}%`,       color: budgetPct > 90 ? "#c0392b" : "#2d7a4f" },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-title">Metrics progress</div>
          {STAT_METRICS.map(({ key, label }) => {
            const m = metrics[key] || { target: 0, result: 0 };
            const p = pct(m.result, m.target);
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#555" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(m.result)} / {fmt(m.target)} <span style={{ color: "#888", fontWeight: 400 }}>({p}%)</span></span>
                </div>
                <div style={{ background: "#e8e8e4", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, p)}%`, height: 6, borderRadius: 4, background: p >= 100 ? "#2d7a4f" : p >= 60 ? "#4a9e6b" : "#d97706" }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Recent activities</div>
            <button className="btn btn-sm" onClick={() => goPage("activities")}>View all →</button>
          </div>
          {activities.length === 0 ? <div className="empty">No activities logged yet.</div>
            : activities.slice(0, 5).map(a => (
              <div key={a.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f0f0ec" }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{a.date} · {a.type} · {a.participants || 0} participants</div>
              </div>
            ))}
        </div>
      </div>
      {totalBudgetTZS > 0 && (
        <div className="panel">
          <div className="panel-title">Budget utilisation</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span>TZS {fmt(approvedSpend)} approved</span>
            <span style={{ color: "#888" }}>of TZS {fmt(totalBudgetTZS)} total</span>
          </div>
          <div style={{ background: "#e8e8e4", borderRadius: 5, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${budgetPct}%`, height: 10, borderRadius: 5, background: budgetPct > 90 ? "#c0392b" : "#4a9e6b", transition: "width 0.3s" }} />
          </div>
        </div>
      )}
    </div>
  );
}
