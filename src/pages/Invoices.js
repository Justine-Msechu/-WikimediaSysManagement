import React, { useState, useEffect } from "react";
import {
  listenInvoices, listenInvoicesByGrant, addInvoice, updateInvoice, deleteInvoice,
  INVOICE_STATUSES,
} from "../services/invoiceService";
import { listenSettings } from "../services/settingsService";
import { listenBudgetEntries, getGroup } from "../services/budgetService";
import { listenPrograms } from "../services/programService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import logo from "../assets/logo.png";

const STATUS_BADGE = { draft: "badge-gray", sent: "badge-blue", paid: "badge-green" };

function fmtUSD(n) {
  return `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtTZS(n) {
  return `TZS ${Math.round(Number(n) || 0).toLocaleString()}`;
}
// conversionRate is stored as USD per TZS (same convention as Budget/Dashboard), so TZS = USD / rate.
function toTZS(usd, rate) {
  return rate ? (Number(usd) || 0) / rate : 0;
}
function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Collapses the system's 5 internal budget groups down to the 3 buckets a fiscal
// sponsor actually cares about: Programmatic (Activities), Personnel, and
// everything else (Office/Financing/Other) as Operational.
function spendingBucket(category) {
  const group = getGroup(category);
  if (group === "Activities")  return "Programmatic";
  if (group === "Personnel")   return "Personnel";
  return "Operational";
}
const BUCKET_ORDER = ["Programmatic", "Personnel", "Operational"];

function nextInvoiceNumber(invoices, cycle) {
  const n = invoices.length + 1;
  const tag = (cycle || "").replace(/[^0-9]/g, "").slice(0, 4) || new Date().getFullYear();
  return `INV-${tag}-${String(n).padStart(3, "0")}`;
}

function emptyInvoice(invoices, grant, paymentDetails) {
  return {
    invoiceNumber: nextInvoiceNumber(invoices, grant?.cycle),
    date: new Date().toISOString().slice(0, 10),
    recipientName: "",
    recipientNote: "",
    description: "",
    amountUSD: "",
    status: "draft",
    paymentDetails: { ...paymentDetails },
  };
}

function invoicePrintHtml(inv, orgName, grant, logoSrc) {
  const pd = inv.paymentDetails || {};
  // Always use the grant's own conversion rate, kept in sync with the Grant page — not editable per invoice.
  const rate = Number(grant?.conversionRate) || 0.000413;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Invoice ${esc(inv.invoiceNumber)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1c2b1e; padding: 32px; max-width: 760px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; border-bottom: 2px solid #2d7a4f; padding-bottom: 16px; }
    .header img { width: 56px; height: 56px; object-fit: contain; }
    .header h1 { font-size: 22px; margin: 0; color: #1c2b1e; }
    .header small { display: block; font-size: 12px; color: #888; margin-top: 4px; }
    .meta-row { display: flex; justify-content: space-between; margin: 20px 0; gap: 24px; }
    .meta-row .block { flex: 1; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 2px; }
    h3 { font-size: 13px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; color: #1c2b1e; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
    td, th { padding: 7px 8px; border: 1px solid #e0e0dc; text-align: left; }
    th { background: #f5f4f0; }
    .total-row td { background: #f0f7f3; font-weight: 700; }
    .no-print { text-align: center; margin-bottom: 20px; }
    .no-print button { padding: 10px 28px; font-size: 14px; background: #2d7a4f; color: #fff; border: none; border-radius: 7px; cursor: pointer; margin: 0 6px; }
    .no-print button.sec { background: #f5f4f0; color: #333; border: 1px solid #ccc; }
    @media print { .no-print { display: none; } }
  </style></head><body>
  <div class="no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button class="sec" onclick="window.close()">Close</button>
  </div>
  <div class="header">
    <img src="${logoSrc}" alt="logo">
    <div>
      <h1>Invoice</h1>
      <small>${esc(orgName)} &nbsp;·&nbsp; Disbursement request</small>
    </div>
  </div>

  <div class="meta-row">
    <div class="block">
      <div class="label">From</div>
      ${esc(orgName)}
    </div>
    <div class="block">
      <div class="label">Invoice no.</div>${esc(inv.invoiceNumber)}<br>
      <div class="label" style="margin-top:6px">Date</div>${esc(inv.date)}<br>
      <div class="label" style="margin-top:6px">Grant ID</div>${esc(grant?.grantNumber || grant?.id || "—")}
    </div>
  </div>

  <div class="block">
    <div class="label">To</div>
    ${esc(inv.recipientName || "—")}${inv.recipientNote ? `<br><span style="font-size:12px;color:#888">${esc(inv.recipientNote)}</span>` : ""}
  </div>

  <h3>Grant details</h3>
  <table>
    <tr><td style="width:45%">Grant</td><td>${esc(grant?.title || "—")}</td></tr>
    ${grant?.cycle ? `<tr><td>Grant cycle</td><td>${esc(grant.cycle)}</td></tr>` : ""}
    ${(grant?.startDate || grant?.endDate) ? `<tr><td>Grant period</td><td>${esc(grant.startDate || "")} &ndash; ${esc(grant.endDate || "")}</td></tr>` : ""}
    ${grant?.totalUSD ? `<tr><td>Total approved grant amount</td><td>${fmtUSD(grant.totalUSD)}</td></tr>` : ""}
  </table>

  <h3>Disbursement requested</h3>
  <table>
    <tr><th>Description</th><th style="text-align:right">Amount (USD)</th><th style="text-align:right">Equivalent (TZS)</th></tr>
    <tr><td>${esc(inv.description || "Disbursement request")}</td><td style="text-align:right">${fmtUSD(inv.amountUSD)}</td><td style="text-align:right">${fmtTZS(toTZS(inv.amountUSD, rate))}</td></tr>
    <tr class="total-row"><td>Total amount requested</td><td style="text-align:right">${fmtUSD(inv.amountUSD)}</td><td style="text-align:right">${fmtTZS(toTZS(inv.amountUSD, rate))}</td></tr>
  </table>
  <div style="font-size:11px;color:#888;margin-top:4px">Converted at a rate of 1 TZS = ${rate.toFixed(7)} USD.</div>

  <h3>Payment instructions</h3>
  <table>
    <tr><td style="width:45%">Account holder name</td><td>${esc(pd.accountHolderName)}</td></tr>
    <tr><td>Account holder address</td><td>${esc(pd.accountHolderAddress)}</td></tr>
    <tr><td>Name of financial institution</td><td>${esc(pd.bankName)}</td></tr>
    <tr><td>Bank branch address</td><td>${esc(pd.branchAddress)}</td></tr>
    <tr><td>Bank account number</td><td>${esc(pd.accountNumber)}</td></tr>
    <tr><td>SWIFT / BIC code</td><td>${esc(pd.swift)}</td></tr>
    <tr><td>Currency</td><td>${esc(pd.currency)}</td></tr>
  </table>

  <p style="margin-top:32px">Please remit the above amount to the account specified. For any questions regarding this request, please contact the undersigned.</p>
  <p style="margin-top:48px">Authorized by:<br><br><strong>${esc(orgName)}</strong></p>
  </body></html>`;
}

