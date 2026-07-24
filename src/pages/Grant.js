import React, { useState, useEffect, useCallback } from "react";
import {
  listenGrants, addGrant, updateGrant, deleteGrant,
  getGrantCounts, resetGrantData, purgeOrphanedData, GRANT_TYPES,
} from "../services/grantService";
import { listenSettings } from "../services/settingsService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

const TYPE_COLORS = {
  "General Support Fund": { bg: "#e6f4ec", color: "#2d7a4f", border: "#b7e0c8" },
  "Rapid Grant":          { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  "Other":                { bg: "#f5f5f5", color: "#555",    border: "#d1d5db" },
};
const STATUS_COLORS = {
  active:    { bg: "#e6f4ec", color: "#2d7a4f" },
  completed: { bg: "#f5f4f0", color: "#555"    },
  pending:   { bg: "#fff8e1", color: "#d97706" },
};

function emptyForm() {
  return {
    title: "", grantNumber: "", type: "General Support Fund",
    cycle: "", status: "active",
    startDate: "", endDate: "",
    totalUSD: "", conversionRate: "",
    odCampaignUrl: "",
  };
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function Grant({ profile, currentGrantId, onSelectGrant }) {
  const [grants,    setGrants]    = useState([]);
  const [settings,  setSettings]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(emptyForm());
  const [toast,     setToast]     = useState("");
  const [toastType, setToastType] = useState("success"); // success | danger
  const [importing, setImporting] = useState(false);
  const [counts,    setCounts]    = useState({}); // { [grantId]: { activities, programs, budgetEntries } }
  const [loadingCounts, setLoadingCounts] = useState({});
  const [resetting, setResetting] = useState(null); // grantId being reset
  const [confirmReset, setConfirmReset] = useState(null); // grant object awaiting confirm

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const u1 = listenGrants(setGrants);
    const u2 = listenSettings(setSettings);
    // Silently clean up any orphaned records from previously deleted grants
    purgeOrphanedData().catch(() => {});
    return () => { u1(); u2(); };
  }, []);

  // Load counts for all grants once the list is known
  useEffect(() => {
    grants.forEach(g => {
      if (counts[g.id] !== undefined) return; // already loaded
      setLoadingCounts(lc => ({ ...lc, [g.id]: true }));
      getGrantCounts(g.id).then(c => {
        setCounts(prev => ({ ...prev, [g.id]: c }));
        setLoadingCounts(lc => ({ ...lc, [g.id]: false }));
      }).catch(() => {
        setLoadingCounts(lc => ({ ...lc, [g.id]: false }));
      });
    });
  }, [grants]); // eslint-disable-line

  const refreshCounts = useCallback((grantId) => {
    setLoadingCounts(lc => ({ ...lc, [grantId]: true }));
    getGrantCounts(grantId).then(c => {
      setCounts(prev => ({ ...prev, [grantId]: c }));
      setLoadingCounts(lc => ({ ...lc, [grantId]: false }));
    });
  }, []);

  const showToast = (msg, type = "success") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(""), 4000);
  };

  const importFromSettings = async () => {
    const sg = settings?.grant || {};
    if (!sg.title && !sg.id) { alert("No grant data found in settings to import."); return; }
    setImporting(true);
    try {
      const data = {
        title: sg.title || "", grantNumber: sg.id || "",
        type: "General Support Fund",
        cycle: sg.cycle || "", status: sg.status || "active",
        startDate: sg.startDate || "", endDate: sg.endDate || "",
        totalUSD: sg.totalUSD ? Number(sg.totalUSD) : null,
        conversionRate: sg.conversionRate ? Number(sg.conversionRate) : null,
        odCampaignUrl: sg.odCampaignUrl || "",
      };
      const id = await addGrant(data);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "grants", {
        targetId: id, recordTitle: data.title || data.grantNumber,
        details: "Imported from legacy settings",
      });
      if (onSelectGrant) onSelectGrant(id);
      showToast("Grant imported and set as active.");
    } finally {
      setImporting(false);
    }
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyForm()); setEditId(null); setShowForm(true); };
  const openEdit   = (g) => {
    setForm({
      title: g.title || "", grantNumber: g.grantNumber || "",
      type: g.type || "General Support Fund",
      cycle: g.cycle || "", status: g.status || "active",
      startDate: g.startDate || "", endDate: g.endDate || "",
      totalUSD: g.totalUSD || "", conversionRate: g.conversionRate || "",
      odCampaignUrl: g.odCampaignUrl || "",
    });
    setEditId(g.id); setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim() && !form.grantNumber.trim()) {
      alert("At least a grant title or grant number is required."); return;
    }
    const data = {
      ...form,
      totalUSD:       form.totalUSD       ? Number(form.totalUSD)       : null,
      conversionRate: form.conversionRate ? Number(form.conversionRate) : null,
    };
    if (!editId) {
      const id = await addGrant(data);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "grants", {
        targetId: id, recordTitle: form.title || form.grantNumber,
      });
      if (onSelectGrant) onSelectGrant(id);
      showToast("Grant created and set as active.");
    } else {
      await updateGrant(editId, data);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "grants", {
        targetId: editId, recordTitle: form.title || form.grantNumber,
      });
      showToast("Grant updated.");
    }
    setShowForm(false);
  };

  const del = async (g) => {
    if (!window.confirm(
      `Delete grant "${g.title || g.grantNumber}"?\n\nThis will permanently delete the grant and ALL its activities, programs, and budget entries. This cannot be undone.`
    )) return;
    if (g.id === currentGrantId && onSelectGrant) onSelectGrant("");
    await resetGrantData(g.id);
    await deleteGrant(g.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "grants", {
      targetId: g.id, recordTitle: g.title || g.grantNumber,
    });
    showToast("Grant and all its data deleted.");
  };

  const startReset = (g) => { setConfirmReset(g); };

  const confirmResetAction = async () => {
    const g = confirmReset;
    setConfirmReset(null);
    setResetting(g.id);
    try {
      const result = await resetGrantData(g.id);
      await addAudit(profile, AUDIT_ACTIONS.DELETE, "grants", {
        targetId: g.id, recordTitle: g.title || g.grantNumber,
        details: `Reset: ${result.activities} activities, ${result.programs} programs, ${result.budgetEntries} budget entries deleted`,
      });
      refreshCounts(g.id);
      showToast(
        `Reset complete: ${result.activities} activities, ${result.programs} programs, ${result.budgetEntries} budget entries deleted.`,
        "danger"
      );
    } catch (err) {
      alert("Reset failed: " + (err.message || "Unknown error"));
    } finally {
      setResetting(null);
    }
  };

  const switchTo = (g) => {
    if (onSelectGrant) onSelectGrant(g.id);
    showToast(`Switched to "${g.title || g.grantNumber}".`);
  };

  const fmtUSD = (n) => n
    ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: toastType === "danger" ? "#c0392b" : "#2d7a4f",
          color: "#fff", padding: "12px 20px", borderRadius: 8,
          fontSize: 13, fontWeight: 500, maxWidth: 360, boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        }}>
          {toast}
        </div>
      )}

      {/* Reset confirmation modal */}
      {confirmReset && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 28, maxWidth: 440, width: "90%",
            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#c0392b", marginBottom: 10 }}>
              Reset grant data?
            </div>
            <div style={{ fontSize: 13, color: "#333", marginBottom: 6 }}>
              You are about to permanently delete <strong>all activities, programs, and budget entries</strong> for:
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, padding: "8px 12px", background: "#fdf0ee", borderRadius: 6, marginBottom: 14, color: "#c0392b" }}>
              {confirmReset.title || confirmReset.grantNumber || "Untitled grant"}
            </div>
            {counts[confirmReset.id] && (
              <div style={{ fontSize: 12, color: "#666", marginBottom: 14, background: "#f5f4f0", borderRadius: 6, padding: "8px 12px" }}>
                Will delete: <strong>{counts[confirmReset.id].activities}</strong> activities,{" "}
                <strong>{counts[confirmReset.id].programs}</strong> programs,{" "}
                <strong>{counts[confirmReset.id].budgetEntries}</strong> budget entries
              </div>
            )}
            <div style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, marginBottom: 20 }}>
              This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmReset(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmResetAction}>
                Yes, delete all data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-title">Grant management</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
        Each grant is an isolated workspace. Selecting a grant filters all pages to show only that grant's data.
      </div>

      {isAdmin && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={openCreate}>+ New grant</button>
        </div>
      )}

      {/* Form */}
      {showForm && isAdmin && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 24 }}>
          <div className="panel-title">{editId ? "Edit grant" : "Create new grant"}</div>
          <div className="form-grid">
            <Field label="Grant title">
              <input value={form.title} onChange={e => setF("title", e.target.value)}
                placeholder="Wikimedia Community Kilimanjaro 2026–2027" />
            </Field>
            <Field label="Grant number (Fluxx ID)">
              <input value={form.grantNumber} onChange={e => setF("grantNumber", e.target.value)}
                placeholder="R-GS-2606-22863" />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={e => setF("type", e.target.value)}>
                {GRANT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Cycle">
              <input value={form.cycle} onChange={e => setF("cycle", e.target.value)}
                placeholder="2026–2027" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setF("status", e.target.value)}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
            <Field label="Start date">
              <input type="date" value={form.startDate} onChange={e => setF("startDate", e.target.value)} />
            </Field>
            <Field label="End date">
              <input type="date" value={form.endDate} onChange={e => setF("endDate", e.target.value)} />
            </Field>
            <Field label="Total grant (USD)">
              <input type="number" min="0" value={form.totalUSD}
                onChange={e => setF("totalUSD", e.target.value)} placeholder="0" />
            </Field>
            <Field label="USD to TZS conversion rate">
              <input type="number" step="0.000001" value={form.conversionRate}
                onChange={e => setF("conversionRate", e.target.value)} placeholder="0.000438" />
            </Field>
          </div>
          <Field label="Outreach Dashboard campaign URL">
            <input value={form.odCampaignUrl} onChange={e => setF("odCampaignUrl", e.target.value)}
              placeholder="https://outreachdashboard.wmflabs.org/campaigns/..." />
          </Field>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={save}>
              {editId ? "Save changes" : "Create grant"}
            </button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* No grants */}
      {grants.length === 0 ? (
        <div className="panel">
          {settings?.grant?.title || settings?.grant?.id ? (
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                Existing grant found in settings
              </div>
              <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
                <strong>{settings.grant.title || "(no title)"}</strong>
                {settings.grant.id && (
                  <span style={{ fontFamily: "monospace", marginLeft: 8, color: "#888" }}>
                    {settings.grant.id}
                  </span>
                )}
              </div>
              {settings.grant.cycle && (
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                  Cycle: {settings.grant.cycle}
                </div>
              )}
              <p style={{ fontSize: 13, color: "#666", marginBottom: 14, lineHeight: 1.6 }}>
                Your grant was stored in Settings. Migrate it into the new grant system to use multi-grant features.
              </p>
              {isAdmin && (
                <button className="btn btn-primary" onClick={importFromSettings} disabled={importing}>
                  {importing ? "Importing…" : "Import existing grant"}
                </button>
              )}
            </div>
          ) : (
            <div className="empty">
              No grants yet.{isAdmin ? " Click '+ New grant' to create the first one." : ""}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {grants.map(g => {
            const isActive  = g.id === currentGrantId;
            const typeStyle = TYPE_COLORS[g.type] || TYPE_COLORS["Other"];
            const statStyle = STATUS_COLORS[g.status] || STATUS_COLORS.pending;
            const c         = counts[g.id];
            const isResetting = resetting === g.id;
            const isLoadingC  = loadingCounts[g.id];

            return (
              <div
                key={g.id}
                className="panel"
                style={{
                  borderLeft: isActive ? "5px solid #2d7a4f" : "5px solid #e8e8e4",
                  background: isActive ? "#f6fdf8" : "#fff",
                  padding: "18px 20px",
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title + badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      {isActive && (
                        <span style={{ fontSize: 12, background: "#2d7a4f", color: "#fff", borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>
                          Active
                        </span>
                      )}
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{g.title || "(Untitled)"}</span>
                      {g.grantNumber && (
                        <span style={{ fontSize: 11, color: "#888", fontFamily: "monospace", background: "#f5f4f0", padding: "2px 6px", borderRadius: 4 }}>
                          {g.grantNumber}
                        </span>
                      )}
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        background: typeStyle.bg, color: typeStyle.color,
                        border: `1px solid ${typeStyle.border}`,
                        borderRadius: 5, padding: "2px 8px",
                      }}>
                        {g.type}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        background: statStyle.bg, color: statStyle.color,
                        borderRadius: 5, padding: "2px 8px",
                      }}>
                        {g.status ? g.status.charAt(0).toUpperCase() + g.status.slice(1) : "—"}
                      </span>
                    </div>

                    {/* Dates + total */}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#666", marginBottom: 10 }}>
                      {g.cycle    && <span>Cycle: <strong>{g.cycle}</strong></span>}
                      {g.startDate && <span>Start: <strong>{g.startDate}</strong></span>}
                      {g.endDate   && <span>End: <strong>{g.endDate}</strong></span>}
                      {fmtUSD(g.totalUSD) && <span>Total: <strong>{fmtUSD(g.totalUSD)}</strong></span>}
                      {g.conversionRate && <span>Rate: <strong>{g.conversionRate}</strong></span>}
                    </div>

                    {/* Data counts */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {isLoadingC ? (
                        <span style={{ fontSize: 11, color: "#aaa" }}>Loading counts…</span>
                      ) : c ? (
                        <>
                          <CountBadge label="Activities"     count={c.activities}    color="#1c2b1e" />
                          <CountBadge label="Programs"       count={c.programs}      color="#2d7a4f" />
                          <CountBadge label="Budget entries" count={c.budgetEntries} color="#2563eb" />
                        </>
                      ) : null}
                    </div>

                    {g.odCampaignUrl && (
                      <div style={{ marginTop: 6 }}>
                        <a href={g.odCampaignUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: "#2563eb" }}>
                          Outreach Dashboard
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, minWidth: 140 }}>
                    {!isActive && (
                      <button className="btn btn-primary" onClick={() => switchTo(g)}>
                        Set as active
                      </button>
                    )}
                    {isAdmin && (
                      <button className="btn btn-sm" onClick={() => openEdit(g)}>
                        Edit details
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => startReset(g)}
                        disabled={isResetting}
                        title="Delete all activities, programs and budget entries for this grant"
                      >
                        {isResetting ? "Resetting…" : "Reset data"}
                      </button>
                    )}
                    {isAdmin && (
                      <button className="btn btn-sm" onClick={() => del(g)}
                        style={{ color: "#888", borderColor: "#e8e8e4" }}>
                        Delete grant
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CountBadge({ label, count, color }) {
  return (
    <span style={{
      fontSize: 11, background: "#f5f4f0", border: "1px solid #e8e8e4",
      borderRadius: 5, padding: "3px 10px", color: "#555", display: "flex", alignItems: "center", gap: 5,
    }}>
      <span style={{ fontWeight: 700, color }}>{count}</span>
      <span>{label}</span>
    </span>
  );
}
