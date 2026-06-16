import React, { useState, useEffect } from "react";
import { listenActivities } from "../services/activityService";
import { listenParticipants } from "../services/participantService";
import { listenSettings } from "../services/settingsService";
import { listenMetrics, DEFAULT_METRICS } from "../services/metricsService";
import { listenBudgetEntries } from "../services/budgetService";
import { listenPrograms } from "../services/programService";

function fmt(n) { return (n || 0).toLocaleString(); }
function pct(r, t) { if (!t) return 0; return Math.min(100, Math.round((r / t) * 100)); }

function ProgressBar({ value, max, color = "#4a9e6b", height = 8 }) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ background: "#e8e8e4", borderRadius: height, height, overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height, background: color, borderRadius: height, transition: "width 0.4s" }} />
    </div>
  );
}

const METRIC_ROWS = [
  { key: "participants",  label: "Participants" },
  { key: "allEditors",    label: "Active editors" },
  { key: "newEditors",    label: "New editors" },
  { key: "allOrganizers", label: "Organizers" },
];

export default function DonorDashboard({ profile }) {
  const [activities,    setActivities]    = useState([]);
  const [participants,  setParticipants]  = useState([]);
  const [settings,      setSettings]      = useState(null);
  const [metrics,       setMetrics]       = useState(DEFAULT_METRICS);
  const [budgetEntries, setBudgetEntries] = useState([]);
  const [programs,      setPrograms]      = useState([]);

  useEffect(() => {
    const u1 = listenActivities(setActivities);
    const u2 = listenParticipants(setParticipants);
    const u3 = listenSettings(setSettings);
    const u4 = listenMetrics(setMetrics);
    const u5 = listenBudgetEntries(setBudgetEntries);
    const u6 = listenPrograms(setPrograms);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  const grant = settings?.grant || {};
  const org   = settings?.org   || {};
  const totalBudgetTZS = grant.totalUSD ? Math.round(grant.totalUSD / (grant.conversionRate || 0.000413)) : 0;
  const approvedSpend  = budgetEntries.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);

  const totalParticipants = activities.reduce((s, a) => s + (a.participants || 0), 0);
  const totalWomen        = activities.reduce((s, a) => s + (a.women || 0), 0);
  const totalNewEditors   = activities.reduce((s, a) => s + (a.newEditors || 0), 0);
  const totalCreated      = activities.reduce((s, a) => s + (a.created || 0), 0);
  const totalImproved     = activities.reduce((s, a) => s + (a.improved || 0), 0);

  const womenPct = totalParticipants > 0 ? Math.round((totalWomen / totalParticipants) * 100) : 0;

  return (
    <div>
      <div className="page-title">Public dashboard</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
        Grant: <strong>{grant.title || "—"}</strong> · {grant.cycle || "—"} · Status: <span style={{ color: "#2d7a4f", fontWeight: 600 }}>{grant.status || "active"}</span>
      </div>

      {/* Headline KPIs */}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        {[
          { label: "Activities",           value: activities.length,        color: "#1c2b1e" },
          { label: "Total participants",   value: fmt(totalParticipants),   color: "#2d7a4f" },
          { label: "Women participants",   value: `${fmt(totalWomen)} (${womenPct}%)`, color: "#9333ea" },
          { label: "New editors",          value: fmt(totalNewEditors),     color: "#2563eb" },
          { label: "Articles created",     value: fmt(totalCreated),        color: "#0891b2" },
          { label: "Articles improved",    value: fmt(totalImproved),       color: "#059669" },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Metrics progress */}
        <div className="panel">
          <div className="panel-title">Metrics progress</div>
          {METRIC_ROWS.map(({ key, label }) => {
            const m = metrics[key] || { target: 0, result: 0 };
            const p = pct(m.result, m.target);
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#555" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(m.result)} / {fmt(m.target)}<span style={{ color: "#888", fontWeight: 400 }}> ({p}%)</span></span>
                </div>
                <ProgressBar value={m.result} max={m.target} color={p >= 100 ? "#2d7a4f" : p >= 60 ? "#4a9e6b" : "#d97706"} />
              </div>
            );
          })}
        </div>

        {/* Budget */}
        <div className="panel">
          <div className="panel-title">Budget utilisation</div>
          {totalBudgetTZS > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>TZS {fmt(approvedSpend)} approved</span>
                <span style={{ color: "#888" }}>of TZS {fmt(totalBudgetTZS)}</span>
              </div>
              <ProgressBar value={approvedSpend} max={totalBudgetTZS} color={approvedSpend / totalBudgetTZS > 0.9 ? "#c0392b" : "#4a9e6b"} height={10} />
              <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>{Math.round((approvedSpend / totalBudgetTZS) * 100)}% of total grant utilised</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 12 }}>
                Grant total: <strong>USD {fmt(grant.totalUSD)}</strong> = TZS {fmt(totalBudgetTZS)}
              </div>
            </>
          ) : <div className="empty" style={{ fontSize: 13 }}>Budget not configured yet.</div>}
        </div>
      </div>

      {/* Programs */}
      {programs.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">Programs</div>
          <div className="card-grid">
            {programs.map(p => {
              const acts = activities.filter(a => a.programId === p.id);
              return (
                <div key={p.id} style={{ background: "#f9f9f7", borderRadius: 8, padding: 14, borderTop: `3px solid ${p.color || "#4a9e6b"}` }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{acts.length} activities</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: p.color || "#2d7a4f", marginTop: 4 }}>{acts.reduce((s, a) => s + (a.participants || 0), 0)}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>participants</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activities */}
      <div className="panel">
        <div className="panel-title">Recent activities</div>
        {activities.slice(0, 10).map(a => (
          <div key={a.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #f5f4f0" }}>
            <div style={{ minWidth: 90, fontSize: 11, color: "#888" }}>{a.date}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{a.type} · {a.participants || 0} participants · {a.location || "—"}</div>
            </div>
          </div>
        ))}
        {activities.length === 0 && <div className="empty">No activities yet.</div>}
      </div>
    </div>
  );
}