// Statement of expenditure — what was actually received from and spent on behalf of
// the fiscal sponsor. Only "approved" entries count as confirmed spend; drafts and
// submissions still awaiting internal review are deliberately excluded.
function spendingReportHtml(invoices, approvedEntries, programs, orgName, grant, logoSrc) {
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const totalReceivedUSD = paidInvoices.reduce((s, i) => s + (Number(i.amountUSD) || 0), 0);
  const recipientName = paidInvoices[0]?.recipientName || invoices[0]?.recipientName || "Fiscal sponsor";

  const totalSpentTZS = approvedEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const rate = Number(grant?.conversionRate) || 0.000413;
  const totalSpentUSD = totalSpentTZS * rate;
  const totalReceivedTZS = totalReceivedUSD / rate;

  const programName = (id) => programs.find(p => p.id === id)?.name || "—";

  const byBucket = BUCKET_ORDER.map(bucket => {
    const items = approvedEntries.filter(e => spendingBucket(e.category) === bucket);
    const subtotal = items.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { bucket, items, subtotal };
  }).filter(b => b.items.length > 0);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Spending report — ${esc(orgName)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1c2b1e; padding: 32px; max-width: 820px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; border-bottom: 2px solid #2d7a4f; padding-bottom: 16px; }
    .header img { width: 56px; height: 56px; object-fit: contain; }
    .header h1 { font-size: 22px; margin: 0; color: #1c2b1e; }
    .header small { display: block; font-size: 12px; color: #888; margin-top: 4px; }
    h3 { font-size: 13px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 26px; color: #1c2b1e; }
    .bucket-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #2d7a4f; margin-top: 16px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
    td, th { padding: 6px 8px; border: 1px solid #e0e0dc; text-align: left; }
    th { background: #f5f4f0; }
    .subtotal-row td { background: #f9f9f7; font-weight: 700; }
    .total-row td { background: #f0f7f3; font-weight: 700; font-size: 13px; }
    .summary { display: flex; gap: 24px; flex-wrap: wrap; margin: 16px 0; }
    .summary .box { flex: 1; min-width: 160px; background: #f5f4f0; border-radius: 8px; padding: 12px 14px; }
    .summary .box .label { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .summary .box .value { font-size: 17px; font-weight: 700; }
    .no-print { text-align: center; margin-bottom: 20px; }
    .no-print button { padding: 10px 28px; font-size: 14px; background: #2d7a4f; color: #fff; border: none; border-radius: 7px; cursor: pointer; margin: 0 6px; }
    .no-print button.sec { background: #f5f4f0; color: #333; border: 1px solid #ccc; }
    @media print { .no-print { display: none; } }
  </style></head><body>
  <div class="no-print">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button class="sec" onclick="window.close()">Close</button>
  </div>
  <div class="header">
    <img src="${logoSrc}" alt="logo">
    <div>
      <h1>Spending report</h1>
      <small>${esc(orgName)} &nbsp;·&nbsp; Prepared for ${esc(recipientName)} &nbsp;·&nbsp; ${esc(grant?.title || "")}</small>
    </div>
  </div>

  <div class="summary">
    <div class="box"><div class="label">Received from ${esc(recipientName)}</div><div class="value">${fmtUSD(totalReceivedUSD)}</div><div style="font-size:11px;color:#888">${fmtTZS(totalReceivedTZS)}</div></div>
    <div class="box"><div class="label">Approved spend</div><div class="value" style="color:#c0392b">${fmtUSD(totalSpentUSD)}</div><div style="font-size:11px;color:#888">${fmtTZS(totalSpentTZS)}</div></div>
    <div class="box"><div class="label">Remaining balance</div><div class="value" style="color:${totalReceivedUSD - totalSpentUSD < 0 ? '#c0392b' : '#2d7a4f'}">${fmtUSD(totalReceivedUSD - totalSpentUSD)}</div></div>
  </div>

  <h3>Funds received</h3>
  ${paidInvoices.length === 0 ? "<p style='color:#888;font-size:12px'>No invoices marked as paid yet.</p>" : `
  <table>
    <tr><th>Invoice no.</th><th>Date</th><th>Description</th><th style="text-align:right">Amount (USD)</th><th style="text-align:right">Amount (TZS)</th></tr>
    ${paidInvoices.map(i => `<tr><td>${esc(i.invoiceNumber)}</td><td>${esc(i.date)}</td><td>${esc(i.description)}</td><td style="text-align:right">${fmtUSD(i.amountUSD)}</td><td style="text-align:right">${fmtTZS(toTZS(i.amountUSD, rate))}</td></tr>`).join("")}
    <tr class="total-row"><td colspan="3">Total received</td><td style="text-align:right">${fmtUSD(totalReceivedUSD)}</td><td style="text-align:right">${fmtTZS(totalReceivedTZS)}</td></tr>
  </table>`}

  <h3>Spending breakdown</h3>
  ${byBucket.length === 0 ? "<p style='color:#888;font-size:12px'>No approved spending recorded yet.</p>" : byBucket.map(({ bucket, items, subtotal }) => `
    <div class="bucket-title">${esc(bucket)} — ${fmtTZS(subtotal)} (${fmtUSD(subtotal * rate)})</div>
    <table>
      <tr><th>Date</th><th>Item</th><th>Category</th><th>Program</th><th style="text-align:right">Amount (TZS)</th><th>Receipt</th></tr>
      ${items.map(e => `<tr>
        <td>${esc(e.date)}</td><td>${esc(e.title)}</td><td>${esc(e.category)}</td><td>${esc(e.programId ? programName(e.programId) : "—")}</td>
        <td style="text-align:right">${fmt(e.amount)}</td>
        <td>${e.receiptUrl ? `<a href="${esc(e.receiptUrl)}">View</a>` : "—"}</td>
      </tr>`).join("")}
      <tr class="subtotal-row"><td colspan="4">Subtotal — ${esc(bucket)}</td><td style="text-align:right">${fmt(subtotal)}</td><td></td></tr>
    </table>
  `).join("")}

  <table style="margin-top:16px">
    <tr class="total-row"><td>Total approved spend</td><td style="text-align:right">${fmtTZS(totalSpentTZS)}</td><td style="text-align:right">${fmtUSD(totalSpentUSD)}</td></tr>
  </table>

  <p style="margin-top:32px;font-size:11px;color:#888">This report includes only budget entries with "approved" status. Entries still in draft or awaiting review are not counted as confirmed spend.</p>
  <p style="margin-top:48px">Prepared by:<br><br><strong>${esc(orgName)}</strong></p>
  </body></html>`;
}

export default function Invoices({ profile, grantId, currentGrant }) {
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [budgetEntries, setBudgetEntries] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(null);
  const [toast,    setToast]    = useState("");

  const canEdit   = ["admin", "finance_officer"].includes(profile?.role);
  const canDelete = ["admin", "finance_officer"].includes(profile?.role);

  useEffect(() => {
    const u1 = grantId ? listenInvoicesByGrant(grantId, setInvoices) : listenInvoices(setInvoices);
    const u2 = listenSettings(setSettings);
    const u3 = listenBudgetEntries(setBudgetEntries);
    const u4 = listenPrograms(setPrograms);
    return () => { u1(); u2 && u2(); u3(); u4(); };
  }, [grantId]);

  const grant   = currentGrant || settings?.grant || {};
  const orgName = settings?.org?.name || "Wikimedia Community Kilimanjaro";

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm(emptyInvoice(invoices, grant, settings?.paymentDetails));
    setEditId(null);
    setShowForm(true);
  };
  const openEdit = (inv) => {
    setForm({
      ...inv,
      paymentDetails: { ...(inv.paymentDetails || settings?.paymentDetails || {}) },
    });
    setEditId(inv.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.recipientName.trim()) { alert("Recipient name is required."); return; }
    if (!form.amountUSD || Number(form.amountUSD) <= 0) { alert("Amount must be greater than zero."); return; }
    const data = { ...form, amountUSD: Number(form.amountUSD), grantId: grantId || "" };
    if (!editId) {
      const id = await addInvoice(data);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "invoices", { targetId: id, recordTitle: data.invoiceNumber });
      showToast("Invoice created.");
    } else {
      await updateInvoice(editId, data);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "invoices", { targetId: editId, recordTitle: data.invoiceNumber });
      showToast("Invoice updated.");
    }
    setShowForm(false);
  };

  const del = async (inv) => {
    if (!window.confirm(`Delete invoice "${inv.invoiceNumber}"?`)) return;
    await deleteInvoice(inv.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "invoices", { targetId: inv.id, recordTitle: inv.invoiceNumber });
    showToast("Invoice deleted.");
  };

  const setStatus = async (inv, status) => {
    await updateInvoice(inv.id, { status });
    await addAudit(profile, AUDIT_ACTIONS.UPDATE, "invoices", { targetId: inv.id, recordTitle: inv.invoiceNumber, details: `Status changed to ${status}` });
    showToast(`Invoice marked as ${status}.`);
  };

  const printInvoice = (inv) => {
    const html = invoicePrintHtml(inv, orgName, grant, logo);
    const w = window.open("", "_blank", "width=900,height=750");
    w.document.write(html);
    w.document.close();
  };

  const printSpendingReport = () => {
    const visibleEntries  = grantId ? budgetEntries.filter(e => e.grantId === grantId) : budgetEntries;
    const approvedEntries = visibleEntries.filter(e => e.status === "approved");
    const visiblePrograms = grantId ? programs.filter(p => p.grantId === grantId) : programs;
    const html = spendingReportHtml(invoices, approvedEntries, visiblePrograms, orgName, grant, logo);
    const w = window.open("", "_blank", "width=1000,height=800");
    w.document.write(html);
    w.document.close();
  };

  const sortedInvoices = [...invoices].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.amountUSD) || 0), 0);
  const totalGrant    = Number(grant?.totalUSD) || 0;

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Invoices</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
        Create and print disbursement invoices for this grant (e.g. tranche requests to a fiscal sponsor).
      </div>

      {/* Summary */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div><div className="label" style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Total grant</div><div style={{ fontSize: 20, fontWeight: 700 }}>{fmtUSD(totalGrant)}</div></div>
          <div><div className="label" style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Total invoiced</div><div style={{ fontSize: 20, fontWeight: 700 }}>{fmtUSD(totalInvoiced)}</div></div>
          <div><div className="label" style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Remaining</div><div style={{ fontSize: 20, fontWeight: 700, color: totalGrant - totalInvoiced < 0 ? "#c0392b" : "#2d7a4f" }}>{fmtUSD(totalGrant - totalInvoiced)}</div></div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16 }}>
        <button className="btn" onClick={printSpendingReport}>Spending report</button>
        {canEdit && <button className="btn btn-primary" onClick={openCreate}>+ New invoice</button>}
      </div>

      {showForm && form && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit invoice" : "New invoice"}</div>
          <div className="form-grid">
            <div className="field"><label>Invoice number</label><input value={form.invoiceNumber} onChange={e => setF("invoiceNumber", e.target.value)} /></div>
            <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e => setF("date", e.target.value)} /></div>
            <div className="field"><label>Recipient (e.g. fiscal sponsor)</label><input value={form.recipientName} onChange={e => setF("recipientName", e.target.value)} placeholder="Dunia Salama Foundation" /></div>
            <div className="field"><label>Recipient note</label><input value={form.recipientNote} onChange={e => setF("recipientNote", e.target.value)} placeholder="Fiscal sponsor" /></div>
            <div className="field"><label>Amount requested (USD)</label><input type="number" min="0" step="0.01" value={form.amountUSD} onChange={e => setF("amountUSD", e.target.value)} /></div>
            <div className="field"><label>Equivalent in TZS</label><input value={fmtTZS(toTZS(form.amountUSD, Number(grant?.conversionRate) || 0.000413))} disabled /></div>
            <div className="field"><label>Status</label>
              <select value={form.status} onChange={e => setF("status", e.target.value)}>
                {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Description</label><input value={form.description} onChange={e => setF("description", e.target.value)} placeholder="First tranche disbursement — 50% of total approved grant" /></div>
          <div style={{ fontSize: 12, color: "#888", marginTop: -6, marginBottom: 10 }}>
            TZS conversion uses this grant's rate (1 TZS = {(Number(grant?.conversionRate) || 0.000413).toFixed(7)} USD), set on the Grants page.
          </div>

          <div className="panel-title" style={{ fontSize: 13, marginTop: 16 }}>Payment details</div>
          <div className="form-grid">
            <div className="field"><label>Account holder name</label><input value={form.paymentDetails?.accountHolderName || ""} onChange={e => setF("paymentDetails", { ...form.paymentDetails, accountHolderName: e.target.value })} /></div>
            <div className="field"><label>Account holder address</label><input value={form.paymentDetails?.accountHolderAddress || ""} onChange={e => setF("paymentDetails", { ...form.paymentDetails, accountHolderAddress: e.target.value })} /></div>
            <div className="field"><label>Name of financial institution</label><input value={form.paymentDetails?.bankName || ""} onChange={e => setF("paymentDetails", { ...form.paymentDetails, bankName: e.target.value })} /></div>
            <div className="field"><label>Bank branch address</label><input value={form.paymentDetails?.branchAddress || ""} onChange={e => setF("paymentDetails", { ...form.paymentDetails, branchAddress: e.target.value })} /></div>
            <div className="field"><label>Bank account number</label><input value={form.paymentDetails?.accountNumber || ""} onChange={e => setF("paymentDetails", { ...form.paymentDetails, accountNumber: e.target.value })} /></div>
            <div className="field"><label>SWIFT / BIC code</label><input value={form.paymentDetails?.swift || ""} onChange={e => setF("paymentDetails", { ...form.paymentDetails, swift: e.target.value })} /></div>
            <div className="field"><label>Currency</label><input value={form.paymentDetails?.currency || ""} onChange={e => setF("paymentDetails", { ...form.paymentDetails, currency: e.target.value })} /></div>
          </div>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={save}>{editId ? "Save changes" : "Create invoice"}</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: 0 }}>
        {sortedInvoices.length === 0 ? <div className="empty">No invoices yet.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Invoice no.</th><th>Date</th><th>Recipient</th><th>Description</th><th style={{ textAlign: "right" }}>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {sortedInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 500, fontFamily: "monospace" }}>{inv.invoiceNumber}</td>
                    <td style={{ fontSize: 12 }}>{inv.date}</td>
                    <td style={{ fontSize: 12 }}>{inv.recipientName}</td>
                    <td style={{ fontSize: 12 }}>{inv.description}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 600 }}>{fmtUSD(inv.amountUSD)}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{fmtTZS(toTZS(inv.amountUSD, Number(grant?.conversionRate) || 0.000413))}</div>
                    </td>
                    <td>
                      {canEdit ? (
                        <select value={inv.status} onChange={e => setStatus(inv, e.target.value)} style={{ fontSize: 11 }}>
                          {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`badge ${STATUS_BADGE[inv.status] || "badge-gray"}`}>{inv.status}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => printInvoice(inv)}>Print</button>
                        {canEdit && <button className="btn btn-sm" onClick={() => openEdit(inv)}>Edit</button>}
                        {canDelete && <button className="btn btn-sm btn-danger" onClick={() => del(inv)}>✕</button>}
                      </div>
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
