import { getGroup } from "../services/budgetService";

export function fmtUSD(n) {
  return `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function fmtTZS(n) {
  return `TZS ${Math.round(Number(n) || 0).toLocaleString()}`;
}
export function fmt(n) { return Math.round(Number(n) || 0).toLocaleString(); }
// conversionRate is stored as USD per TZS (same convention as Budget/Dashboard), so TZS = USD / rate.
export function toTZS(usd, rate) {
  return rate ? (Number(usd) || 0) / rate : 0;
}
function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Collapses the system's 5 internal budget groups down to the 3 buckets a fiscal
// sponsor actually cares about: Programmatic (Activities), Personnel, and
// everything else (Office/Financing/Other) as Operational.
export function spendingBucket(category) {
  const group = getGroup(category);
  if (group === "Activities")  return "Programmatic";
  if (group === "Personnel")   return "Personnel";
  return "Operational";
}
export const BUCKET_ORDER = ["Programmatic", "Personnel", "Operational"];

// Statement of expenditure — what was actually received from and spent on behalf of
// the fiscal sponsor. Only "approved" entries count as confirmed spend; drafts and
// submissions still awaiting internal review are deliberately excluded.
export function spendingReportHtml(invoices, approvedEntries, programs, orgName, grant, logoSrc) {
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
