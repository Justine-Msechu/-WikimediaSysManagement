import React, { useState, useEffect, useRef } from "react";
import {
  listenBudgetEntries, addBudgetEntry, updateBudgetEntry, deleteBudgetEntry,
  BUDGET_STATUSES, BUDGET_STATUS_BADGE, BUDGET_GROUPS,
  FISCAL_MONTHS, getGroup, DEFAULT_PERSONNEL,
} from "../services/budgetService";
import { listenSettings, updateSettings } from "../services/settingsService";
import { listenPrograms } from "../services/programService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { notifySubmission } from "../services/notificationService";
import { uploadToDrive, preAuthorize } from "../services/driveService";
import logo from "../assets/logo.png";

function fmt(n)    { return (n || 0).toLocaleString(); }
function fmtUSD(n) { return `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function esc(s)    { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function budgetPrintHtml(programs, approvedEntries, orgName, logoSrc) {
  const rows = (items, pRate) => items.map(it => {
    const total = (Number(it.unitCost)||0) * (Number(it.quantity)||1);
    const usd   = total * pRate;
    return `<tr>
      <td>${esc(it.description)}</td>
      <td>${esc(it.note)}</td>
      <td style="text-align:right">${fmt(it.unitCost)}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:right"><strong>${fmt(total)}</strong></td>
      <td>${esc(it.expenseType)}</td>
      <td style="text-align:right">${(it.exchangeRate||pRate).toFixed(7)}</td>
      <td style="text-align:right"><strong>${fmtUSD(usd)}</strong></td>
    </tr>`;
  }).join("");

  const progHtml = programs.map(p => {
    const pRate   = Number(p.exchangeRate || 0.000438);
    const items   = p.budgetItems || [];
    const totalTZS = items.reduce((s,i) => s + (Number(i.unitCost)||0)*(Number(i.quantity)||1), 0);
    const totalUSD = totalTZS * pRate;
    const actual   = approvedEntries.filter(e => e.programId === p.id).reduce((s,e) => s+(e.amount||0), 0);
    return `
    <div class="prog-block">
      <div class="prog-title" style="color:${p.color||'#2d7a4f'}">${esc(p.name)}</div>
      <div class="prog-cat">${esc(p.category)}</div>
      ${p.description ? `<div class="prog-desc">${esc(p.description)}</div>` : ""}
      ${items.length === 0 ? "<p style='color:#aaa;font-size:12px'>No budget line items.</p>" : `
      <table>
        <thead><tr>
          <th>Description</th><th>Note</th>
          <th style="text-align:right">Unit cost (TZS)</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Total (TZS)</th>
          <th>Expense type</th>
          <th style="text-align:right">Rate</th>
          <th style="text-align:right">USD</th>
        </tr></thead>
        <tbody>${rows(items, pRate)}</tbody>
        <tfoot><tr class="total-row">
          <td colspan="4" style="text-align:right">You wish to be reimbursed in TZS:</td>
          <td style="text-align:right">${fmt(totalTZS)}</td>
          <td style="text-align:right">USD</td>
          <td></td>
          <td style="text-align:right">${fmtUSD(totalUSD)}</td>
        </tr></tfoot>
      </table>`}
      <div class="actual-note">Actual spend recorded: <strong>TZS ${fmt(actual)}</strong> | Remaining: <strong>TZS ${fmt(totalTZS - actual)}</strong></div>
    </div>`;
  }).join("<hr>");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Program Budgets: ${esc(orgName)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1c2b1e; padding: 32px; max-width: 960px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; border-bottom: 2px solid #2d7a4f; padding-bottom: 16px; }
    .header img { width: 56px; height: 56px; object-fit: contain; }
    .header h1 { font-size: 20px; margin: 0; color: #1c2b1e; }
    .header small { display: block; font-size: 12px; color: #888; margin-top: 4px; }
    .prog-block { margin: 20px 0; page-break-inside: avoid; }
    .prog-title { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
    .prog-cat   { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px; }
    .prog-desc  { font-size: 12px; color: #555; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
    th { background: #1c2b1e; color: #fff; padding: 7px 8px; text-align: left; font-size: 11px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e8e8e4; }
    tr:nth-child(even) td { background: #f9f9f7; }
    .total-row td { background: #f0f7f3 !important; font-weight: 700; border-top: 2px solid #2d7a4f; }
    .actual-note { font-size: 12px; color: #555; margin-top: 8px; padding: 6px 10px; background: #f5f4f0; border-radius: 5px; }
    hr { border: none; border-top: 2px dashed #e8e8e4; margin: 24px 0; }
    .no-print { text-align: center; margin-bottom: 20px; }
    .no-print button { padding: 10px 28px; font-size: 14px; background: #2d7a4f; color: #fff; border: none; border-radius: 7px; cursor: pointer; margin: 0 6px; }
    .no-print button.sec { background: #f5f4f0; color: #333; border: 1px solid #ccc; }
    @media print { .no-print { display: none; } }
  </style></head><body>
  <div class="no-print">
    <button onclick="window.print()">Print</button>
    <button class="sec" onclick="window.close()">Close</button>
  </div>
  <div class="header">
    <img src="${logoSrc}" alt="logo">
    <div>
      <h1>Program Budget Report</h1>
      <small>${esc(orgName)} &nbsp;·&nbsp; Printed ${new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" })}</small>
    </div>
  </div>
  ${progHtml}
  </body></html>`;
}

