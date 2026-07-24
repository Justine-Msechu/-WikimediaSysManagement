import { monthLabel } from "../data/plannedTimeline";

function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Printable planned-vs-actual schedule grid, for answering GSF report questions about
// whether the approved timeline was followed. comparisonRows/timelineColumns are the
// same data the on-screen Timeline page computes — this just renders it for print/PDF.
export function timelineReportHtml(comparisonRows, timelineColumns, orgName, grant, logoSrc) {
  const totalPlanned = comparisonRows.reduce((s, r) => s + r.months.length, 0);
  const totalDone    = comparisonRows.reduce((s, r) => s + r.done, 0);
  const totalExtra   = comparisonRows.reduce((s, r) => s + r.extra.length, 0);

  const dotCell = (planned, actual) => {
    if (planned && actual)       return `<span class="dot dot-done" title="Planned and done"></span>`;
    if (planned && !actual)      return `<span class="dot dot-pending" title="Planned, not yet logged"></span>`;
    if (!planned && actual)      return `<span class="dot dot-extra" title="Logged, not in the plan"></span>`;
    return "";
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Planned vs actual timeline — ${esc(orgName)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1c2b1e; padding: 32px; max-width: 980px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; border-bottom: 2px solid #2d7a4f; padding-bottom: 16px; }
    .header img { width: 56px; height: 56px; object-fit: contain; }
    .header h1 { font-size: 22px; margin: 0; color: #1c2b1e; }
    .header small { display: block; font-size: 12px; color: #888; margin-top: 4px; }
    .summary { display: flex; gap: 24px; flex-wrap: wrap; margin: 16px 0 24px; }
    .summary .box { flex: 1; min-width: 140px; background: #f5f4f0; border-radius: 8px; padding: 12px 14px; }
    .summary .box .label { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .summary .box .value { font-size: 17px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11px; }
    td, th { padding: 5px 6px; border: 1px solid #e0e0dc; text-align: center; }
    th { background: #f5f4f0; font-size: 10px; color: #888; }
    td:first-child, th:first-child { text-align: left; white-space: nowrap; font-size: 12px; color: #1c2b1e; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .dot-done { background: #2d7a4f; }
    .dot-pending { border: 2px solid #d68a1a; }
    .dot-extra { background: #3a7bd5; }
    .legend { display: flex; gap: 18px; font-size: 11px; color: #555; margin: 10px 0 18px; flex-wrap: wrap; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
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
      <h1>Planned vs actual timeline</h1>
      <small>${esc(orgName)} &nbsp;·&nbsp; ${esc(grant?.title || "")}</small>
    </div>
  </div>

  <div class="summary">
    <div class="box"><div class="label">Planned sessions</div><div class="value">${totalPlanned}</div></div>
    <div class="box"><div class="label">Completed</div><div class="value" style="color:#2d7a4f">${totalDone}</div></div>
    <div class="box"><div class="label">Pending</div><div class="value" style="color:#d68a1a">${totalPlanned - totalDone}</div></div>
    <div class="box"><div class="label">Off-schedule</div><div class="value" style="color:#3a7bd5">${totalExtra}</div></div>
  </div>

  <div class="legend">
    <span><span class="dot dot-done"></span> Planned and done</span>
    <span><span class="dot dot-pending"></span> Planned, not yet logged</span>
    <span><span class="dot dot-extra"></span> Logged, not in the plan</span>
  </div>

  ${comparisonRows.length === 0 ? "<p style='color:#888;font-size:12px'>No planned schedule data available.</p>" : `
  <table>
    <tr><th>Program</th>${timelineColumns.map(m => `<th>${esc(monthLabel(m))}</th>`).join("")}<th>On track</th></tr>
    ${comparisonRows.map(({ program, months, actualMonths, done, extra }) => `
      <tr>
        <td>${esc(program.name)}</td>
        ${timelineColumns.map(m => `<td>${dotCell(months.includes(m), actualMonths.has(m))}</td>`).join("")}
        <td>${done}/${months.length}${extra.length > 0 ? ` <span style="color:#3a7bd5">+${extra.length}</span>` : ""}</td>
      </tr>
    `).join("")}
  </table>`}

  <p style="margin-top:32px;font-size:11px;color:#888">Planned months reflect either the WMF-approved timeline document or the most recently imported timeline schedule for each program.</p>
  <p style="margin-top:48px">Prepared by:<br><br><strong>${esc(orgName)}</strong></p>
  </body></html>`;
}
