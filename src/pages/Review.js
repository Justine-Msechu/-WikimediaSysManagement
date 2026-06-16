import React, { useState, useEffect } from "react";
import {
  listenBudgetEntries, updateBudgetEntry, BUDGET_STATUS_BADGE,
} from "../services/budgetService";
import { listenPrograms, approveProgram, rejectProgram } from "../services/programService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

function fmt(n) { return (n || 0).toLocaleString(); }

const SECTIONS = [
  { id: "submitted", label: "Pending approval", color: "#d97706", bg: "#fff8e1", border: "#ffe082" },
  { id: "draft",     label: "Drafts",           color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "approved",  label: "Approved",          color: "#2d7a4f", bg: "#f0f7f3", border: "#b7e0c8" },
  { id: "rejected",  label: "Rejected",          color: "#c0392b", bg: "#fdf0ee", border: "#f5c6c0" },
];

export default function Review({ profile, goPage }) {
  const [entries,       setEntries]       = useState([]);
  const [programs,      setPrograms]      = useState([]);
  const [reviewId,      setReviewId]      = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [toast,         setToast]         = useState("");
  const [activeSection, setActiveSection] = useState("submitted");

  const canApprove = ["admin", "finance_officer"].includes(profile?.role);
  const isAdmin    = profile?.role === "admin";
  const canEdit    = ["admin", "coordinator", "finance_officer"].includes(profile?.role);

  const [progReviewId,      setProgReviewId]      = useState(null);
  const [progReviewComment, setProgReviewComment] = useState("");

  useEffect(() => {
    const u1 = listenBudgetEntries(setEntries);
    const u2 = listenPrograms(setPrograms);
    return () => { u1(); u2(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const progName  = (id) => programs.find(p => p.id === id)?.name || "—";

  const approveProgram_ = async (p) => {
    await approveProgram(p.id, profile?.name || "");
    await addAudit(profile, AUDIT_ACTIONS.APPROVE, "programs", { targetId: p.id, recordTitle: p.name });
    showToast(`"${p.name}" approved and locked.`);
    setProgReviewId(null); setProgReviewComment("");
  };

  const rejectProgram_ = async (p, comment) => {
    await rejectProgram(p.id, comment);
    await addAudit(profile, AUDIT_ACTIONS.REJECT, "programs", { targetId: p.id, recordTitle: p.name, details: comment });
    showToast(`"${p.name}" returned for revision.`);
    setProgReviewId(null); setProgReviewComment("");
  };

  const approve = async (entry, ok, comment) => {
    const status = ok ? "approved" : "rejected";
    await updateBudgetEntry(entry.id, {
      status,
      reviewedBy:      profile?.name,
      reviewedAt:      new Date().toISOString().slice(0, 10),
      reviewerComment: comment,
    });
    await addAudit(profile, ok ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.REJECT, "budget", {
      targetId: entry.id, recordTitle: entry.title, details: comment || status,
    });
    showToast(ok ? "Entry approved." : "Entry rejected.");
    setReviewId(null); setReviewComment("");
  };

  const submit = async (entry) => {
    await updateBudgetEntry(entry.id, { status: "submitted" });
    await addAudit(profile, AUDIT_ACTIONS.SUBMIT, "budget", { targetId: entry.id, recordTitle: entry.title });
    showToast("Submitted for approval.");
  };

  const grouped = {};
  SECTIONS.forEach(s => { grouped[s.id] = entries.filter(e => e.status === s.id); });

  // For non-approvers: only show their own drafts under Draft section
  if (!canApprove) {
    grouped.draft = grouped.draft.filter(e => e.requestedBy === profile?.name);
  }

  const counts = {};
  SECTIONS.forEach(s => { counts[s.id] = grouped[s.id].length; });

  const current = SECTIONS.find(s => s.id === activeSection);
  const list    = grouped[activeSection] || [];

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>
          ✓ {toast}
        </div>
      )}

      <div className="page-title">Review &amp; approvals</div>

      {/* ── Submitted programs ───────────────────────────────────────────── */}
      {(() => {
        const submitted = programs.filter(p => p.status === "submitted");
        if (submitted.length === 0) return null;
        return (
          <div className="panel" style={{ border: "2px solid #d97706", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div className="panel-title" style={{ marginBottom: 0, color: "#d97706" }}>Programs pending approval</div>
              <span style={{ background: "#d97706", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{submitted.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {submitted.map(p => {
                const items    = p.budgetItems || [];
                const totalTZS = p.plannedBudget || items.reduce((s, i) => s + (Number(i.unitCost)||0)*(Number(i.quantity)||1), 0);
                const pRate    = Number(p.exchangeRate || 0.000438);
                const isRev    = progReviewId === p.id;
                return (
                  <div key={p.id} style={{ border: "1px solid #ffe082", borderLeft: "4px solid #d97706", borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {p.category} · Submitted by {p.submittedBy || "—"} · Budget: <strong>TZS {fmt(totalTZS)} / ${((totalTZS * pRate)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                        {p.description && <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{p.description}</div>}
                        {items.length > 0 && (
                          <div style={{ marginTop: 10, overflowX: "auto" }}>
                            <table style={{ fontSize: 11 }}>
                              <thead>
                                <tr>
                                  <th>Description</th><th>Note</th>
                                  <th style={{ textAlign: "right" }}>Unit cost</th>
                                  <th style={{ textAlign: "center" }}>Qty</th>
                                  <th style={{ textAlign: "right" }}>Total (TZS)</th>
                                  <th>Expense type</th>
                                  <th style={{ textAlign: "right" }}>USD</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((it, i) => {
                                  const tot = (Number(it.unitCost)||0)*(Number(it.quantity)||1);
                                  return (
                                    <tr key={i}>
                                      <td>{it.description}</td><td style={{ color: "#555" }}>{it.note}</td>
                                      <td style={{ textAlign: "right" }}>{fmt(it.unitCost)}</td>
                                      <td style={{ textAlign: "center" }}>{it.quantity}</td>
                                      <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(tot)}</td>
                                      <td>{it.expenseType}</td>
                                      <td style={{ textAlign: "right" }}>${(tot*(it.exchangeRate||pRate)).toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ fontWeight: 700, background: "#fff8e1" }}>
                                  <td colSpan={4} style={{ textAlign: "right" }}>Total:</td>
                                  <td style={{ textAlign: "right" }}>TZS {fmt(totalTZS)}</td>
                                  <td>USD</td>
                                  <td style={{ textAlign: "right" }}>${(totalTZS * pRate).toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                      {isAdmin && !isRev && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => approveProgram_(p)}>Approve &amp; lock</button>
                          <button className="btn btn-sm btn-danger"  onClick={() => { setProgReviewId(p.id); setProgReviewComment(""); }}>Return for revision</button>
                        </div>
                      )}
                    </div>
                    {isRev && (
                      <div style={{ marginTop: 12, padding: "12px 14px", background: "#fdf0ee", border: "1px solid #f5c6c0", borderRadius: 7 }}>
                        <div style={{ fontWeight: 600, color: "#c0392b", fontSize: 13, marginBottom: 8 }}>Reason for returning (optional)</div>
                        <textarea rows={2} value={progReviewComment} onChange={e => setProgReviewComment(e.target.value)}
                          placeholder="Explain what needs to be changed…"
                          style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid #f5c6c0", borderRadius: 5, boxSizing: "border-box" }} />
                        <div className="btn-row" style={{ marginTop: 8 }}>
                          <button className="btn btn-sm btn-danger" onClick={() => rejectProgram_(p, progReviewComment)}>Confirm — return for revision</button>
                          <button className="btn btn-sm" onClick={() => setProgReviewId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Summary cards */}
      <div className="card-grid" style={{ marginBottom: 20 }}>
        {SECTIONS.map(s => (
          <div
            key={s.id}
            className="stat-card"
            style={{ cursor: "pointer", border: activeSection === s.id ? `2px solid ${s.color}` : "2px solid transparent", transition: "border 0.15s" }}
            onClick={() => setActiveSection(s.id)}
          >
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{counts[s.id]}</div>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "2px solid #e8e8e4", marginBottom: 0 }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
              borderRadius: "6px 6px 0 0",
              background: activeSection === s.id ? "#fff" : "transparent",
              color: activeSection === s.id ? s.color : "#666",
              borderBottom: activeSection === s.id ? `2px solid ${s.color}` : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {s.label}
            {counts[s.id] > 0 && (
              <span style={{ marginLeft: 6, background: s.color, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10 }}>
                {counts[s.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="panel" style={{ borderRadius: "0 8px 8px 8px" }}>
        {/* Section header */}
        <div style={{ marginBottom: 14, padding: "10px 14px", background: current.bg, border: `1px solid ${current.border}`, borderRadius: 8 }}>
          {activeSection === "submitted" && canApprove && (
            <div style={{ fontSize: 13, color: current.color, fontWeight: 600 }}>
              {counts.submitted === 0
                ? "No entries waiting for approval."
                : `${counts.submitted} ${counts.submitted === 1 ? "entry needs" : "entries need"} your approval.`}
            </div>
          )}
          {activeSection === "submitted" && !canApprove && (
            <div style={{ fontSize: 13, color: current.color }}>These entries have been submitted and are waiting for an admin or finance officer to approve them.</div>
          )}
          {activeSection === "draft" && (
            <div style={{ fontSize: 13, color: current.color }}>
              {canApprove ? "Draft entries that have not been submitted yet." : "Your draft entries — submit them when ready for review."}
            </div>
          )}
          {activeSection === "approved" && (
            <div style={{ fontSize: 13, color: current.color }}>These entries have been approved and count toward total approved spend.</div>
          )}
          {activeSection === "rejected" && (
            <div style={{ fontSize: 13, color: current.color }}>These entries were rejected. Edit and resubmit them from the Budget page.</div>
          )}
        </div>

        {list.length === 0 ? (
          <div className="empty">No {current.label.toLowerCase()} entries.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map(entry => {
              const isReviewing = reviewId === entry.id;
              const badge       = BUDGET_STATUS_BADGE[entry.status] || { label: entry.status, cls: "badge-gray" };
              return (
                <div
                  key={entry.id}
                  style={{ border: `1px solid ${current.border}`, borderLeft: `4px solid ${current.color}`, borderRadius: 8, padding: "14px 16px" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{entry.title}</span>
                        <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>
                        <strong>TZS {fmt(entry.amount)}</strong>
                        {" · "}{entry.category}
                        {entry.programId && <> · <span style={{ color: "#2d7a4f" }}>{progName(entry.programId)}</span></>}
                      </div>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        {entry.date && <span>Date: {entry.date}</span>}
                        {entry.requestedBy && <span> · Requested by: {entry.requestedBy}</span>}
                        {entry.reviewedBy  && <span> · Reviewed by: {entry.reviewedBy} on {entry.reviewedAt}</span>}
                      </div>
                      {entry.description && <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{entry.description}</div>}
                      {entry.reviewerComment && (
                        <div style={{ marginTop: 6, fontSize: 12, padding: "5px 10px", background: "#fdf0ee", borderRadius: 5, color: "#c0392b" }}>
                          Comment: {entry.reviewerComment}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {canApprove && entry.status === "submitted" && !isReviewing && (
                        <>
                          <button className="btn btn-sm btn-primary" onClick={() => approve(entry, true, "")}>Approve</button>
                          <button className="btn btn-sm btn-danger"  onClick={() => { setReviewId(entry.id); setReviewComment(""); }}>Reject</button>
                        </>
                      )}
                      {!canApprove && entry.status === "draft" && entry.requestedBy === profile?.name && (
                        <button className="btn btn-sm btn-primary" onClick={() => submit(entry)}>Submit for approval</button>
                      )}
                      {canApprove && entry.status === "draft" && (
                        <button className="btn btn-sm btn-primary" onClick={() => submit(entry)}>Submit</button>
                      )}
                      <button className="btn btn-sm" onClick={() => goPage("budget")}>Open in Budget →</button>
                    </div>
                  </div>

                  {/* Rejection reason form */}
                  {isReviewing && (
                    <div style={{ marginTop: 12, padding: "12px 14px", background: "#fdf0ee", border: "1px solid #f5c6c0", borderRadius: 7 }}>
                      <div style={{ fontWeight: 600, color: "#c0392b", fontSize: 13, marginBottom: 8 }}>Reason for rejection (optional)</div>
                      <textarea
                        rows={2}
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                        placeholder="Explain why this entry is rejected…"
                        style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid #f5c6c0", borderRadius: 5, boxSizing: "border-box" }}
                      />
                      <div className="btn-row" style={{ marginTop: 8 }}>
                        <button className="btn btn-sm btn-danger" onClick={() => approve(entry, false, reviewComment)}>Confirm rejection</button>
                        <button className="btn btn-sm" onClick={() => setReviewId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