function getMonthName(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleString("en-US", { month: "long" });
}

function emptyEntry(profile) {
  return {
    title: "", description: "", category: "Food & refreshments",
    programId: "", amount: 0, date: new Date().toISOString().slice(0, 10),
    requestedBy: profile?.name || "", status: "draft", reviewerComment: "",
  };
}

const TABS = [
  { id: "expenses",  label: "Expenses"           },
  { id: "programs",  label: "Programs"           },
  { id: "monthly",   label: "Monthly cash flow"  },
  { id: "personnel", label: "Personnel"          },
  { id: "pl",        label: "P&L"                },
];

export default function Budget({ profile }) {
  const [tab,           setTab]           = useState("expenses");
  const [entries,       setEntries]       = useState([]);
  const [settings,      setSettings]      = useState(null);
  const [programs,      setPrograms]      = useState([]);
  const [toast,         setToast]         = useState("");

  // Expenses tab
  const [form,           setForm]          = useState(null);
  const [editId,         setEditId]        = useState(null);
  const [reviewId,       setReviewId]      = useState(null);
  const [reviewComment,  setReviewComment] = useState("");
  const [filterStatus,   setFilterStatus]  = useState("all");
  const [filterGroup,    setFilterGroup]   = useState("all");
  const [receiptBusy,    setReceiptBusy]   = useState(false);
  const receiptRef = useRef(null);

  // Personnel tab
  const [personnel,   setPersonnel]   = useState(DEFAULT_PERSONNEL);
  const [persEditing, setPersEditing] = useState(false);
  const [persDraft,   setPersDraft]   = useState([]);

  // Monthly cash flow tab
  const [cashFlow,  setCashFlow]  = useState({});
  const [cfEditing, setCfEditing] = useState(false);
  const [cfDraft,   setCfDraft]   = useState({});

  const canApprove = ["admin", "finance_officer"].includes(profile?.role);
  const canEdit    = ["admin", "coordinator", "finance_officer"].includes(profile?.role);
  const canAdmin   = ["admin", "finance_officer"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenBudgetEntries(setEntries);
    const u3 = listenPrograms(setPrograms);
    const u2 = listenSettings(s => {
      setSettings(s);
      setPersonnel(s?.personnel?.length ? s.personnel : DEFAULT_PERSONNEL);
      setCashFlow(s?.cashFlow || {});
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const uploadReceipt = async (file) => {
    if (!file) return;
    setReceiptBusy(true);
    try {
      const result = await uploadToDrive(file);
      setF("receiptUrl",  result.url);
      setF("receiptName", result.name);
      showToast("Receipt uploaded to Drive.");
    } catch (err) {
      alert(err.message || "Upload failed.");
    } finally {
      setReceiptBusy(false);
      if (receiptRef.current) receiptRef.current.value = "";
    }
  };

  // ── derived numbers ───────────────────────────────────────────────────────
  const grant          = settings?.grant || {};
  const grantTotalUSD  = Number(grant.totalUSD || 0);
  const rate           = Number(grant.conversionRate || 0.00037);
  const grantTotalTZS  = grantTotalUSD > 0 ? Math.round(grantTotalUSD / rate) : 0;
  const approved        = entries.filter(e => e.status === "approved");
  const approvedSpend   = approved.reduce((s, e) => s + (e.amount || 0), 0);
  const pendingCount    = entries.filter(e => e.status === "submitted").length;
  const budgetPct       = grantTotalTZS > 0 ? Math.min(100, Math.round((approvedSpend / grantTotalTZS) * 100)) : 0;

  // Actual spend per fiscal month (approved entries)
  const actualByMonth = {};
  FISCAL_MONTHS.forEach(m => { actualByMonth[m] = 0; });
  approved.forEach(e => {
    const m = getMonthName(e.date);
    if (m && actualByMonth[m] !== undefined) actualByMonth[m] += (e.amount || 0);
  });

  // Approved expenses by group (for P&L)
  const expByGroup = {};
  Object.keys(BUDGET_GROUPS).forEach(g => { expByGroup[g] = 0; });
  approved.forEach(e => {
    const g = getGroup(e.category);
    expByGroup[g] = (expByGroup[g] || 0) + (e.amount || 0);
  });

  // Personnel totals
  const personnelMonthlyTZS = personnel.reduce((s, p) => s + (Number(p.monthlySalary) || 0), 0);
  const personnelAnnualTZS  = personnelMonthlyTZS * 12;

  // ── expense handlers ───────────────────────────────────────────────────────
  const saveEntry = async (submit = false) => {
    if (!form.title.trim()) { alert("Title is required."); return; }
    const data = { ...form, status: submit ? "submitted" : "draft" };
    if (!editId) {
      const id = await addBudgetEntry(data);
      await addAudit(profile, submit ? AUDIT_ACTIONS.SUBMIT : AUDIT_ACTIONS.CREATE, "budget", { targetId: id, recordTitle: form.title, details: `TZS ${fmt(form.amount)}, ${form.category}` });
      if (submit) notifySubmission({ submitterName: profile?.name || "A coordinator", itemType: "Budget entry", itemTitle: form.title, itemId: id }).catch(() => {});
      showToast(submit ? "Entry submitted for approval." : "Entry created.");
    } else {
      await updateBudgetEntry(editId, data);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "budget", { targetId: editId, recordTitle: form.title });
      showToast("Entry updated.");
    }
    setForm(null); setEditId(null);
  };

  const approve = async (entry, ok, comment) => {
    const status = ok ? "approved" : "rejected";
    await updateBudgetEntry(entry.id, { status, reviewedBy: profile?.name, reviewedAt: new Date().toISOString().slice(0, 10), reviewerComment: comment });
    await addAudit(profile, ok ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.REJECT, "budget", { targetId: entry.id, recordTitle: entry.title, details: comment || status });
    showToast(ok ? "Entry approved." : "Entry rejected.");
    setReviewId(null); setReviewComment("");
  };

  const del = async (entry) => {
    if (!window.confirm(`Delete "${entry.title}"?`)) return;
    await deleteBudgetEntry(entry.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "budget", { targetId: entry.id, recordTitle: entry.title });
    showToast("Entry deleted.");
  };

  const submitEntry = async (entry) => {
    await updateBudgetEntry(entry.id, { status: "submitted" });
    await addAudit(profile, AUDIT_ACTIONS.SUBMIT, "budget", { targetId: entry.id, recordTitle: entry.title });
    showToast("Submitted for approval.");
  };

  const filteredEntries = entries.filter(e => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterGroup  !== "all" && getGroup(e.category) !== filterGroup) return false;
    return true;
  });

  // ── personnel handlers ─────────────────────────────────────────────────────
  const startEditPersonnel = () => { setPersDraft(personnel.map(p => ({ ...p }))); setPersEditing(true); };
  const savePersonnel = async () => {
    await updateSettings({ personnel: persDraft });
    setPersonnel(persDraft);
    setPersEditing(false);
    showToast("Personnel saved.");
  };
  const setPersField    = (i, k, v) => setPersDraft(d => d.map((p, j) => j === i ? { ...p, [k]: v } : p));
  const addPersonRow    = () => setPersDraft(d => [...d, { id: Date.now().toString(), name: "", monthlySalary: 0 }]);
  const removePersonRow = (i) => setPersDraft(d => d.filter((_, j) => j !== i));

  // ── monthly cash flow handlers ─────────────────────────────────────────────
  const startEditCF = () => {
    const draft = {};
    FISCAL_MONTHS.forEach(m => { draft[m] = cashFlow[m] || 0; });
    setCfDraft(draft); setCfEditing(true);
  };
  const saveCF = async () => {
    await updateSettings({ cashFlow: cfDraft });
    setCashFlow(cfDraft); setCfEditing(false);
    showToast("Monthly plan saved.");
  };

  // ── use-all: bulk-create draft entries from a program's budget items ───────
  const EXPENSE_TYPE_MAP = {
    "Food and drinks":  "Food & refreshments",
    "Venue / Room Hire": "Venue rentals",
    "Transport":        "Local transportation",
    "Facilitators":     "Volunteer support",
    "Equipment":        "Office expenses",
    "Materials":        "Office expenses",
    "Internet/Supplies": "Internet & computers",
    "Bank charges":     "Bank fees",
  };

  const useAll = async (prog) => {
    const items = prog.budgetItems || [];
    if (!items.length) return;
    if (!window.confirm(`Create ${items.length} draft budget entries for "${prog.name}"?`)) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const it of items) {
      const total = (Number(it.unitCost) || 0) * (Number(it.quantity) || 1);
      await addBudgetEntry({
        title:           it.description || "Budget item",
        description:     it.note || "",
        category:        EXPENSE_TYPE_MAP[it.expenseType] || "Food & refreshments",
        programId:       prog.id,
        amount:          total,
        date:            today,
        requestedBy:     profile?.name || "",
        status:          "draft",
        reviewerComment: "",
      });
    }
    setForm(null); setEditId(null);
    showToast(`${items.length} draft entries created for ${prog.name}.`);
  };

  // ── print ─────────────────────────────────────────────────────────────────
  const printBudgets = (subset) => {
    const orgName = settings?.org?.name || "Wikimedians of Kilimanjaro";
    const html = budgetPrintHtml(subset, approved, orgName, logo);
    const w = window.open("", "_blank", "width=1000,height=750");
    w.document.write(html);
    w.document.close();
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Budget</div>

      {/* KPI cards */}
      <div className="card-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "Grant (USD)",      value: fmtUSD(grantTotalUSD),                      color: "#2563eb" },
          { label: "Grant (TZS)",      value: fmt(grantTotalTZS),                          color: "#2563eb" },
          { label: "Approved spend",   value: `TZS ${fmt(approvedSpend)}`,                 color: "#2d7a4f" },
          { label: "Remaining",        value: `TZS ${fmt(grantTotalTZS - approvedSpend)}`, color: grantTotalTZS - approvedSpend < 0 ? "#c0392b" : "#2d7a4f" },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {grantTotalTZS > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>Budget utilisation: {budgetPct}%</span>
            <span style={{ color: "#888" }}>TZS {fmt(approvedSpend)} of TZS {fmt(grantTotalTZS)}</span>
          </div>
          <div style={{ background: "#e8e8e4", borderRadius: 5, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${budgetPct}%`, height: 10, borderRadius: 5, background: budgetPct > 90 ? "#c0392b" : "#4a9e6b", transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {grantTotalUSD === 0 && (
        <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
          Grant total not configured. Go to <strong>Grant setup</strong> to enter the total grant amount.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 0, borderBottom: "2px solid #e8e8e4" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
            borderRadius: "6px 6px 0 0", background: tab === t.id ? "#fff" : "transparent",
            color: tab === t.id ? "#2d7a4f" : "#666",
            borderBottom: tab === t.id ? "2px solid #2d7a4f" : "2px solid transparent",
            marginBottom: -2,
          }}>
            {t.label}
            {t.id === "expenses" && pendingCount > 0 && canApprove && (
              <span className="badge badge-amber" style={{ marginLeft: 6, fontSize: 10 }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── EXPENSES ──────────────────────────────────────────────────────── */}
      {tab === "expenses" && (
        <div className="panel" style={{ borderRadius: "0 8px 8px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>
              Budget entries
              {pendingCount > 0 && canApprove && <span className="badge badge-amber" style={{ marginLeft: 8 }}>{pendingCount} pending</span>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ fontSize: 12 }}>
                <option value="all">All groups</option>
                {Object.keys(BUDGET_GROUPS).map(g => <option key={g}>{g}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: 12 }}>
                <option value="all">All statuses</option>
                {BUDGET_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              {canEdit && <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyEntry(profile)); setEditId(null); }}>+ New entry</button>}
            </div>
          </div>

          {form && (
            <div style={{ background: "#f9f9f7", border: "1px solid #e0e0da", borderRadius: 9, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{editId ? "Edit entry" : "New budget entry"}</div>
              <div className="form-grid">
                <div className="field">
                  <label>Title <span className="req">★</span></label>
                  <input value={form.title} onChange={e => setF("title", e.target.value)} autoFocus />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setF("category", e.target.value)}>
                    {Object.entries(BUDGET_GROUPS).map(([group, cats]) => (
                      <optgroup key={group} label={group}>
                        {cats.map(c => <option key={c}>{c}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Program</label>
                  <select value={form.programId || ""} onChange={e => setF("programId", e.target.value)}>
                    <option value="">(No program)</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Amount (TZS)</label>
                  <input type="number" min="0" value={form.amount} onChange={e => setF("amount", Number(e.target.value) || 0)} />
                </div>
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setF("date", e.target.value)} />
                </div>
              </div>
              {/* Program budget reference */}
              {(() => {
                const selProg = form.programId ? programs.find(p => p.id === form.programId) : null;
                if (!selProg) return null;
                const items      = selProg.budgetItems || [];
                const pRate      = Number(selProg.exchangeRate || rate);
                const planned    = selProg.plannedBudget || items.reduce((s,i) => s+(Number(i.unitCost)||0)*(Number(i.quantity)||1), 0);
                const spent      = approved.filter(e => e.programId === selProg.id).reduce((s,e) => s+(e.amount||0), 0);
                const remaining  = planned - spent;
                return (
                  <div style={{ gridColumn: "1 / -1", background: "#f0f7f3", border: "1px solid #b7e0c8", borderRadius: 8, padding: "12px 14px", marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: items.length ? 10 : 0, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: selProg.color || "#2d7a4f" }}>{selProg.name}: budget reference</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
                        <span>Planned: <strong>TZS {fmt(planned)}</strong></span>
                        <span>Spent: <strong style={{ color: "#c0392b" }}>TZS {fmt(spent)}</strong></span>
                        <span>Remaining: <strong style={{ color: remaining < 0 ? "#c0392b" : "#2d7a4f" }}>TZS {fmt(remaining)}</strong></span>
                        {items.length > 0 && (
                          <button className="btn btn-sm btn-primary" onClick={() => useAll(selProg)}>Use all</button>
                        )}
                      </div>
                    </div>
                    {items.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>Click a line item to pre-fill the form, or click <strong>Use all</strong> to create all as drafts at once:</div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ fontSize: 11 }}>
                            <thead>
                              <tr>
                                <th>Description</th>
                                <th>Note</th>
                                <th style={{ textAlign: "right" }}>Unit cost</th>
                                <th style={{ textAlign: "center" }}>Qty</th>
                                <th style={{ textAlign: "right" }}>Total (TZS)</th>
                                <th>Expense type</th>
                                <th style={{ textAlign: "right" }}>USD</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, i) => {
                                const total = (Number(it.unitCost)||0) * (Number(it.quantity)||1);
                                const usd   = total * pRate;
                                return (
                                  <tr key={i} style={{ cursor: "pointer" }} onClick={() => {
                                    setF("title",  it.description || "");
                                    setF("amount", total);
                                    // map expenseType to a matching budget category
                                    const typeMap = {
                                      "Food and drinks": "Food & refreshments",
                                      "Venue / Room Hire": "Venue rentals",
                                      "Transport": "Local transportation",
                                      "Facilitators": "Volunteer support",
                                      "Equipment": "Office expenses",
                                      "Materials": "Office expenses",
                                      "Internet/Supplies": "Internet & computers",
                                      "Bank charges": "Bank fees",
                                    };
                                    const cat = typeMap[it.expenseType] || form.category;
                                    setF("category", cat);
                                    if (it.note) setF("description", it.note);
                                  }}>
                                    <td style={{ fontWeight: 500 }}>{it.description || ""}</td>
                                    <td style={{ color: "#555" }}>{it.note || ""}</td>
                                    <td style={{ textAlign: "right" }}>{fmt(it.unitCost)}</td>
                                    <td style={{ textAlign: "center" }}>{it.quantity}</td>
                                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(total)}</td>
                                    <td>{it.expenseType}</td>
                                    <td style={{ textAlign: "right", color: "#555" }}>{fmtUSD(usd)}</td>
                                    <td><button className="btn btn-sm btn-primary" style={{ fontSize: 10 }} tabIndex={-1} onClick={e => { e.stopPropagation(); setF("title", it.description||""); setF("amount", total); setF("description", it.note||""); }}>Use</button></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ fontWeight: 700, background: "#e8f5ee" }}>
                                <td colSpan={4} style={{ textAlign: "right" }}>Total planned:</td>
                                <td style={{ textAlign: "right" }}>{fmt(planned)}</td>
                                <td>USD</td>
                                <td style={{ textAlign: "right" }}>{fmtUSD(planned * pRate)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              <div className="field">
                <label>Description</label>
                <textarea rows={2} value={form.description} onChange={e => setF("description", e.target.value)} />
              </div>
              <div className="field">
                <label>Receipt / supporting document</label>
                {form.receiptUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#f0f7f3", border: "1px solid #b7e0c8", borderRadius: 6 }}>
                    <span style={{ fontSize: 18 }}>📎</span>
                    <a href={form.receiptUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#2d7a4f", flex: 1 }}>{form.receiptName || "View receipt"}</a>
                    <button className="btn btn-sm btn-danger" onClick={() => { setF("receiptUrl", ""); setF("receiptName", ""); }}>Remove</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className="btn btn-sm"
                      disabled={receiptBusy}
                      onClick={async () => {
                        try { await preAuthorize(); receiptRef.current?.click(); }
                        catch (err) { alert(err.message || "Could not connect to Google Drive."); }
                      }}
                    >
                      {receiptBusy ? "Uploading…" : "Upload receipt to Drive"}
                    </button>
                    <span style={{ fontSize: 11, color: "#aaa" }}>or</span>
                    <input
                      value={form.receiptUrl || ""}
                      onChange={e => setF("receiptUrl", e.target.value)}
                      placeholder="Paste receipt URL"
                      style={{ flex: 1, fontSize: 12 }}
                    />
                    <input ref={receiptRef} type="file" style={{ display: "none" }} accept="image/*,.pdf" onChange={e => uploadReceipt(e.target.files?.[0])} />
                  </div>
                )}
              </div>
              <div className="btn-row">
                {canApprove
                  ? <button className="btn btn-primary" onClick={() => saveEntry(false)}>Save</button>
                  : <>
                    <button className="btn btn-primary" onClick={() => saveEntry(true)}>Save &amp; submit for approval</button>
                    <button className="btn" onClick={() => saveEntry(false)}>Save as draft</button>
                  </>
                }
                <button className="btn" onClick={() => { setForm(null); setEditId(null); }}>Cancel</button>
              </div>
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <div className="empty">
              {entries.length === 0
                ? `No budget entries yet.${canEdit ? " Click '+ New entry' to create one." : ""}`
                : "No entries match this filter."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr><th>Title</th><th>Group</th><th>Category</th><th>Amount (TZS)</th><th>By</th><th>Date</th><th>Status</th><th>Receipt</th><th>Comment</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredEntries.map(entry => {
                    const badge     = BUDGET_STATUS_BADGE[entry.status] || { label: entry.status, cls: "badge-gray" };
                    const reviewing = reviewId === entry.id;
                    return (
                      <React.Fragment key={entry.id}>
                        <tr>
                          <td style={{ fontWeight: 500 }}>{entry.title}</td>
                          <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{getGroup(entry.category)}</span></td>
                          <td style={{ fontSize: 12, color: "#555" }}>{entry.category}</td>
                          <td style={{ fontWeight: 600 }}>{fmt(entry.amount)}</td>
                          <td style={{ fontSize: 12 }}>{entry.requestedBy || ""}</td>
                          <td style={{ fontSize: 12, color: "#888" }}>{entry.date || ""}</td>
                          <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                          <td style={{ fontSize: 12 }}>{entry.receiptUrl ? <a href={entry.receiptUrl} target="_blank" rel="noreferrer" style={{ color: "#2d7a4f" }}>📎 View</a> : ""}</td>
                          <td style={{ fontSize: 11, color: "#777", maxWidth: 140 }}>{entry.reviewerComment || ""}</td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              {canApprove && entry.status === "submitted" && !reviewing && (
                                <>
                                  <button className="btn btn-sm btn-primary" onClick={() => approve(entry, true, "")}>Approve</button>
                                  <button className="btn btn-sm btn-danger" onClick={() => { setReviewId(entry.id); setReviewComment(""); }}>Reject</button>
                                </>
                              )}
                              {canEdit && ["draft", "rejected"].includes(entry.status) && (
                                <button className="btn btn-sm" onClick={() => { setForm({ ...entry }); setEditId(entry.id); }}>Edit</button>
                              )}
                              {!canApprove && canEdit && entry.status === "draft" && (
                                <button className="btn btn-sm btn-primary" onClick={() => submitEntry(entry)}>Submit</button>
                              )}
                              {(canApprove || (canEdit && entry.status === "draft")) && (
                                <button className="btn btn-sm btn-danger" onClick={() => del(entry)}>✕</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {reviewing && (
                          <tr>
                            <td colSpan={10} style={{ background: "#fdf0ee", padding: "12px 16px" }}>
                              <div style={{ fontWeight: 600, color: "#c0392b", marginBottom: 8, fontSize: 13 }}>Reason for rejection (optional)</div>
                              <textarea rows={2} value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Explain why this entry is rejected…" style={{ width: "100%", fontSize: 13, padding: "6px 8px", border: "1px solid #ddd", borderRadius: 5 }} />
                              <div className="btn-row" style={{ marginTop: 8 }}>
                                <button className="btn btn-sm btn-danger" onClick={() => approve(entry, false, reviewComment)}>Confirm rejection</button>
                                <button className="btn btn-sm" onClick={() => setReviewId(null)}>Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PROGRAMS ──────────────────────────────────────────────────────── */}
      {tab === "programs" && (
        <div className="panel" style={{ borderRadius: "0 8px 8px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="panel-title" style={{ marginBottom: 2 }}>Program budgets</div>
              <div style={{ fontSize: 12, color: "#888" }}>Set planned budgets on each program in the Programs page. Link budget entries to a program using the Program dropdown when creating an expense.</div>
            </div>
            {programs.length > 0 && (
              <button className="btn btn-sm" onClick={() => printBudgets(programs)}>Print all budgets</button>
            )}
          </div>

          {programs.length === 0 ? (
            <div className="empty">No programs yet. Go to Programs to create some.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {programs.map(p => {
                const progEntries  = approved.filter(e => e.programId === p.id);
                const actualSpend  = progEntries.reduce((s, e) => s + (e.amount || 0), 0);
                const plannedBudget = Number(p.plannedBudget || 0);
                const pct          = plannedBudget > 0 ? Math.min(100, Math.round((actualSpend / plannedBudget) * 100)) : 0;
                const remaining    = plannedBudget - actualSpend;
                const overBudget   = remaining < 0;
                return (
                  <div key={p.id} style={{ border: `1px solid #e8e8e4`, borderLeft: `4px solid ${p.color || "#4a9e6b"}`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: p.color || "#4a9e6b", fontWeight: 600 }}>{p.category}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 20, textAlign: "right" }}>
                          <div><div style={{ fontSize: 11, color: "#888" }}>Planned</div><div style={{ fontWeight: 600 }}>TZS {fmt(plannedBudget)}</div></div>
                          <div><div style={{ fontSize: 11, color: "#888" }}>Spent</div><div style={{ fontWeight: 600, color: overBudget ? "#c0392b" : "#2d7a4f" }}>TZS {fmt(actualSpend)}</div></div>
                          <div><div style={{ fontSize: 11, color: "#888" }}>Remaining</div><div style={{ fontWeight: 600, color: overBudget ? "#c0392b" : "#2d7a4f" }}>TZS {fmt(remaining)}</div></div>
                        </div>
                        {(p.budgetItems?.length > 0) && (
                          <button className="btn btn-sm" style={{ whiteSpace: "nowrap" }} onClick={() => printBudgets([p])}>Print budget</button>
                        )}
                      </div>
                    </div>
                    {plannedBudget > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ background: "#e8e8e4", borderRadius: 4, height: 8, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: overBudget ? "#c0392b" : p.color || "#4a9e6b", transition: "width 0.3s" }} />
                        </div>
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>{pct}% of planned budget used{overBudget ? " : OVER BUDGET" : ""}</div>
                      </div>
                    )}
                    {progEntries.length > 0 ? (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ fontSize: 12 }}>
                          <thead><tr><th>Title</th><th>Category</th><th style={{ textAlign: "right" }}>Amount (TZS)</th><th>Date</th><th>By</th></tr></thead>
                          <tbody>
                            {progEntries.map(e => (
                              <tr key={e.id}>
                                <td style={{ fontWeight: 500 }}>{e.title}</td>
                                <td style={{ color: "#555" }}>{e.category}</td>
                                <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(e.amount)}</td>
                                <td style={{ color: "#888" }}>{e.date || ""}</td>
                                <td style={{ color: "#888" }}>{e.requestedBy || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#aaa" }}>No approved expenses linked to this program yet.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MONTHLY CASH FLOW ─────────────────────────────────────────────── */}
      {tab === "monthly" && (
        <div className="panel" style={{ borderRadius: "0 8px 8px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div className="panel-title" style={{ marginBottom: 2 }}>Monthly cash flow: July 2025 to June 2026</div>
              <div style={{ fontSize: 12, color: "#888" }}>Planned amounts are editable. Actual figures come from approved entries.</div>
            </div>
            {canAdmin && !cfEditing && <button className="btn btn-sm btn-primary" onClick={startEditCF}>Edit planned</button>}
            {cfEditing && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={saveCF}>Save</button>
                <button className="btn btn-sm" onClick={() => setCfEditing(false)}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: "right" }}>Planned (TZS)</th>
                  <th style={{ textAlign: "right" }}>Actual (TZS)</th>
                  <th style={{ textAlign: "right" }}>Variance</th>
                  <th style={{ textAlign: "right" }}>Cumulative spend</th>
                  <th style={{ textAlign: "right" }}>Balance remaining</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let cumActual = 0;
                  return FISCAL_MONTHS.map(m => {
                    const planned  = cfEditing ? (cfDraft[m] || 0) : (cashFlow[m] || 0);
                    const actual   = actualByMonth[m] || 0;
                    const variance = actual - planned;
                    cumActual += actual;
                    const balance  = grantTotalTZS - cumActual;
                    return (
                      <tr key={m}>
                        <td style={{ fontWeight: 500 }}>{m}</td>
                        <td style={{ textAlign: "right" }}>
                          {cfEditing
                            ? <input type="number" min="0" value={cfDraft[m] || ""} onChange={e => setCfDraft(d => ({ ...d, [m]: Number(e.target.value) || 0 }))} style={{ width: 120, fontSize: 12, padding: "2px 6px", textAlign: "right" }} />
                            : fmt(planned)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: actual ? 600 : 400 }}>{fmt(actual)}</td>
                        <td style={{ textAlign: "right", fontWeight: 500, color: variance > 0 ? "#c0392b" : variance < 0 ? "#2d7a4f" : "#aaa" }}>
                          {variance > 0 ? `+${fmt(variance)}` : variance < 0 ? `−${fmt(Math.abs(variance))}` : "0"}
                        </td>
                        <td style={{ textAlign: "right", color: "#555" }}>{fmt(cumActual)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: balance < 0 ? "#c0392b" : "#2d7a4f" }}>{fmt(balance)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              <tfoot>
                {(() => {
                  const totalPlanned = FISCAL_MONTHS.reduce((s, m) => s + ((cfEditing ? cfDraft[m] : cashFlow[m]) || 0), 0);
                  const variance = approvedSpend - totalPlanned;
                  return (
                    <tr style={{ fontWeight: 700, background: "#f5f4f0" }}>
                      <td>Total</td>
                      <td style={{ textAlign: "right" }}>{fmt(totalPlanned)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(approvedSpend)}</td>
                      <td style={{ textAlign: "right", color: variance > 0 ? "#c0392b" : "#2d7a4f" }}>
                        {variance > 0 ? `+${fmt(variance)}` : `−${fmt(Math.abs(variance))}`}
                      </td>
                      <td style={{ textAlign: "right" }}>{fmt(approvedSpend)}</td>
                      <td style={{ textAlign: "right", color: grantTotalTZS - approvedSpend < 0 ? "#c0392b" : "#2d7a4f" }}>
                        {fmt(grantTotalTZS - approvedSpend)}
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── PERSONNEL ─────────────────────────────────────────────────────── */}
      {tab === "personnel" && (
        <div className="panel" style={{ borderRadius: "0 8px 8px 8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div className="panel-title" style={{ marginBottom: 2 }}>Personnel budget</div>
              <div style={{ fontSize: 12, color: "#888" }}>Monthly salary plan. To record actual salary payments, add them as "Salaries" budget entries.</div>
            </div>
            {canAdmin && !persEditing && <button className="btn btn-sm btn-primary" onClick={startEditPersonnel}>Edit</button>}
            {persEditing && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={savePersonnel}>Save</button>
                <button className="btn btn-sm" onClick={() => setPersEditing(false)}>Cancel</button>
              </div>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Name / Position</th>
                  <th style={{ textAlign: "right" }}>Monthly salary (TZS)</th>
                  <th style={{ textAlign: "right" }}>Annual (TZS)</th>
                  <th style={{ textAlign: "right" }}>Annual (USD)</th>
                  {persEditing && <th></th>}
                </tr>
              </thead>
              <tbody>
                {(persEditing ? persDraft : personnel).map((p, i) => (
                  <tr key={p.id || i}>
                    <td>
                      {persEditing
                        ? <input value={p.name} onChange={e => setPersField(i, "name", e.target.value)} style={{ fontSize: 12, padding: "2px 6px" }} />
                        : <span style={{ fontWeight: 500 }}>{p.name}</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {persEditing
                        ? <input type="number" min="0" value={p.monthlySalary || ""} onChange={e => setPersField(i, "monthlySalary", Number(e.target.value) || 0)} style={{ width: 130, fontSize: 12, padding: "2px 6px", textAlign: "right" }} />
                        : fmt(p.monthlySalary)}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt((p.monthlySalary || 0) * 12)}</td>
                    <td style={{ textAlign: "right", color: "#555" }}>{fmtUSD((p.monthlySalary || 0) * 12 * rate)}</td>
                    {persEditing && <td><button className="btn btn-sm btn-danger" onClick={() => removePersonRow(i)}>✕</button></td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: "#f5f4f0" }}>
                  <td>Total</td>
                  <td style={{ textAlign: "right" }}>{fmt(personnelMonthlyTZS)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(personnelAnnualTZS)}</td>
                  <td style={{ textAlign: "right" }}>{fmtUSD(personnelAnnualTZS * rate)}</td>
                  {persEditing && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
          {persEditing && (
            <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={addPersonRow}>+ Add row</button>
          )}
        </div>
      )}

      {/* ── P&L ───────────────────────────────────────────────────────────── */}
      {tab === "pl" && (
        <div className="panel" style={{ borderRadius: "0 8px 8px 8px" }}>
          <div className="panel-title">Projected profit &amp; loss: {settings?.grant?.grantPeriod || "2025–2026"}</div>

          <table style={{ maxWidth: 580 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Description</th>
                <th style={{ textAlign: "right" }}>TZS</th>
                <th style={{ textAlign: "right" }}>USD</th>
              </tr>
            </thead>
            <tbody>

              {/* 1. Revenue */}
              <tr style={{ background: "#f0f7f3" }}>
                <td colSpan={3} style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.8px", textTransform: "uppercase", padding: "8px 10px", color: "#2d7a4f" }}>
                  1. Revenue
                </td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20 }}>Grant income</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(grantTotalTZS)}</td>
                <td style={{ textAlign: "right", color: "#555" }}>{fmtUSD(grantTotalUSD)}</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20, color: "#888" }}>Donations</td>
                <td style={{ textAlign: "right", color: "#888" }}>0</td>
                <td style={{ textAlign: "right", color: "#888" }}>$0.00</td>
              </tr>
              <tr style={{ fontWeight: 700, borderTop: "2px solid #e0e0da" }}>
                <td>Total revenue</td>
                <td style={{ textAlign: "right" }}>{fmt(grantTotalTZS)}</td>
                <td style={{ textAlign: "right" }}>{fmtUSD(grantTotalUSD)}</td>
              </tr>

              {/* 2. Expenses */}
              <tr style={{ background: "#fdf0ee" }}>
                <td colSpan={3} style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.8px", textTransform: "uppercase", padding: "8px 10px", color: "#c0392b" }}>
                  2. Operating expenses (approved entries)
                </td>
              </tr>
              {Object.keys(BUDGET_GROUPS).map(g => (
                <tr key={g}>
                  <td style={{ paddingLeft: 20 }}>{g}</td>
                  <td style={{ textAlign: "right", fontWeight: expByGroup[g] ? 600 : 400, color: expByGroup[g] ? "#222" : "#aaa" }}>
                    {fmt(expByGroup[g] || 0)}
                  </td>
                  <td style={{ textAlign: "right", color: expByGroup[g] ? "#555" : "#aaa" }}>
                    {fmtUSD((expByGroup[g] || 0) * rate)}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: "2px solid #e0e0da" }}>
                <td>Total expenses</td>
                <td style={{ textAlign: "right" }}>{fmt(approvedSpend)}</td>
                <td style={{ textAlign: "right" }}>{fmtUSD(approvedSpend * rate)}</td>
              </tr>

              {/* 3. Profit */}
              <tr style={{ background: "#f5f4f0" }}>
                <td colSpan={3} style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.8px", textTransform: "uppercase", padding: "8px 10px", color: "#555" }}>
                  3. Operating profit
                </td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20, color: "#888" }}>Assigned to reserves</td>
                <td style={{ textAlign: "right", color: "#888" }}>0</td>
                <td style={{ textAlign: "right", color: "#888" }}>$0.00</td>
              </tr>
              <tr>
                <td style={{ paddingLeft: 20, color: "#888" }}>Taxes</td>
                <td style={{ textAlign: "right", color: "#888" }}>0</td>
                <td style={{ textAlign: "right", color: "#888" }}>$0.00</td>
              </tr>
              {(() => {
                const netTZS = grantTotalTZS - approvedSpend;
                const netUSD = grantTotalUSD - approvedSpend * rate;
                const color  = netTZS < 0 ? "#c0392b" : "#2d7a4f";
                return (
                  <tr style={{ fontWeight: 800, fontSize: 15, borderTop: "2px solid", borderColor: color, color }}>
                    <td>Net profit (loss)</td>
                    <td style={{ textAlign: "right" }}>{fmt(netTZS)}</td>
                    <td style={{ textAlign: "right" }}>{fmtUSD(netUSD)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>

          {/* Personnel projection note */}
          <div style={{ marginTop: 20, padding: "12px 16px", background: "#f9f9f7", borderRadius: 8, border: "1px solid #e8e8e4", fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Personnel plan (from Personnel tab)</div>
            <div style={{ color: "#555" }}>
              Monthly cost: <strong>TZS {fmt(personnelMonthlyTZS)}</strong> · Annual projection: <strong>TZS {fmt(personnelAnnualTZS)}</strong> ({fmtUSD(personnelAnnualTZS * rate)})
            </div>
            <div style={{ color: "#888", marginTop: 4 }}>Personnel plan amounts are not included in the P&L above until recorded as approved "Salaries" budget entries.</div>
          </div>

          <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
            Exchange rate: 1 TZS = {fmtUSD(rate)} · Grant total and rate configured in Grant setup.
          </div>
        </div>
      )}
    </div>
  );
}
