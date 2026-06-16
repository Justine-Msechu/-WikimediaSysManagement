import React, { useState, useEffect } from "react";
import { listenPrograms, addProgram, updateProgram, deleteProgram, submitProgram, DEFAULT_PROGRAMS, PROGRAM_CATEGORIES } from "../services/programService";
import { listenActivities } from "../services/activityService";
import { listenSettings } from "../services/settingsService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

const STATUS_BADGE = {
  draft:     { label: "Draft",            color: "#2563eb", bg: "#eff6ff" },
  submitted: { label: "Pending approval", color: "#d97706", bg: "#fff8e1" },
  approved:  { label: "Approved (Locked)", color: "#2d7a4f", bg: "#f0f7f3" },
};

const PROGRAM_COLORS = ["#2d7a4f", "#2563eb", "#9333ea", "#d97706", "#0891b2", "#c0392b", "#059669", "#7c3aed", "#db2777"];

const EXPENSE_TYPES = [
  "Food and drinks", "Venue / Room Hire", "Transport", "Facilitators",
  "Equipment", "Materials", "Internet/Supplies", "Bank charges", "Other",
];

function fmt(n)    { return (n || 0).toLocaleString(); }
function fmtUSD(n) { return `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function emptyItem(rate) {
  return { id: Date.now().toString() + Math.random(), description: "", note: "", unitCost: 0, quantity: 1, expenseType: "Food and drinks", exchangeRate: rate };
}

function emptyProgram(rate) {
  return { name: "", category: "Content Creation", description: "", plannedSessions: 1, color: PROGRAM_COLORS[0], exchangeRate: rate, budgetItems: [] };
}

function computeTotal(items) {
  return items.reduce((s, item) => s + (Number(item.unitCost) || 0) * (Number(item.quantity) || 1), 0);
}

export default function Programs({ profile }) {
  const [programs,   setPrograms]   = useState([]);
  const [activities, setActivities] = useState([]);
  const [settings,   setSettings]   = useState(null);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(emptyProgram(0.000438));
  const [expanded,   setExpanded]   = useState(null); // program id showing budget detail
  const [toast,      setToast]      = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenPrograms(setPrograms);
    const u2 = listenActivities(setActivities);
    const u3 = listenSettings(setSettings);
    return () => { u1(); u2(); u3(); };
  }, []);

  const rate = Number(settings?.grant?.conversionRate || 0.000438);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyProgram(rate)); setEditId(null); setShowForm(true); };
  const openEdit   = (p) => {
    setForm({
      name: p.name, category: p.category, description: p.description || "",
      plannedSessions: p.plannedSessions || 1, color: p.color || PROGRAM_COLORS[0],
      exchangeRate: p.exchangeRate || rate,
      budgetItems: (p.budgetItems || []).map(it => ({ ...it })),
    });
    setEditId(p.id); setShowForm(true);
  };

  // Budget item handlers
  const addItem    = () => setF("budgetItems", [...form.budgetItems, emptyItem(form.exchangeRate || rate)]);
  const removeItem = (i) => setF("budgetItems", form.budgetItems.filter((_, j) => j !== i));
  const setItem    = (i, k, v) => setF("budgetItems", form.budgetItems.map((it, j) => j === i ? { ...it, [k]: v } : it));

  const save = async () => {
    if (!form.name.trim()) { alert("Program name is required."); return; }
    const plannedBudget = computeTotal(form.budgetItems);
    const data = { ...form, plannedBudget };
    if (!editId) {
      const id = await addProgram(data);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "programs", { targetId: id, recordTitle: form.name });
      showToast("Program created.");
    } else {
      await updateProgram(editId, data);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "programs", { targetId: editId, recordTitle: form.name });
      showToast("Program updated.");
    }
    setShowForm(false);
  };

  const del = async (p) => {
    if (!window.confirm(`Delete program "${p.name}"? Activities linked to it will remain.`)) return;
    await deleteProgram(p.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "programs", { targetId: p.id, recordTitle: p.name });
    showToast("Program deleted.");
  };

  const submit = async (p) => {
    if (!p.budgetItems?.length) { alert("Add at least one budget item before submitting."); return; }
    if (!window.confirm(`Submit "${p.name}" for approval? You will not be able to edit it until it is reviewed.`)) return;
    await submitProgram(p.id, profile?.name || "");
    await addAudit(profile, AUDIT_ACTIONS.SUBMIT, "programs", { targetId: p.id, recordTitle: p.name });
    showToast(`"${p.name}" submitted for approval.`);
  };

  const isAdmin = profile?.role === "admin";
  const isDraft = (p) => !p.status || p.status === "draft";
  const canEditProgram = (p) => isAdmin || (canEdit && isDraft(p));

  const statsFor = (pid) => {
    const acts = activities.filter(a => a.programId === pid);
    return {
      sessions:     acts.length,
      participants: acts.reduce((s, a) => s + (a.participants || 0), 0),
      women:        acts.reduce((s, a) => s + (a.women || 0), 0),
      newEditors:   acts.reduce((s, a) => s + (a.newEditors || 0), 0),
    };
  };

  const seedDefaults = async () => {
    if (!window.confirm("Add the 9 default program areas? Existing programs will not be affected.")) return;
    for (const p of DEFAULT_PROGRAMS) await addProgram({ ...p, exchangeRate: rate, budgetItems: [] });
    showToast("Default programs added.");
  };

  const formTotal    = computeTotal(form.budgetItems);
  const formTotalUSD = formTotal * (form.exchangeRate || rate);

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Programs</div>

      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16 }}>
          {programs.length === 0 && <button className="btn" onClick={seedDefaults}>Add default programs</button>}
          <button className="btn btn-primary" onClick={openCreate}>+ New program</button>
        </div>
      )}

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit program" : "New program"}</div>

          {/* Basic info */}
          <div className="form-grid">
            <div className="field"><label>Program name <span className="req">★</span></label><input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="e.g. Wiki Women" /></div>
            <div className="field"><label>Category</label>
              <select value={form.category} onChange={e => setF("category", e.target.value)}>
                {PROGRAM_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Planned sessions</label><input type="number" min="1" value={form.plannedSessions} onChange={e => setF("plannedSessions", Number(e.target.value))} /></div>
            <div className="field"><label>Exchange rate (USD per TZS)</label>
              <input type="number" step="0.000001" value={form.exchangeRate || rate} onChange={e => setF("exchangeRate", Number(e.target.value) || rate)} placeholder={rate} />
            </div>
            <div className="field"><label>Colour</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
                {PROGRAM_COLORS.map(c => (
                  <div key={c} onClick={() => setF("color", c)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: form.color === c ? "3px solid #1c2b1e" : "2px solid transparent" }} />
                ))}
              </div>
            </div>
          </div>
          <div className="field"><label>Description</label><textarea rows={2} value={form.description} onChange={e => setF("description", e.target.value)} placeholder="Describe the goals and approach of this program" /></div>

          {/* Budget line items */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Budget breakdown</div>
              <button className="btn btn-sm btn-primary" onClick={addItem}>+ Add line item</button>
            </div>

            {form.budgetItems.length === 0 ? (
              <div className="empty" style={{ padding: "12px 0" }}>No budget items yet. Click "+ Add line item" to start.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Note</th>
                      <th style={{ textAlign: "right" }}>Unit cost (TZS)</th>
                      <th style={{ textAlign: "center" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Total (TZS)</th>
                      <th>Expense type</th>
                      <th style={{ textAlign: "right" }}>USD</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.budgetItems.map((item, i) => {
                      const total = (Number(item.unitCost) || 0) * (Number(item.quantity) || 1);
                      const usd   = total * (form.exchangeRate || rate);
                      return (
                        <tr key={item.id}>
                          <td><input value={item.description} onChange={e => setItem(i, "description", e.target.value)} placeholder="e.g. Food and drinks" style={{ minWidth: 160 }} /></td>
                          <td><input value={item.note} onChange={e => setItem(i, "note", e.target.value)} placeholder="e.g. Refreshments for participants" style={{ minWidth: 180 }} /></td>
                          <td><input type="number" min="0" value={item.unitCost || ""} onChange={e => setItem(i, "unitCost", Number(e.target.value) || 0)} style={{ width: 110, textAlign: "right" }} /></td>
                          <td><input type="number" min="1" value={item.quantity || ""} onChange={e => setItem(i, "quantity", Number(e.target.value) || 1)} style={{ width: 60, textAlign: "center" }} /></td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(total)}</td>
                          <td>
                            <select value={item.expenseType} onChange={e => setItem(i, "expenseType", e.target.value)} style={{ minWidth: 140 }}>
                              {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                          </td>
                          <td style={{ textAlign: "right", color: "#555" }}>{fmtUSD(usd)}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => removeItem(i)}>✕</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: "#f5f4f0" }}>
                      <td colSpan={4} style={{ textAlign: "right" }}>You wish to be reimbursed in TZS:</td>
                      <td style={{ textAlign: "right", fontSize: 14 }}>{fmt(formTotal)}</td>
                      <td style={{ textAlign: "right", fontSize: 12, color: "#555" }}>USD</td>
                      <td style={{ textAlign: "right", fontSize: 14 }}>{fmtUSD(formTotalUSD)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={save}>Save program</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {programs.length === 0 ? (
        <div className="panel"><div className="empty">No programs yet. Add the default program areas or create a custom one.</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {programs.map(p => {
            const s      = statsFor(p.id);
            const total  = p.plannedBudget || computeTotal(p.budgetItems || []);
            const isExp  = expanded === p.id;
            const pRate  = p.exchangeRate || rate;
            return (
              <div key={p.id} className="panel" style={{ borderTop: `4px solid ${p.color || "#4a9e6b"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                      {(() => {
                        const s = STATUS_BADGE[p.status] || STATUS_BADGE.draft;
                        if (p.status === "approved") return <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 5, padding: "2px 8px" }}>{s.label}</span>;
                        if (p.status === "submitted") return <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 5, padding: "2px 8px" }}>{s.label}</span>;
                        return null; // don't show "Draft" badge to keep cards clean
                      })()}
                    </div>
                    <div style={{ fontSize: 11, color: p.color || "#4a9e6b", fontWeight: 600, marginBottom: 4 }}>{p.category}</div>
                    {p.description && <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{p.description}</div>}
                    {p.rejectionComment && (
                      <div style={{ fontSize: 12, color: "#c0392b", background: "#fdf0ee", border: "1px solid #f5c6c0", borderRadius: 5, padding: "4px 10px", marginBottom: 4 }}>
                        Returned: {p.rejectionComment}
                      </div>
                    )}
                    {p.status === "approved" && (
                      <div style={{ fontSize: 11, color: "#2d7a4f" }}>
                        Approved by {p.approvedBy} · {p.approvedAt ? new Date(p.approvedAt).toLocaleDateString("en-GB") : ""}
                        {!isAdmin && <span style={{ marginLeft: 8, color: "#888" }}>budget locked</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12, flexWrap: "wrap" }}>
                    {(p.budgetItems?.length > 0) && (
                      <button className="btn btn-sm" onClick={() => setExpanded(isExp ? null : p.id)}>
                        {isExp ? "Hide budget" : "View budget"}
                      </button>
                    )}
                    {/* Submit for approval — draft (or no status) programs with budget items */}
                    {canEdit && (!p.status || p.status === "draft") && (p.budgetItems?.length > 0) && (
                      <button className="btn btn-sm btn-primary" onClick={() => submit(p)}>Submit for approval</button>
                    )}
                    {canEditProgram(p) && <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>}
                    {canEditProgram(p) && (!p.status || p.status === "draft") && <button className="btn btn-sm btn-danger" onClick={() => del(p)}>✕</button>}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, borderTop: "1px solid #f0f0ec", paddingTop: 10, marginTop: 6 }}>
                  {[
                    { label: "Sessions",       value: `${s.sessions} / ${p.plannedSessions || ""}` },
                    { label: "Budget (TZS)",   value: total ? fmt(total) : "" },
                    { label: "Participants",   value: s.participants },
                    { label: "Women",          value: s.women },
                    { label: "New editors",    value: s.newEditors },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: p.color || "#2d7a4f" }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Session progress bar */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ background: "#e8e8e4", borderRadius: 4, height: 5 }}>
                    <div style={{ width: `${Math.min(100, Math.round((s.sessions / (p.plannedSessions || 1)) * 100))}%`, height: 5, borderRadius: 4, background: p.color || "#4a9e6b" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 3 }}>{Math.round((s.sessions / (p.plannedSessions || 1)) * 100)}% of planned sessions complete</div>
                </div>

                {/* Budget breakdown table */}
                {isExp && p.budgetItems?.length > 0 && (
                  <div style={{ marginTop: 16, borderTop: "1px solid #e8e8e4", paddingTop: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px", color: "#555" }}>Budget breakdown</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Note</th>
                            <th style={{ textAlign: "right" }}>Unit cost (TZS)</th>
                            <th style={{ textAlign: "right" }}>Total (TZS)</th>
                            <th>Expense type</th>
                            <th style={{ textAlign: "center" }}>Qty</th>
                            <th style={{ textAlign: "right" }}>Exchange rate</th>
                            <th style={{ textAlign: "right" }}>USD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.budgetItems.map((item, i) => {
                            const total = (Number(item.unitCost) || 0) * (Number(item.quantity) || 1);
                            const usd   = total * (item.exchangeRate || pRate);
                            return (
                              <tr key={i}>
                                <td style={{ fontWeight: 500 }}>{item.description || ""}</td>
                                <td style={{ color: "#555" }}>{item.note || ""}</td>
                                <td style={{ textAlign: "right" }}>{fmt(item.unitCost)}</td>
                                <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(total)}</td>
                                <td>{item.expenseType}</td>
                                <td style={{ textAlign: "center" }}>{item.quantity}</td>
                                <td style={{ textAlign: "right", color: "#888" }}>{(item.exchangeRate || pRate).toFixed(7)}</td>
                                <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtUSD(usd)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 700, background: "#f5f4f0" }}>
                            <td colSpan={3} style={{ textAlign: "right" }}>You wish to be reimbursed in TZS:</td>
                            <td style={{ textAlign: "right" }}>{fmt(total)}</td>
                            <td style={{ textAlign: "right" }}>USD</td>
                            <td></td>
                            <td></td>
                            <td style={{ textAlign: "right" }}>{fmtUSD(total * pRate)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
