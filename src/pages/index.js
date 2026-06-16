import React, { useState, useEffect } from "react";
import { uid, BUDGET_STATUSES } from "../data/store";
import { fmt, fmtUSD, pct, programStats, activityTotalUSD, activityTotalTZS, compileGrantReport, getODSlug, OD_BASE } from "../utils/helpers";
import { canApproveBudget, canEditBudget } from "../utils/auth";
import { addAudit, AUDIT_ACTIONS } from "../utils/audit";
import {
  getStoredClientId, storeClientId, initDriveClient,
  isSignedIn, signIn, signOut, saveToDrive, loadFromDrive,
} from "../utils/drive";
import logo from "../assets/logo.png";
import OutreachPanel from "./OutreachPanel";

const BUDGET_STATUS_BADGE = {
  draft:     { label: "Draft",     cls: "badge-gray" },
  submitted: { label: "Submitted", cls: "badge-amber" },
  approved:  { label: "Approved",  cls: "badge-green" },
  rejected:  { label: "Rejected",  cls: "badge-red" },
};

const BUDGET_CATS = ["Personnel", "Operational", "Programmatic", "Administrative", "Other"];

// ─── Budget ───────────────────────────────────────────────────────────────────
export function Budget({ state, update, role, currentUser }) {
  const { programs = [], activities = [], grant = {}, budgetEntries = [] } = state;
  const grantTotal = Number(grant.totalUSD || 0);
  const totalUSD   = activities.reduce((s, a) => s + activityTotalUSD(a), 0);
  const remaining  = grantTotal - totalUSD;

  const canApprove = canApproveBudget(currentUser);
  const canEdit    = canEditBudget(currentUser);

  const [form, setForm]   = useState(null);
  const [editId, setEditId] = useState(null);
  const [reviewId, setReviewId]     = useState(null);
  const [reviewAction, setReviewAction] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const emptyEntry = () => ({
    id: uid(), title: "", description: "", category: "Programmatic",
    amountUSD: 0, status: "draft",
    requestedBy: currentUser?.name || "", requestedById: currentUser?.id,
    requestedAt: new Date().toISOString().slice(0, 10),
    reviewedBy: null, reviewedAt: null, reviewerComment: "",
  });

  const saveEntry = (submit = false) => {
    if (!form.title.trim()) { alert("Title is required."); return; }
    const entry = {
      ...form,
      status: submit ? "submitted" : "draft",
      requestedAt: form.requestedAt || new Date().toISOString().slice(0, 10),
    };
    const isNew = !editId;
    const updated = isNew ? [...budgetEntries, entry] : budgetEntries.map(e => e.id === editId ? entry : e);
    update({
      budgetEntries: updated,
      auditLog: addAudit(state.auditLog, currentUser, {
        action: submit ? AUDIT_ACTIONS.BUDGET_SUBMITTED : AUDIT_ACTIONS.BUDGET_CREATED,
        module: "budget",
        recordId: entry.id, recordTitle: entry.title,
        details: `${fmtUSD(entry.amountUSD)} — ${entry.category}`,
      }),
    });
    setForm(null); setEditId(null);
  };

  const approve = (id, approved, comment) => {
    const entry = budgetEntries.find(e => e.id === id);
    if (!entry) return;
    const updated = {
      ...entry,
      status: approved ? "approved" : "rejected",
      reviewedBy: currentUser?.name,
      reviewedAt: new Date().toISOString().slice(0, 10),
      reviewerComment: comment,
    };
    update({
      budgetEntries: budgetEntries.map(e => e.id === id ? updated : e),
      auditLog: addAudit(state.auditLog, currentUser, {
        action: approved ? AUDIT_ACTIONS.BUDGET_APPROVED : AUDIT_ACTIONS.BUDGET_REJECTED,
        module: "budget",
        recordId: id, recordTitle: entry.title,
        details: comment || (approved ? "Approved" : "Rejected"),
      }),
    });
    setReviewId(null); setReviewAction(""); setReviewComment("");
  };

  const delEntry = (id) => {
    if (!window.confirm("Delete this budget entry?")) return;
    const entry = budgetEntries.find(e => e.id === id);
    update({
      budgetEntries: budgetEntries.filter(e => e.id !== id),
      auditLog: addAudit(state.auditLog, currentUser, {
        action: AUDIT_ACTIONS.BUDGET_DELETED, module: "budget",
        recordId: id, recordTitle: entry?.title,
      }),
    });
  };

  // group activity expenses by type
  const byType = {};
  activities.forEach(a => {
    (a.expenses || []).forEach(e => {
      const lTZS = e.units > 0 ? e.units * e.unitCostTZS : Number(e.totalTZS || 0);
      const lUSD = lTZS * Number(a.conversionRate || 0);
      const t = e.expenseType || "Other";
      byType[t] = (byType[t] || 0) + lUSD;
    });
  });

  const filteredEntries = filterStatus === "all" ? budgetEntries : budgetEntries.filter(e => e.status === filterStatus);
  const pendingCount = budgetEntries.filter(e => e.status === "submitted").length;

  return (
    <div>
      <div className="page-title">Budget</div>
      <div className="page-sub">Financial overview and budget approval workflow.</div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Grant total (USD)</div>
          <div className="stat-value blue">{fmtUSD(grantTotal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total spent</div>
          <div className="stat-value amber">{fmtUSD(totalUSD)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Remaining</div>
          <div className="stat-value" style={{ color: remaining < 0 ? "#c0392b" : "#2d7a4f" }}>{fmtUSD(remaining)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">% used</div>
          <div className="stat-value" style={{ color: grantTotal > 0 && pct(totalUSD, grantTotal) > 100 ? "#c0392b" : "#b06a00" }}>
            {grantTotal > 0 ? pct(totalUSD, grantTotal) : "—"}%
          </div>
        </div>
      </div>

      {grantTotal === 0 && (
        <div className="alert alert-warn">
          Grant total not set. Go to <strong>Grant</strong> page to enter the total grant amount (USD).
        </div>
      )}

      {/* ── Budget entries (approval workflow) ── */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            Budget entries
            {pendingCount > 0 && canApprove && (
              <span className="badge badge-amber" style={{ fontSize: 11, marginLeft: 8 }}>{pendingCount} pending approval</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 5 }}>
              <option value="all">All</option>
              {BUDGET_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            {canEdit && (
              <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyEntry()); setEditId(null); }}>
                + New entry
              </button>
            )}
          </div>
        </div>

        {/* Create/Edit form */}
        {form && (
          <div style={{ background: "#f9f9f7", border: "1px solid #e0e0da", borderRadius: 9, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>{editId ? "Edit entry" : "New budget entry"}</div>
            <div className="form-grid">
              <div className="field"><label>Title <span className="req">★</span></label>
                <input value={form.title} onChange={e => setF("title", e.target.value)} autoFocus /></div>
              <div className="field"><label>Category</label>
                <select value={form.category} onChange={e => setF("category", e.target.value)}>
                  {BUDGET_CATS.map(c => <option key={c}>{c}</option>)}
                </select></div>
            </div>
            <div className="form-grid">
              <div className="field"><label>Amount (USD)</label>
                <input type="number" min="0" step="1" value={form.amountUSD}
                  onChange={e => setF("amountUSD", Number(e.target.value) || 0)} /></div>
              <div className="field"><label>Date</label>
                <input type="date" value={form.requestedAt}
                  onChange={e => setF("requestedAt", e.target.value)} /></div>
            </div>
            <div className="field"><label>Description</label>
              <textarea rows={2} value={form.description} onChange={e => setF("description", e.target.value)} /></div>
            <div className="btn-row">
              {canApprove ? (
                <button className="btn btn-primary" onClick={() => saveEntry(false)}>Save</button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => saveEntry(true)}>Save &amp; submit for approval</button>
                  <button className="btn" onClick={() => saveEntry(false)}>Save as draft</button>
                </>
              )}
              <button className="btn" onClick={() => { setForm(null); setEditId(null); }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Entries table */}
        {filteredEntries.length === 0 ? (
          <div className="empty">No budget entries yet. {canEdit && "Click \"+ New entry\" to create one."}</div>
        ) : (
          <table>
            <thead>
              <tr><th>Title</th><th>Category</th><th>Amount (USD)</th><th>Requested by</th><th>Date</th><th>Status</th><th>Reviewer comment</th><th></th></tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => {
                const badge = BUDGET_STATUS_BADGE[entry.status] || { label: entry.status, cls: "badge-gray" };
                const isReviewing = reviewId === entry.id;
                return (
                  <React.Fragment key={entry.id}>
                    <tr>
                      <td style={{ fontWeight: 500 }}>{entry.title}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{entry.category}</span></td>
                      <td style={{ fontWeight: 600 }}>{fmtUSD(entry.amountUSD)}</td>
                      <td style={{ fontSize: 12 }}>{entry.requestedBy || "—"}</td>
                      <td style={{ fontSize: 12, color: "#888" }}>{entry.requestedAt || "—"}</td>
                      <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                      <td style={{ fontSize: 11, color: "#777", maxWidth: 160 }}>{entry.reviewerComment || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {canApprove && entry.status === "submitted" && !isReviewing && (
                            <>
                              <button className="btn btn-sm btn-primary" onClick={() => approve(entry.id, true, "")}>Approve</button>
                              <button className="btn btn-sm btn-danger" onClick={() => { setReviewId(entry.id); setReviewAction("reject"); setReviewComment(""); }}>Reject</button>
                            </>
                          )}
                          {canEdit && (entry.status === "draft" || entry.status === "rejected") && (
                            <button className="btn btn-sm" onClick={() => { setForm({ ...entry }); setEditId(entry.id); }}>Edit</button>
                          )}
                          {canEdit && entry.status === "draft" && !canApprove && (
                            <button className="btn btn-sm btn-primary" onClick={() => {
                              update({
                                budgetEntries: budgetEntries.map(e => e.id === entry.id ? { ...e, status: "submitted" } : e),
                                auditLog: addAudit(state.auditLog, currentUser, { action: AUDIT_ACTIONS.BUDGET_SUBMITTED, module: "budget", recordId: entry.id, recordTitle: entry.title }),
                              });
                            }}>Submit</button>
                          )}
                          {(canApprove || (canEdit && entry.status === "draft")) && (
                            <button className="btn btn-sm btn-danger" onClick={() => delEntry(entry.id)}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isReviewing && (
                      <tr>
                        <td colSpan={8} style={{ background: "#fdf0ee", padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: "#c0392b", marginBottom: 8, fontSize: 13 }}>Reason for rejection (optional)</div>
                          <textarea rows={2} value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                            placeholder="Explain why this entry is rejected…"
                            style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid #ddd", borderRadius: 5 }} />
                          <div className="btn-row" style={{ marginTop: 8 }}>
                            <button className="btn btn-sm btn-danger" onClick={() => approve(entry.id, false, reviewComment)}>Confirm rejection</button>
                            <button className="btn btn-sm" onClick={() => { setReviewId(null); setReviewAction(""); }}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Spending overview ── */}
      <div className="panel">
        <div className="panel-title">Spending by program (from logged activities)</div>
        <table>
          <thead>
            <tr><th>Program</th><th>Category</th><th>Sessions done</th><th>Participants</th><th>Total (TZS)</th><th>Total (USD)</th>{grantTotal > 0 && <th>% of grant</th>}</tr>
          </thead>
          <tbody>
            {programs.map(p => {
              const stats = programStats(p.id, activities);
              const pTZS = activities.filter(a => a.programId === p.id).reduce((s, a) => s + activityTotalTZS(a), 0);
              return (
                <tr key={p.id}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="prog-dot" style={{ background: p.color }} />
                      {p.name}
                    </span>
                  </td>
                  <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{p.category}</span></td>
                  <td>{stats.completed}/{p.plannedSessions}</td>
                  <td>{stats.totalParticipants}</td>
                  <td>{fmt(pTZS)}</td>
                  <td style={{ fontWeight: 500 }}>{fmtUSD(stats.totalUSD)}</td>
                  {grantTotal > 0 && <td><span className={`badge ${pct(stats.totalUSD, grantTotal) > 30 ? "badge-amber" : "badge-gray"}`}>{pct(stats.totalUSD, grantTotal)}%</span></td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600, background: "#f5f4f0" }}>
              <td colSpan={4}>Total</td>
              <td>{fmt(activities.reduce((s, a) => s + activityTotalTZS(a), 0))}</td>
              <td>{fmtUSD(totalUSD)}</td>
              {grantTotal > 0 && <td>{pct(totalUSD, grantTotal)}%</td>}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="panel">
        <div className="panel-title">Spending by expense type</div>
        {Object.keys(byType).length === 0 ? (
          <div className="empty">No expenses logged yet. Add expenses in each activity's Expenses tab.</div>
        ) : (
          <table>
            <thead><tr><th>Expense type</th><th>Amount (USD)</th>{grantTotal > 0 && <th>% of grant</th>}</tr></thead>
            <tbody>
              {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, usd]) => (
                <tr key={type}>
                  <td>{type}</td>
                  <td style={{ fontWeight: 500 }}>{fmtUSD(usd)}</td>
                  {grantTotal > 0 && <td>{pct(usd, grantTotal)}%</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Metrics ──────────────────────────────────────────────────────────────────
export function Metrics({ state, update, role, currentUser }) {
  const [saved, setSaved] = useState(false);
  const [indForm, setIndForm] = useState(null);
  const [editIndId, setEditIndId] = useState(null);
  const m = state.metrics;
  const grant = state.grant || {};
  const effectiveRole = currentUser?.role || role;
  const canEdit = effectiveRole !== "viewer";

  const odUrl = grant.odCampaignUrl || `${OD_BASE}/campaigns/${getODSlug(grant.cycle)}`;

  const setM = (key, field, val) => {
    const metrics = { ...m, [key]: { ...m[key], [field]: Number(val) || 0 } };
    update({ metrics });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  const setP = (i, field, val) => {
    const projects = m.projects.map((p, idx) => idx === i ? { ...p, [field]: Number(val) || 0 } : p);
    update({ metrics: { ...m, projects } });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const rows = [
    { key: "participants",    label: "All participants" },
    { key: "allEditors",      label: "All editors" },
    { key: "newEditors",      label: "New editors" },
    { key: "retainedEditors", label: "Retained editors" },
    { key: "allOrganizers",   label: "All organizers" },
    { key: "newOrganizers",   label: "New organizers" },
  ];

  return (
    <div>
      <div className="page-title">Metrics</div>
      <div className="page-sub">Set targets when applying. Update results as activities happen.</div>
      <div className="alert alert-info">Targets and results are used to auto-generate your final report for Fluxx.</div>

      <OutreachPanel
        campaignUrl={odUrl}
        title="Outreach Dashboard — live editing metrics"
      />

      <fieldset disabled={!canEdit} style={{ border: "none", padding: 0, margin: 0 }}>
      <div className="panel">
        <div className="panel-title">Participants & editors</div>
        <table>
          <thead><tr><th>Metric</th><th>Target</th><th>Result</th><th>% achieved</th></tr></thead>
          <tbody>
            {rows.map(r => {
              const val = m[r.key];
              const p = pct(val.result, val.target);
              const col = p >= 100 ? "badge-green" : p >= 60 ? "badge-amber" : "badge-gray";
              return (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td><input type="number" defaultValue={val.target} onBlur={e => setM(r.key, "target", e.target.value)} style={{ width: 90 }} /></td>
                  <td><input type="number" defaultValue={val.result} onBlur={e => setM(r.key, "result", e.target.value)} style={{ width: 90 }} /></td>
                  <td><span className={`badge ${col}`}>{p}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-title">Wikimedia project contributions</div>
        <table>
          <thead>
            <tr><th>Project</th><th>Target created</th><th>Target improved</th><th>Result created</th><th>Result improved</th></tr>
          </thead>
          <tbody>
            {m.projects.map((p, i) => (
              <tr key={p.name}>
                <td><strong>{p.name}</strong></td>
                <td><input type="number" defaultValue={p.tCreated} onBlur={e => setP(i, "tCreated", e.target.value)} style={{ width: 85 }} /></td>
                <td><input type="number" defaultValue={p.tImproved} onBlur={e => setP(i, "tImproved", e.target.value)} style={{ width: 85 }} /></td>
                <td><input type="number" defaultValue={p.rCreated} onBlur={e => setP(i, "rCreated", e.target.value)} style={{ width: 85 }} /></td>
                <td><input type="number" defaultValue={p.rImproved} onBlur={e => setP(i, "rImproved", e.target.value)} style={{ width: 85 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </fieldset>

      {/* ── Custom M&E indicators ── */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>Custom M&amp;E indicators</div>
          {canEdit && (
            <button className="btn btn-sm btn-primary" onClick={() => {
              setIndForm({ id: uid(), name: "", baseline: 0, target: 0, achieved: 0, unit: "", notes: "" });
              setEditIndId(null);
            }}>+ Add indicator</button>
          )}
        </div>

        {indForm && (
          <div style={{ background: "#f9f9f7", border: "1px solid #e0e0da", borderRadius: 9, padding: 16, marginBottom: 16 }}>
            <div className="form-grid">
              <div className="field"><label>Indicator name <span className="req">★</span></label>
                <input value={indForm.name} onChange={e => setIndForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
              <div className="field"><label>Unit (e.g. %, people, articles)</label>
                <input value={indForm.unit} onChange={e => setIndForm(f => ({ ...f, unit: e.target.value }))} /></div>
            </div>
            <div className="form-grid">
              <div className="field"><label>Baseline</label>
                <input type="number" value={indForm.baseline} onChange={e => setIndForm(f => ({ ...f, baseline: Number(e.target.value) || 0 }))} /></div>
              <div className="field"><label>Target</label>
                <input type="number" value={indForm.target} onChange={e => setIndForm(f => ({ ...f, target: Number(e.target.value) || 0 }))} /></div>
              <div className="field"><label>Achieved</label>
                <input type="number" value={indForm.achieved} onChange={e => setIndForm(f => ({ ...f, achieved: Number(e.target.value) || 0 }))} /></div>
            </div>
            <div className="field"><label>Notes</label>
              <input value={indForm.notes} onChange={e => setIndForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={() => {
                if (!indForm.name.trim()) { alert("Indicator name is required."); return; }
                const indicators = m.indicators || [];
                const exists = indicators.find(i => i.id === indForm.id);
                const newList = exists ? indicators.map(i => i.id === indForm.id ? indForm : i) : [...indicators, indForm];
                update({ metrics: { ...m, indicators: newList } });
                setSaved(true); setTimeout(() => setSaved(false), 1500);
                setIndForm(null); setEditIndId(null);
              }}>{editIndId ? "Save changes" : "Add indicator"}</button>
              <button className="btn" onClick={() => { setIndForm(null); setEditIndId(null); }}>Cancel</button>
            </div>
          </div>
        )}

        {(m.indicators || []).length === 0 && !indForm ? (
          <div className="empty">No custom indicators yet.{canEdit ? " Click \"+ Add indicator\" to track additional M&E metrics." : ""}</div>
        ) : (
          <table>
            <thead><tr><th>Indicator</th><th>Unit</th><th>Baseline</th><th>Target</th><th>Achieved</th><th>Progress</th><th>Notes</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {(m.indicators || []).map(ind => {
                const progress = ind.target > 0 ? Math.min(100, Math.round(((ind.achieved - ind.baseline) / (ind.target - ind.baseline)) * 100)) : 0;
                const color = progress >= 100 ? "#2d7a4f" : progress >= 75 ? "#4a9e6b" : progress >= 50 ? "#d97706" : "#ea580c";
                return (
                  <tr key={ind.id}>
                    <td style={{ fontWeight: 500 }}>{ind.name}</td>
                    <td style={{ fontSize: 12, color: "#888" }}>{ind.unit || "—"}</td>
                    <td>{ind.baseline}</td>
                    <td>{ind.target}</td>
                    <td style={{ fontWeight: 600, color }}>{ind.achieved}</td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, background: "#e8e8e4", borderRadius: 4, height: 6, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(0, progress)}%`, height: 6, background: color, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{progress}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "#666" }}>{ind.notes || "—"}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-sm" onClick={() => { setIndForm({ ...ind }); setEditIndId(ind.id); }}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => {
                            if (!window.confirm("Delete this indicator?")) return;
                            const newList = (m.indicators || []).filter(i => i.id !== ind.id);
                            update({ metrics: { ...m, indicators: newList } });
                          }}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {saved && <div className="alert alert-success">Metrics saved.</div>}
    </div>
  );
}

// ─── Final Report ──────────────────────────────────────────────────────────────
function QuestionBlock({ qnum, question, hint, ansKey, ans, setAns, children, canEdit = true }) {
  const copy = () => navigator.clipboard.writeText(ans[ansKey] || "");
  return (
    <div className="rpt-q-block">
      <div className="rpt-q-num">{qnum}</div>
      <div className="rpt-q-text">{question}</div>
      {hint && <div className="rpt-q-hint">{hint}</div>}
      {children && <div className="rpt-q-data">{children}</div>}
      {ansKey && (
        <div style={{ marginTop: 8 }}>
          <textarea
            className="rpt-q-answer"
            rows={5}
            placeholder={canEdit ? "Write your answer here…" : "(Sign in as Coordinator or Admin to write answers)"}
            value={ans[ansKey] || ""}
            onChange={e => canEdit && setAns(ansKey, e.target.value)}
            readOnly={!canEdit}
            style={!canEdit ? { background: "#f8f8f6", color: "#999" } : {}}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="btn btn-sm btn-primary" onClick={copy}>Copy answer</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinalReport({ state, update, role }) {
  const { programs = [], activities = [], metrics: m, grant = {}, reportAnswers = {} } = state;
  const canEdit = role !== "viewer";
  const grantTotal = Number(grant.totalUSD || 0);

  const completed = activities.filter(a => a.status === "Completed");
  const totalPart = m.participants.result;
  const totalWomen = completed.reduce((s, a) => s + Number(a.women || 0), 0);
  const wPct = totalPart ? Math.round((totalWomen / totalPart) * 100) : 0;
  const totalUSD = activities.reduce((s, a) => s + activityTotalUSD(a), 0);

  const setAns = (key, val) => update({ reportAnswers: { ...reportAnswers, [key]: val } });

  const metricRows = [
    { label: "All participants",    ...m.participants },
    { label: "All editors",         ...m.allEditors },
    { label: "New editors",         ...m.newEditors },
    { label: "Retained editors",    ...m.retainedEditors },
    { label: "All organizers",      ...m.allOrganizers },
    { label: "New organizers",      ...m.newOrganizers },
  ];

  const downloadAll = () => {
    const r = compileGrantReport(state);
    const section = (title, content) =>
      `<h2>${title}</h2><div class="ans">${content.replace(/\n/g, "<br>")}</div>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>GSF Final Learning Report</title>
<style>
  body{font-family:Arial,sans-serif;max-width:860px;margin:40px auto;color:#1a1a1a;font-size:13px;line-height:1.6}
  .hdr{display:flex;align-items:center;gap:20px;border-bottom:3px solid #4a9e6b;padding-bottom:16px;margin-bottom:28px}
  .hdr img{width:80px;height:auto}
  .hdr h1{font-size:16px;font-weight:700;color:#1c2b1e;margin:0 0 3px}
  .hdr p{font-size:12px;color:#666;margin:0}
  h2{font-size:12px;font-weight:700;color:#1c2b1e;text-transform:uppercase;letter-spacing:.5px;background:#e8f5ec;padding:8px 12px;border-radius:4px;margin:28px 0 8px}
  .ans{background:#f9f9f7;border:1px solid #e8e8e4;border-radius:6px;padding:14px 16px;white-space:pre-wrap}
  .footer{margin-top:40px;padding-top:12px;border-top:1px solid #e8e8e4;font-size:11px;color:#aaa}
</style></head><body>
<div class="hdr">
  <img src="${logo}" alt="logo">
  <div><h1>Wikimedia Community Kilimanjaro — GSF Final Learning Report</h1>
  <p>${state.grant?.cycle || "2026–2027"} Grant Cycle · Grant ID: ${state.grant?.id || "—"}</p></div>
</div>
${section("Part 1, Q1 — Programs, approaches and challenges", r.part1q1)}
${section("Part 1, Q2 — Plans to build on successes", r.part1q2)}
${section("Part 1, Q3–Q6 — Links, sharing, diversity", r.part1q3_q6)}
${section("Part 2 — Metrics", r.part2metrics)}
${section("Part 3 — Skill development", r.part3skills)}
${section("Part 4 — Financial report", r.part4finance)}
<div class="footer">Generated: ${new Date().toLocaleString()}</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `GSF-Final-Report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-title">Final learning report</div>
      <div className="page-sub">Answer each Fluxx question below. Auto-filled data is shown in blue panels. Your typed answers save automatically.</div>

      {/* ── Visual overview ── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Visual overview</div>

        <div className="card-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Activities completed</div>
            <div className="stat-value green">{completed.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total participants</div>
            <div className="stat-value blue">{fmt(totalPart)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Women participants</div>
            <div className="stat-value" style={{ color: "#9333ea" }}>{wPct}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total spent</div>
            <div className="stat-value amber">{fmtUSD(totalUSD)}</div>
          </div>
          {grantTotal > 0 && (
            <div className="stat-card">
              <div className="stat-label">Grant used</div>
              <div className="stat-value" style={{ color: pct(totalUSD, grantTotal) > 100 ? "#c0392b" : "#b06a00" }}>
                {pct(totalUSD, grantTotal)}%
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 22 }}>
          <div className="rpt-section-label">Metrics achievement (result / target)</div>
          {metricRows.map(row => {
            const p = pct(row.result, row.target);
            const color = p >= 100 ? "#2d7a4f" : p >= 60 ? "#e0900a" : "#888";
            return (
              <div key={row.label} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#444" }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>{fmt(row.result)} / {fmt(row.target)} &nbsp; {p}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(p, 100)}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 22 }}>
          <div className="rpt-section-label">Program session completion</div>
          {programs.map(prog => {
            const stats = programStats(prog.id, activities);
            const p = prog.plannedSessions > 0 ? Math.round((stats.completed / prog.plannedSessions) * 100) : 0;
            return (
              <div key={prog.id} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444" }}>
                    <span className="prog-dot" style={{ background: prog.color }} />{prog.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{stats.completed}/{prog.plannedSessions} sessions · {fmt(stats.totalParticipants)} participants</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(p, 100)}%`, background: prog.color }} />
                </div>
              </div>
            );
          })}
        </div>

        {totalUSD > 0 && (
          <div>
            <div className="rpt-section-label">Budget spent by program</div>
            {programs.map(prog => {
              const stats = programStats(prog.id, activities);
              if (stats.totalUSD === 0) return null;
              const p = Math.round((stats.totalUSD / totalUSD) * 100);
              return (
                <div key={prog.id} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#444" }}>
                      <span className="prog-dot" style={{ background: prog.color }} />{prog.name}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtUSD(stats.totalUSD)} ({p}%)</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${p}%`, background: prog.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="btn-row" style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={downloadAll}>↓ Download full report (.txt)</button>
        <button className="btn" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      {/* ── Part 1 ── */}
      <div className="rpt-part-header">Part 1 — Your work and learning</div>

      <QuestionBlock
        qnum="Q1"
        question="Describe your programs and approaches for the year and what activities and strategies you used. Explain how and why you adapted your planned activities, approaches, and/or strategy. What were the major challenges you faced?"
        hint="Reference the activities below. Explain each program, what happened, and any changes from your plan."
        ansKey="q1" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      >
        <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Activities completed this cycle:</div>
        {completed.length === 0 ? (
          <div style={{ fontSize: 12, color: "#888" }}>No completed activities yet.</div>
        ) : (
          <table style={{ fontSize: 12 }}>
            <thead><tr><th>Activity</th><th>Date</th><th>Location</th><th>Participants</th></tr></thead>
            <tbody>
              {completed.map(a => {
                const prog = programs.find(p => p.id === a.programId);
                return (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td style={{ color: "#888", whiteSpace: "nowrap" }}>{a.date}</td>
                    <td style={{ color: "#888" }}>{a.location || "—"}</td>
                    <td>{a.totalParticipants || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {completed.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Summaries & challenges from your activity logs:</div>
            {completed.filter(a => a.summary || a.challenges).map(a => (
              <div key={a.id} style={{ fontSize: 12, color: "#444", marginBottom: 6, borderLeft: "3px solid #e8e8e4", paddingLeft: 8 }}>
                <strong>{a.title}:</strong>
                {a.summary && <div>{a.summary}</div>}
                {a.challenges && <div style={{ color: "#888" }}>Challenges: {a.challenges}</div>}
              </div>
            ))}
          </div>
        )}
      </QuestionBlock>

      <QuestionBlock
        qnum="Q2"
        question="What did you learn about what worked and what didn't work, and what would you do differently? What were your biggest achievements? What are your plans going forward to build on your successes?"
        hint="Use lessons learned and impact stories from your activity logs."
        ansKey="q2" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      >
        {completed.filter(a => a.lessons || a.stories || a.nextSteps).length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Lessons & stories from your activity logs:</div>
            {completed.filter(a => a.lessons || a.stories).map(a => (
              <div key={a.id} style={{ fontSize: 12, color: "#444", marginBottom: 6, borderLeft: "3px solid #e8e8e4", paddingLeft: 8 }}>
                <strong>{a.title}:</strong>
                {a.lessons && <div>Lessons: {a.lessons}</div>}
                {a.stories && <div>Stories: {a.stories}</div>}
              </div>
            ))}
          </div>
        )}
      </QuestionBlock>

      <QuestionBlock
        qnum="Q3"
        question="Please link to your learning log or any other relevant online documentation (Meta-Wiki pages, reports, dashboards)."
        hint="Add your Meta-Wiki grant page link and any activity documentation links."
        ansKey="q3" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      >
        {state.org.metaPage && <div style={{ fontSize: 12, color: "#555" }}>Meta-Wiki page: <strong>{state.org.metaPage}</strong></div>}
        {completed.filter(a => a.metaLink || a.photosLink).map(a => (
          <div key={a.id} style={{ fontSize: 12, color: "#555" }}>
            {a.title}: {a.metaLink && <span>Meta: {a.metaLink} </span>}{a.photosLink && <span>Photos: {a.photosLink}</span>}
          </div>
        ))}
      </QuestionBlock>

      <QuestionBlock
        qnum="Q4"
        question="Are there ways you'd like to share your work more broadly with the Wikimedia or free knowledge community?"
        ansKey="q4" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      />

      <QuestionBlock
        qnum="Q5"
        question="Please describe how you measure or capture the impact of the activities you organize."
        hint="Describe your tracking methods: participation forms, Wikipedia article tracking, Programs & Events Dashboard, etc."
        ansKey="q5" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      />

      <QuestionBlock
        qnum="Q6.1"
        question="How is your organization making sure that it is sufficiently diverse in terms of participants and leadership?"
        hint="Reference your Wikimalkia — WikiQueens and Feminism & Folklore Tanzania programs, and your women/youth participation data."
        ansKey="q6_1" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      >
        <div style={{ fontSize: 12, color: "#555" }}>
          Women participants (from completed activities): <strong>{totalWomen}</strong> ({wPct}% of {fmt(totalPart)} total)
        </div>
      </QuestionBlock>

      <QuestionBlock
        qnum="Q6.2"
        question="What steps are you taking to ensure diverse content is available on Wikipedia and other Wikimedia projects?"
        hint="Reference Error and Fix Campaign, Feminism & Folklore Tanzania, WikiHealth, and content in Swahili."
        ansKey="q6_2" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      />

      <QuestionBlock
        qnum="Q6.3"
        question="What steps are you taking to retain participants, especially women and other underrepresented groups?"
        hint="Mention follow-up mentorship, Wikimalkia community, and ongoing engagement strategies."
        ansKey="q6_3" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      />

      {/* ── Part 2 ── */}
      <div className="rpt-part-header">Part 2 — Metrics</div>

      <div className="rpt-q-block">
        <div className="rpt-q-num">14.1</div>
        <div className="rpt-q-text">Participants, editors, and organizers — target vs result</div>
        <div className="rpt-q-data">
          <table style={{ fontSize: 12 }}>
            <thead><tr><th>Metric</th><th>Target</th><th>Result</th><th>% achieved</th></tr></thead>
            <tbody>
              {metricRows.map(r => {
                const p = pct(r.result, r.target);
                return (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>{fmt(r.target)}</td>
                    <td><strong>{fmt(r.result)}</strong></td>
                    <td><span className={`badge ${p >= 100 ? "badge-green" : p >= 60 ? "badge-amber" : "badge-gray"}`}>{p}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>Update results in the Metrics page.</div>
        </div>
      </div>

      <div className="rpt-q-block">
        <div className="rpt-q-num">14.2</div>
        <div className="rpt-q-text">Wikimedia project contributions — target vs result</div>
        <div className="rpt-q-data">
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr><th>Project</th><th>Created target</th><th>Created result</th><th>%</th><th>Improved target</th><th>Improved result</th><th>%</th></tr>
            </thead>
            <tbody>
              {m.projects.map(p => {
                const pc = pct(p.rCreated, p.tCreated);
                const pi = pct(p.rImproved, p.tImproved);
                const badge = v => v >= 100 ? "badge-green" : v >= 60 ? "badge-amber" : "badge-gray";
                return (
                  <tr key={p.name}>
                    <td><strong>{p.name}</strong></td>
                    <td style={{ color: "#888" }}>{fmt(p.tCreated)}</td><td>{fmt(p.rCreated)}</td>
                    <td><span className={`badge ${badge(pc)}`}>{pc}%</span></td>
                    <td style={{ color: "#888" }}>{fmt(p.tImproved)}</td><td>{fmt(p.rImproved)}</td>
                    <td><span className={`badge ${badge(pi)}`}>{pi}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>Update results in the Metrics page.</div>
        </div>
      </div>

      {/* ── Part 3 ── */}
      <div className="rpt-part-header">Part 3 — Skill development and capacity building</div>

      <QuestionBlock
        qnum="Q12"
        question="What new skills have you or other members of your organization developed as a result of receiving this grant? How will these skills help your organization continue to address community needs in the future?"
        hint="Think about Wikipedia editing, event management, leadership, outreach, health content, digital literacy (Kiwix)."
        ansKey="q12" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      />

      <QuestionBlock
        qnum="Q13"
        question="What is one capacity area you think your organization should focus on in the coming year and why?"
        ansKey="q13" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      />

      {/* ── Part 4 ── */}
      <div className="rpt-part-header">Part 4 — Financial reporting</div>

      <div className="rpt-q-block">
        <div className="rpt-q-num">Q15–16</div>
        <div className="rpt-q-text">Total amount spent and breakdown by program</div>
        <div className="rpt-q-data">
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <strong>Total grant: </strong>{fmtUSD(grantTotal)} &nbsp;|&nbsp;
            <strong>Total spent: </strong>{fmtUSD(totalUSD)} &nbsp;|&nbsp;
            <strong>Remaining: </strong>{fmtUSD(Math.max(0, grantTotal - totalUSD))} &nbsp;|&nbsp;
            <strong>Rate used: </strong>{grant.conversionRate || "0.000413"} TZS/USD
          </div>
          <table style={{ fontSize: 12 }}>
            <thead><tr><th>Program</th><th>Sessions</th><th>Participants</th><th>Total (TZS)</th><th>Total (USD)</th></tr></thead>
            <tbody>
              {programs.map(p => {
                const stats = programStats(p.id, activities);
                const pTZS = activities.filter(a => a.programId === p.id).reduce((s, a) => s + activityTotalTZS(a), 0);
                return (
                  <tr key={p.id}>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="prog-dot" style={{ background: p.color }} />{p.name}</span></td>
                    <td>{stats.completed}/{p.plannedSessions}</td>
                    <td>{stats.totalParticipants}</td>
                    <td>{fmt(pTZS)}</td>
                    <td><strong>{fmtUSD(stats.totalUSD)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600, background: "#f5f4f0" }}>
                <td colSpan={3}>Total</td>
                <td>{fmt(activities.reduce((s, a) => s + activityTotalTZS(a), 0))}</td>
                <td>{fmtUSD(totalUSD)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <QuestionBlock
        qnum="Q17"
        question="Have you received any other sources of revenue, funding, or support during this grant period? If yes, please describe."
        ansKey="q17" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      />

      <QuestionBlock
        qnum="Q18"
        question="Please provide a link to your financial report document."
        hint="This is usually a Google Spreadsheet or document on Meta-Wiki."
        ansKey="q18" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      />

      <QuestionBlock
        qnum="Q19"
        question="If you have unspent funds remaining at the end of the grant period, please describe how you intend to use them or return them to the Wikimedia Foundation."
        ansKey="q19" ans={reportAnswers} setAns={setAns} canEdit={canEdit}
      >
        {grantTotal > 0 && (
          <div style={{ fontSize: 12, color: "#555" }}>
            Unspent funds: <strong>{fmtUSD(Math.max(0, grantTotal - totalUSD))}</strong> ({Math.max(0, 100 - pct(totalUSD, grantTotal))}% of grant)
          </div>
        )}
      </QuestionBlock>

      <div className="rpt-q-block">
        <div className="rpt-q-num">Q20</div>
        <div className="rpt-q-text">Compliance declarations</div>
        <div className="rpt-q-data" style={{ fontSize: 12, color: "#555" }}>
          Confirm in Fluxx that you have complied with: (1) the terms of your grant agreement, (2) applicable laws and regulations, (3) US IRS Code provisions.
        </div>
      </div>

      <div className="btn-row" style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={downloadAll}>↓ Download full report (.txt)</button>
        <button className="btn" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function Settings({ state, update, role, currentUser, onChangePwd }) {
  const o = state.org || {};
  const effectiveRole = currentUser?.role || role;
  const isAdmin = effectiveRole === "admin";
  const [clientId, setClientId] = useState(getStoredClientId);
  const [driveStatus, setDriveStatus] = useState(isSignedIn() ? "connected" : "idle");
  const [driveMsg, setDriveMsg] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const stored = getStoredClientId();
    if (stored) initDriveClient(stored).catch(() => {});
  }, []);

  const msg = (text, isErr) => {
    setDriveMsg(text);
    if (!isErr) setTimeout(() => setDriveMsg(""), 3000);
  };

  const handleSaveClientId = async () => {
    if (!clientId.trim()) { msg("Paste your OAuth Client ID first.", true); return; }
    storeClientId(clientId);
    try {
      await initDriveClient(clientId.trim());
      msg("Client ID saved. Click Connect to sign in.");
    } catch { msg("Failed to initialize — check your Client ID.", true); }
  };

  const handleConnect = async () => {
    if (!clientId.trim()) { msg("Save your Client ID first.", true); return; }
    setDriveStatus("connecting");
    try {
      await initDriveClient(clientId.trim());
      await signIn();
      setDriveStatus("connected");
      msg("Connected to Google Drive.");
    } catch (e) {
      setDriveStatus("idle");
      msg(e.message || "Sign-in failed.", true);
    }
  };

  const handleDisconnect = () => { signOut(); setDriveStatus("idle"); msg("Disconnected."); };

  const handleSave = async () => {
    try { setDriveMsg("Saving…"); await saveToDrive(state); msg("Saved to Google Drive."); }
    catch (e) { msg(e.message || "Save failed.", true); }
  };

  const handleLoad = async () => {
    if (!window.confirm("Load from Google Drive? This will overwrite your current data.")) return;
    try {
      setDriveMsg("Loading…");
      const loaded = await loadFromDrive();
      if (!loaded) { msg("No backup file found on Drive.", true); return; }
      update(loaded);
      msg("Data loaded from Google Drive.");
    } catch (e) { msg(e.message || "Load failed.", true); }
  };

  const connected = driveStatus === "connected";
  const connecting = driveStatus === "connecting";

  return (
    <div>
      <div className="page-title">Settings</div>
      <div className="page-sub">Organisation details, grant configuration, and data management.</div>

      <div className="panel">
        <div className="panel-title">Organisation</div>
        {!isAdmin && (
          <div style={{ fontSize: 12, color: "#888", background: "#f5f4f0", borderRadius: 6, padding: "7px 11px", marginBottom: 12 }}>
            Organisation details can only be edited by an Admin.
          </div>
        )}
        <div className="form-grid">
          <div className="field"><label>Organisation name</label>
            {isAdmin
              ? <input value={o.name || ""} onChange={e => update({ org: { ...o, name: e.target.value } })} />
              : <div style={{ padding: "7px 10px", background: "#f9f9f7", border: "1px solid #e8e8e4", borderRadius: 6, fontSize: 13 }}>{o.name || "—"}</div>}
          </div>
          <div className="field"><label>Country</label>
            {isAdmin
              ? <input value={o.country || ""} onChange={e => update({ org: { ...o, country: e.target.value } })} placeholder="Tanzania" />
              : <div style={{ padding: "7px 10px", background: "#f9f9f7", border: "1px solid #e8e8e4", borderRadius: 6, fontSize: 13 }}>{o.country || "—"}</div>}
          </div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Contact email</label>
            {isAdmin
              ? <input value={o.contactEmail || ""} onChange={e => update({ org: { ...o, contactEmail: e.target.value } })} placeholder="you@example.com" />
              : <div style={{ padding: "7px 10px", background: "#f9f9f7", border: "1px solid #e8e8e4", borderRadius: 6, fontSize: 13 }}>{o.contactEmail || "—"}</div>}
          </div>
          <div className="field"><label>Organisation website</label>
            {isAdmin
              ? <input value={o.website || ""} onChange={e => update({ org: { ...o, website: e.target.value } })} placeholder="https://..." />
              : <div style={{ padding: "7px 10px", background: "#f9f9f7", border: "1px solid #e8e8e4", borderRadius: 6, fontSize: 13 }}>{o.website || "—"}</div>}
          </div>
        </div>
        <div className="form-grid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Meta-Wiki page</label>
            {isAdmin
              ? <input value={o.metaPage || ""} onChange={e => update({ org: { ...o, metaPage: e.target.value } })} placeholder="https://meta.wikimedia.org/..." />
              : <div style={{ padding: "7px 10px", background: "#f9f9f7", border: "1px solid #e8e8e4", borderRadius: 6, fontSize: 13 }}>{o.metaPage || "—"}</div>}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
          Grant configuration (ID, amount, dates, Outreach Dashboard URL) is managed on the <strong>Grant</strong> page.
        </div>
      </div>

      {/* Admin password change — only shown to admin */}
      {isAdmin && (
        <div className="panel">
          <div className="panel-title">Admin password</div>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
            {state.auth?.pinHash ? "Admin password is set." : "No admin password set — anyone can access admin functions."}
          </p>
          <button className="btn btn-sm" onClick={onChangePwd}>
            {state.auth?.pinHash ? "Change password" : "Set admin password"}
          </button>
        </div>
      )}

      {/* Google Drive sync — admin only */}
      {isAdmin && (
        <div className="panel">
          <div className="panel-title">Google Drive sync</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", display: "inline-block", background: connected ? "#2d7a4f" : connecting ? "#b06a00" : "#aaa" }} />
            <span style={{ fontSize: 13, color: "#444" }}>{connected ? "Connected to Google Drive" : connecting ? "Connecting…" : "Not connected"}</span>
          </div>
          <div className="form-grid" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Google OAuth Client ID</label>
              <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" style={{ fontFamily: "monospace", fontSize: 12 }} />
            </div>
            <div style={{ paddingBottom: 2 }}>
              <button className="btn" onClick={handleSaveClientId}>Save ID</button>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 4 }}>
            {!connected && <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>{connecting ? "Connecting…" : "Connect to Google Drive"}</button>}
            {connected && <>
              <button className="btn btn-primary" onClick={handleSave}>↑ Save to Drive</button>
              <button className="btn" onClick={handleLoad}>↓ Load from Drive</button>
              <button className="btn btn-danger" onClick={handleDisconnect}>Disconnect</button>
            </>}
          </div>
          {driveMsg && <div className="alert alert-info" style={{ marginTop: 10 }}>{driveMsg}</div>}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-sm" style={{ fontSize: 12 }} onClick={() => setShowSetup(!showSetup)}>
              {showSetup ? "Hide" : "Show"} setup instructions
            </button>
          </div>
          {showSetup && (
            <div style={{ marginTop: 12, fontSize: 13, color: "#444", lineHeight: 1.7, background: "#f5f4f0", padding: 14, borderRadius: 6 }}>
              <strong>One-time Google Cloud setup:</strong>
              <ol style={{ margin: "8px 0 0 18px", padding: 0 }}>
                <li>Go to <strong>console.cloud.google.com</strong> and create a project.</li>
                <li>Enable the <strong>Google Drive API</strong> (APIs &amp; Services → Library).</li>
                <li>Go to <strong>OAuth consent screen</strong>. Set type to External, add your email as test user.</li>
                <li>Go to <strong>Credentials → Create credentials → OAuth client ID</strong>. Choose Web application.</li>
                <li>Under <strong>Authorized JavaScript origins</strong>, add <code>http://localhost:3000</code>.</li>
                <li>Copy the <strong>Client ID</strong>, paste it above, click Save ID, then Connect.</li>
              </ol>
              <p style={{ marginTop: 8, color: "#666" }}>The app stores one file <code>wkgsf-data.json</code> in your Drive. Only this app can access it.</p>
            </div>
          )}
        </div>
      )}

      {/* Data management — admin only */}
      {isAdmin && (
        <div className="panel">
          <div className="panel-title">Data management</div>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>All data is saved automatically in your browser's local storage.</p>
          <div className="btn-row">
            <button className="btn" onClick={() => {
              const now = new Date().toISOString();
              const json = JSON.stringify(state, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const el = document.createElement("a");
              el.href = url; el.download = `wkgsf-backup-${now.slice(0, 10)}.json`;
              el.click(); URL.revokeObjectURL(url);
              const history = (state.backupHistory || []);
              update({ backupHistory: [{ timestamp: now, type: "manual", size: Math.round(json.length / 1024) }, ...history].slice(0, 20) });
            }}>↓ Export backup (JSON)</button>
            <label className="btn" style={{ cursor: "pointer" }}>
              ↑ Import backup (JSON)
              <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    const data = JSON.parse(ev.target.result);
                    if (window.confirm("Replace all data with this backup?")) { update(data); alert("Backup imported."); }
                  } catch { alert("Invalid JSON file."); }
                };
                reader.readAsText(file);
                e.target.value = "";
              }} />
            </label>
            <button className="btn btn-danger" onClick={() => {
              if (window.confirm("Reset ALL data? This cannot be undone.")) {
                localStorage.clear(); window.location.reload();
              }
            }}>Reset all data</button>
          </div>

          {/* Backup history */}
          {(state.backupHistory || []).length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Backup history</div>
              <table style={{ fontSize: 12 }}>
                <thead><tr><th>#</th><th>Date &amp; time</th><th>Type</th><th>Size</th></tr></thead>
                <tbody>
                  {(state.backupHistory || []).map((b, i) => (
                    <tr key={b.timestamp}>
                      <td style={{ color: "#aaa" }}>{(state.backupHistory || []).length - i}</td>
                      <td>{new Date(b.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td><span className="badge badge-gray">Manual</span></td>
                      <td style={{ color: "#888" }}>{b.size} KB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
