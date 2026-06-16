import React, { useState, useEffect } from "react";
import { listenRisks, addRisk, updateRisk, deleteRisk, RISK_CATEGORIES, RISK_STATUSES } from "../services/riskService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

const STATUS_BADGE = { open: "badge-red", mitigated: "badge-blue", closed: "badge-gray" };
const HEAT_COLOR = (s) => s >= 20 ? "#c0392b" : s >= 12 ? "#d97706" : s >= 6 ? "#d97706" : "#2d7a4f";

function emptyRisk() {
  return { title: "", category: "Operational", likelihood: 3, impact: 3, status: "open", owner: "", response: "" };
}

export default function RiskRegister({ profile }) {
  const [risks,    setRisks]    = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(emptyRisk());
  const [toast,    setToast]    = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => { return listenRisks(setRisks); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyRisk()); setEditId(null); setShowForm(true); };
  const openEdit   = (r) => { setForm({ title: r.title, category: r.category, likelihood: r.likelihood, impact: r.impact, status: r.status, owner: r.owner || "", response: r.response || "" }); setEditId(r.id); setShowForm(true); };

  const save = async () => {
    if (!form.title.trim()) { alert("Risk title is required."); return; }
    const data = { ...form, score: form.likelihood * form.impact };
    if (!editId) {
      const id = await addRisk(data);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "risks", { targetId: id, recordTitle: form.title });
      showToast("Risk added.");
    } else {
      await updateRisk(editId, data);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "risks", { targetId: editId, recordTitle: form.title });
      showToast("Risk updated.");
    }
    setShowForm(false);
  };

  const del = async (r) => {
    if (!window.confirm(`Delete risk "${r.title}"?`)) return;
    await deleteRisk(r.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "risks", { targetId: r.id, recordTitle: r.title });
    showToast("Risk deleted.");
  };

  // Heat map grid: likelihood 1-5 (y) x impact 1-5 (x)
  const heatMap = Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: 5 }, (_, x) => {
      const l = 5 - y; const i = x + 1; const s = l * i;
      return { l, i, s, risks: risks.filter(r => r.likelihood === l && r.impact === i) };
    })
  );

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Risk register</div>

      {canEdit && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}><button className="btn btn-primary" onClick={openCreate}>+ Add risk</button></div>}

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit risk" : "New risk"}</div>
          <div className="field"><label>Risk title <span className="req">★</span></label><input value={form.title} onChange={e => setF("title", e.target.value)} placeholder="Describe the risk" /></div>
          <div className="form-grid">
            <div className="field"><label>Category</label>
              <select value={form.category} onChange={e => setF("category", e.target.value)}>
                {RISK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Owner</label><input value={form.owner} onChange={e => setF("owner", e.target.value)} placeholder="Person responsible" /></div>
            <div className="field"><label>Likelihood (1–5)</label><input type="number" min="1" max="5" value={form.likelihood} onChange={e => setF("likelihood", Number(e.target.value))} /></div>
            <div className="field"><label>Impact (1–5)</label><input type="number" min="1" max="5" value={form.impact} onChange={e => setF("impact", Number(e.target.value))} /></div>
            <div className="field"><label>Status</label>
              <select value={form.status} onChange={e => setF("status", e.target.value)}>
                {RISK_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Response / mitigation plan</label><textarea rows={3} value={form.response} onChange={e => setF("response", e.target.value)} placeholder="What actions will be taken to reduce this risk?" /></div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Heat map */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Risk heat map</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "inline-grid", gridTemplateColumns: "40px repeat(5, 64px)", gap: 3 }}>
            <div />
            {[1,2,3,4,5].map(i => <div key={i} style={{ fontSize: 10, color: "#888", textAlign: "center" }}>Impact {i}</div>)}
            {heatMap.map((row, ri) => (
              <React.Fragment key={ri}>
                <div style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4 }}>L{5-ri}</div>
                {row.map(({ l, i, s, risks: cr }) => (
                  <div key={i} style={{ background: HEAT_COLOR(s) + "33", border: `2px solid ${HEAT_COLOR(s)}`, borderRadius: 6, minHeight: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 3 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: HEAT_COLOR(s) }}>{s}</div>
                    {cr.map(r => <div key={r.id} style={{ fontSize: 9, background: HEAT_COLOR(s), color: "#fff", borderRadius: 3, padding: "1px 4px", marginTop: 2, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>)}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Risk table */}
      <div className="panel" style={{ padding: 0 }}>
        {risks.length === 0 ? <div className="empty">No risks logged yet.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Risk</th><th>Category</th><th>L</th><th>I</th><th>Score</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {risks.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.title}</td>
                    <td style={{ fontSize: 12 }}>{r.category}</td>
                    <td style={{ fontSize: 12, textAlign: "center" }}>{r.likelihood}</td>
                    <td style={{ fontSize: 12, textAlign: "center" }}>{r.impact}</td>
                    <td><span style={{ fontWeight: 700, color: HEAT_COLOR(r.score || r.likelihood * r.impact) }}>{r.score || r.likelihood * r.impact}</span></td>
                    <td style={{ fontSize: 12 }}>{r.owner || "—"}</td>
                    <td><span className={`badge ${STATUS_BADGE[r.status] || "badge-gray"}`}>{r.status}</span></td>
                    <td>
                      {canEdit && <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => del(r)}>✕</button>
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
