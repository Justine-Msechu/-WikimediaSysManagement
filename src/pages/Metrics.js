import React, { useState, useEffect } from "react";
import { listenMetrics, updateMetrics, DEFAULT_METRICS } from "../services/metricsService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

function fmt(n) { return (n || 0).toLocaleString(); }
function pct(r, t) { if (!t) return 0; return Math.min(999, Math.round((r / t) * 100)); }

const METRIC_ROWS = [
  { key: "participants",    label: "All participants" },
  { key: "allEditors",      label: "All editors" },
  { key: "newEditors",      label: "New editors" },
  { key: "retainedEditors", label: "Retained editors" },
  { key: "allOrganizers",   label: "All organizers" },
  { key: "newOrganizers",   label: "New organizers" },
];

const PROJECT_FIELDS = ["Wikipedia", "Wikimedia Commons", "Wikidata", "Wiktionary", "Wikisource"];

export default function Metrics({ profile }) {
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [saved,   setSaved]   = useState(false);
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => { return listenMetrics(setMetrics); }, []);

  const save = async (patch) => {
    const merged = { ...metrics, ...patch };
    await updateMetrics(patch);
    setMetrics(merged);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const setIndicator = (key, field, val) => {
    save({ [key]: { ...(metrics[key] || {}), [field]: Number(val) || 0 } });
  };

  const setProject = (name, field, val) => {
    const projects = (metrics.projects || PROJECT_FIELDS.map(p => ({ name: p, tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 })))
      .map(p => p.name === name ? { ...p, [field]: Number(val) || 0 } : p);
    save({ projects });
  };

  const projects = metrics.projects || PROJECT_FIELDS.map(p => ({ name: p, tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 }));

  return (
    <div>
      <div className="page-title">Metrics</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Set targets when applying. Update results throughout the grant year.</div>

      {saved && <div style={{ background: "#e6f4ec", border: "1px solid #b7e0c8", borderRadius: 8, padding: "8px 14px", fontSize: 13, marginBottom: 16, color: "#2d7a4f" }}>✓ Metrics saved.</div>}

      <fieldset disabled={!canEdit} style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">Participants &amp; editors</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Metric</th><th>Target</th><th>Result</th><th>Achieved</th></tr></thead>
              <tbody>
                {METRIC_ROWS.map(({ key, label }) => {
                  const val = metrics[key] || { target: 0, result: 0 };
                  const p   = pct(val.result, val.target);
                  const cls = p >= 100 ? "badge-green" : p >= 60 ? "badge-amber" : "badge-gray";
                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 500 }}>{label}</td>
                      <td><input type="number" min="0" defaultValue={val.target} onBlur={e => setIndicator(key, "target", e.target.value)} style={{ width: 90 }} /></td>
                      <td><input type="number" min="0" defaultValue={val.result} onBlur={e => setIndicator(key, "result", e.target.value)} style={{ width: 90 }} /></td>
                      <td><span className={`badge ${cls}`}>{p}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Wikimedia project contributions</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Project</th><th>Target created</th><th>Target improved</th><th>Result created</th><th>Result improved</th><th>%</th></tr></thead>
              <tbody>
                {projects.map(p => {
                  const pc = pct(p.rCreated, p.tCreated);
                  const pi = pct(p.rImproved, p.tImproved);
                  const overall = Math.round((pc + pi) / 2);
                  const cls = overall >= 100 ? "badge-green" : overall >= 60 ? "badge-amber" : "badge-gray";
                  return (
                    <tr key={p.name}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td><input type="number" min="0" defaultValue={p.tCreated}  onBlur={e => setProject(p.name, "tCreated",  e.target.value)} style={{ width: 80 }} /></td>
                      <td><input type="number" min="0" defaultValue={p.tImproved} onBlur={e => setProject(p.name, "tImproved", e.target.value)} style={{ width: 80 }} /></td>
                      <td><input type="number" min="0" defaultValue={p.rCreated}  onBlur={e => setProject(p.name, "rCreated",  e.target.value)} style={{ width: 80 }} /></td>
                      <td><input type="number" min="0" defaultValue={p.rImproved} onBlur={e => setProject(p.name, "rImproved", e.target.value)} style={{ width: 80 }} /></td>
                      <td><span className={`badge ${cls}`}>{overall}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>

      {!canEdit && <div style={{ fontSize: 12, color: "#aaa", marginTop: 12 }}>Metrics can be edited by Coordinator or Admin.</div>}
    </div>
  );
}
