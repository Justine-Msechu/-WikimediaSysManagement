import React, { useState, useEffect } from "react";
import { listenSettings, updateSettings, DEFAULT_SETTINGS } from "../services/settingsService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

export default function Grant({ profile }) {
  const [form, setForm]   = useState(null);
  const [saved, setSaved] = useState(false);
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    return listenSettings(s => setForm((s || DEFAULT_SETTINGS).grant || DEFAULT_SETTINGS.grant));
  }, []);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    await updateSettings({ grant: form });
    await addAudit(profile, AUDIT_ACTIONS.UPDATE, "grant", { details: "Grant settings updated" });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  if (!form) return <div className="empty">Loading…</div>;
  return (
    <div>
      <div className="page-title">Grant setup</div>
      <div className="panel">
        <div className="panel-title">Grant information</div>
        <div className="form-grid">
          {[
            { k: "title",  label: "Grant title",  ph: "Wikimedia Community Kilimanjaro 2026–2027" },
            { k: "id",     label: "Grant ID",     ph: "R-GS-XXXX-XXXXX" },
            { k: "cycle",  label: "Grant cycle",  ph: "2026–2027" },
          ].map(({ k, label, ph }) => (
            <div key={k} className="field">
              <label>{label}</label>
              <input value={form[k] || ""} onChange={e => setF(k, e.target.value)} disabled={!isAdmin} placeholder={ph} />
            </div>
          ))}
          <div className="field"><label>Status</label>
            <select value={form.status || "active"} onChange={e => setF("status", e.target.value)} disabled={!isAdmin}>
              <option value="active">Active</option><option value="completed">Completed</option><option value="pending">Pending</option>
            </select>
          </div>
          <div className="field"><label>Start date</label><input type="date" value={form.startDate || ""} onChange={e => setF("startDate", e.target.value)} disabled={!isAdmin} /></div>
          <div className="field"><label>End date</label><input type="date" value={form.endDate || ""} onChange={e => setF("endDate", e.target.value)} disabled={!isAdmin} /></div>
          <div className="field"><label>Total grant (USD)</label><input type="number" min="0" value={form.totalUSD || ""} onChange={e => setF("totalUSD", Number(e.target.value))} disabled={!isAdmin} /></div>
          <div className="field"><label>USD → TZS rate</label><input type="number" step="0.000001" value={form.conversionRate || ""} onChange={e => setF("conversionRate", Number(e.target.value))} disabled={!isAdmin} /></div>
        </div>
        <div className="field"><label>Outreach Dashboard campaign URL</label>
          <input value={form.odCampaignUrl || ""} onChange={e => setF("odCampaignUrl", e.target.value)} disabled={!isAdmin} placeholder="https://outreachdashboard.wmflabs.org/campaigns/..." />
        </div>
        {isAdmin
          ? <div className="btn-row"><button className="btn btn-primary" onClick={save}>Save</button>{saved && <span style={{ fontSize: 13, color: "#2d7a4f", marginLeft: 10 }}>✓ Saved</span>}</div>
          : <div style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>Grant settings are managed by Admin.</div>}
      </div>
    </div>
  );
}
