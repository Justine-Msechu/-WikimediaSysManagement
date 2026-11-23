// ── Printable pages for Active contributors ────────────────────────────────────
// Each builder returns a complete HTML document (string). openPrintWindow()
// shows it in a new window with a "Print / Save PDF" button, the same way the
// Participants certificate and Metrics report work.

import { isEditing, bestContributors, STILL_EDITING_MIN } from "./wikiContribs";
import { RETAINED_MIN_MONTHS, LABELS } from "./yearSummary";

export function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function monthName(month, style = "long") {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: style, year: "numeric", timeZone: "UTC" });
}

export function periodName(start, end) {
  return start === end ? monthName(start) : `${monthName(start)} – ${monthName(end)}`;
}

// ── Shared certificate footer: coordinator signature + print date ─────────────
// Used by community member certificates and the Participants page certificate.
// signature: { signatureImage, signatoryName, signatoryTitle } from Settings.
export const CERT_FOOTER_CSS = `
    .footer { display: flex; justify-content: space-around; align-items: flex-end; margin-top: 22px; }
    .sig { font-size: 12px; color: #888; min-width: 180px; }
    .sig .above { height: 64px; display: flex; align-items: flex-end; justify-content: center; }
    .sig .above img { max-height: 64px; max-width: 220px; object-fit: contain; }
    .sig .date { font-size: 14px; color: #1c2b1e; font-weight: 600; padding-bottom: 4px; }
    .sig span { display: block; border-top: 1px solid #999; padding-top: 6px; }`;

// ── Shared certificate watermark: Wikimedia logos behind the text ─────────────
// art: { center, icons[] } from utils/certificateArt.js (absolute image URLs).
// The parent .cert must use CERT_ART_CSS (position: relative).
export const CERT_ART_CSS = `
    .cert { position: relative; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cert > * { position: relative; z-index: 1; }
    .cert > .wm { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
    .wm img { position: absolute; }
    .wm .center { left: 50%; top: 54%; width: 44%; transform: translate(-50%, -50%); opacity: .05; }
    .wm .side { opacity: .09; }
    .cert .body { max-width: 82%; margin-left: auto; margin-right: auto; }
    .wm-row { display: flex; justify-content: center; gap: 14px; margin-top: 18px; }
    .wm-row img { height: 22px; width: auto; opacity: .8; }`;

const SIDE_SPOTS = [
  "top: 5%; left: 3%; width: 8%; transform: rotate(-12deg);",
  "top: 5%; right: 3%; width: 8%; transform: rotate(12deg);",
  "top: 40%; left: 1.5%; width: 6.5%; transform: rotate(8deg);",
  "top: 40%; right: 1.5%; width: 6.5%; transform: rotate(-8deg);",
  "bottom: 6%; left: 4%; width: 7.5%; transform: rotate(10deg);",
  "bottom: 6%; right: 4%; width: 7.5%; transform: rotate(-10deg);",
];

export function certificateArtHtml(art) {
  if (!art || !art.icons?.length) return "";
  return `<div class="wm" aria-hidden="true">
      ${art.center ? `<img class="center" src="${esc(art.center)}" alt=""/>` : ""}
      ${art.icons.slice(0, SIDE_SPOTS.length).map((u, i) => `<img class="side" src="${esc(u)}" alt="" style="${SIDE_SPOTS[i]}"/>`).join("")}
    </div>`;
}

export function certificateIconRowHtml(art) {
  if (!art || !art.icons?.length) return "";
  return `<div class="wm-row" aria-hidden="true">${art.icons.map(u => `<img src="${esc(u)}" alt=""/>`).join("")}</div>`;
}

export function certificateFooterHtml(signature = {}, printedOn = todayLong()) {
  const { signatureImage, signatoryName, signatoryTitle } = signature;
  const label = [signatoryName, signatoryTitle || "Coordinator"].filter(Boolean).join(", ");
  return `<div class="footer">
      <div class="sig">
        <div class="above">${signatureImage ? `<img src="${esc(signatureImage)}" alt="signature"/>` : ""}</div>
        <span>${esc(signatureImage || signatoryName ? label : "Coordinator signature")}</span>
      </div>
      <div class="sig"><div class="above"><div class="date">${esc(printedOn)}</div></div><span>Date</span></div>
    </div>`;
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "0%");
function todayLong() { return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }); }
const today = todayLong;
const names = (people) => people.map(p => esc(p.name)).join(" &amp; ");

const BASE_CSS = `
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1c2b1e; margin: 0; padding: 32px; font-size: 12px; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #2d7a4f; padding-bottom: 12px; margin-bottom: 18px; }
  .head img { width: 54px; height: 54px; object-fit: contain; }
  .head .org { font-size: 11px; color: #888; letter-spacing: 1.5px; text-transform: uppercase; }
  h1 { font-size: 20px; margin: 2px 0 0; }
  h2 { font-size: 14px; margin: 22px 0 8px; color: #2d7a4f; }
  .sub { color: #666; margin-bottom: 14px; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .card { border: 1px solid #e0e0da; border-radius: 8px; padding: 8px 12px; min-width: 110px; }
  .card .l { font-size: 10px; color: #888; } .card .v { font-size: 18px; font-weight: 700; }
  .best { border: 2px solid #d97706; background: #fffaf0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; }
  .best .t { font-size: 10px; color: #b45309; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; }
  .best .n { font-size: 16px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #666; border-bottom: 2px solid #ddd; padding: 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #eee; }
  .num { text-align: right; }
  .tag { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .g { background: #e8f5ec; color: #2d6a47; } .b { background: #e6f0fb; color: #1a5fa8; } .a { background: #fef3e2; color: #8a5200; } .x { background: #f0f0ec; color: #666; }
  .note { font-size: 10px; color: #888; margin-top: 14px; line-height: 1.6; }
  .warn { background: #fef3e2; color: #8a5200; border: 1px solid #f5d89a; border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; }
  .no-print { position: fixed; top: 14px; right: 14px; }
  .no-print button { padding: 8px 18px; background: #2d7a4f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
  @media print { .no-print { display: none; } body { padding: 0; } tr { page-break-inside: avoid; } }
`;

function page({ title, orgName, logoUrl, heading, size = "A4 portrait", body }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>@page { size: ${size}; margin: 14mm; } ${BASE_CSS}</style></head><body>
  <div class="no-print"><button onclick="window.print()">Print / Save PDF</button></div>
  <div class="head"><img src="${esc(logoUrl)}" alt="logo"/><div><div class="org">${esc(orgName)}</div><h1>${esc(heading)}</h1></div></div>
  ${body}
  <div class="note">Generated ${today()}.</div>
  </body></html>`;
}

// ── Monthly report ─────────────────────────────────────────────────────────────
export function monthReportHtml({ rows, month, wikiLabel, threshold, partial, orgName, logoUrl }) {
  const active  = rows.filter(r => r.active).length;
  const editing = rows.filter(isEditing).length;
  const best    = bestContributors(rows);
  const body = `
    <div class="sub">${esc(wikiLabel)} · ${esc(monthName(month))} · Active = ${threshold}+ different articles, still editing = ${STILL_EDITING_MIN}+</div>
    ${partial ? `<div class="warn">${esc(monthName(month))} was not finished when this report was made. Counts are so far.</div>` : ""}
    ${best.length ? `<div class="best"><div class="t">★ Best contributor of the month</div>
      <div class="n">${names(best)}</div><div>${best[0].articles} different articles, ${best.map(b => b.edits).join(" / ")} edits</div></div>` : ""}
    <div class="cards">
      <div class="card"><div class="l">Members checked</div><div class="v">${rows.length}</div></div>
      <div class="card"><div class="l">Active (${threshold}+)</div><div class="v" style="color:#2d7a4f">${active}</div></div>
      <div class="card"><div class="l">Still editing (${STILL_EDITING_MIN}+)</div><div class="v" style="color:#2563eb">${editing}</div></div>
      <div class="card"><div class="l">Not editing</div><div class="v" style="color:#d97706">${rows.length - editing}</div></div>
      <div class="card"><div class="l">Active rate</div><div class="v">${pct(active, rows.length)}</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Name</th><th>Username</th><th class="num">Different articles</th><th class="num">Total edits</th><th>Status</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}${best.includes(r) ? " ★" : ""}</td><td>${esc(r.username)}</td>
      <td class="num"><strong>${r.articles}</strong></td><td class="num">${r.edits}</td>
      <td>${r.active ? '<span class="tag g">Active</span>' : isEditing(r) ? '<span class="tag b">Still editing</span>' : '<span class="tag a">Not editing</span>'}</td></tr>`).join("")}
    </tbody></table>
    <div class="note">Counts different main-namespace articles edited in the UTC calendar month. Edits to pages deleted later are not counted.</div>`;
  return page({ title: `Active contributors ${month}`, orgName, logoUrl, heading: `Active contributors — ${monthName(month)}`, body });
}

// ── Year / quarter summary ─────────────────────────────────────────────────────
export function yearReportHtml({ summary, start, end, wikiLabel, quarterRows = [], orgName, logoUrl }) {
  const t = summary.totals;
  const tag = { active: "g", retained: "b", participated: "x" };
  const body = `
    <div class="sub">${esc(wikiLabel)} · ${esc(periodName(start, end))} · ${summary.covered.length} of ${summary.months.length} months saved</div>
    ${summary.missing.length ? `<div class="warn">No saved report for ${summary.missing.map(m => esc(monthName(m, "short"))).join(", ")}: this summary undercounts those months.</div>` : ""}
    <div class="cards">
      <div class="card"><div class="l">People</div><div class="v">${t.people}</div></div>
      <div class="card"><div class="l">Active contributors</div><div class="v" style="color:#2d7a4f">${t.active}</div></div>
      <div class="card"><div class="l">Retained (${RETAINED_MIN_MONTHS}+ months)</div><div class="v" style="color:#2563eb">${t.retained}</div></div>
      <div class="card"><div class="l">Still editing (1+ month)</div><div class="v" style="color:#2563eb">${t.editedOnce}</div></div>
      <div class="card"><div class="l">Articles (monthly total)</div><div class="v">${t.articles.toLocaleString()}</div></div>
    </div>
    ${quarterRows.length > 1 ? `<h2>Quarter by quarter</h2>
    <table><thead><tr><th>Quarter</th><th class="num">Months saved</th><th class="num">Still editing</th><th class="num">Active</th><th class="num">Articles</th></tr></thead><tbody>
    ${quarterRows.map(({ q, s }) => `<tr><td><strong>${q.label}</strong> ${esc(periodName(q.start, q.end))}</td><td class="num">${s.covered.length} of ${q.months.length}</td>
      <td class="num">${s.totals.editedOnce}</td><td class="num">${s.totals.active}</td><td class="num">${s.totals.articles.toLocaleString()}</td></tr>`).join("")}
    </tbody></table>` : ""}
    <h2>★ Best contributor of each month</h2>
    ${summary.bestByMonth.length ? `<table><thead><tr><th>Month</th><th>Best contributor</th><th class="num">Different articles</th></tr></thead><tbody>
      ${summary.bestByMonth.map(b => `<tr><td>${esc(monthName(b.month))}</td><td>${b.people.length ? names(b.people) : "—"}</td><td class="num">${b.articles || ""}</td></tr>`).join("")}
    </tbody></table>` : `<div class="sub">No saved months in this period.</div>`}
    <h2>Every member</h2>
    <table><thead><tr><th>#</th><th>Name</th><th>Username</th><th>Recognition</th><th class="num">Months active</th><th class="num">Months editing</th><th class="num">Total articles</th><th>Best month</th></tr></thead><tbody>
    ${summary.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}${r.bestOfMonth.length ? " ★" : ""}</td><td>${esc(r.username)}</td>
      <td><span class="tag ${tag[r.label]}">${LABELS[r.label]}</span></td><td class="num">${r.monthsActive}</td><td class="num">${r.monthsEditing}</td>
      <td class="num"><strong>${r.totalArticles.toLocaleString()}</strong></td><td>${r.bestMonth.month ? `${esc(monthName(r.bestMonth.month, "short"))} (${r.bestMonth.articles})` : ""}</td></tr>`).join("")}
    </tbody></table>
    <div class="note">Active contributor: reached the active level (e.g. 30+ different Wikipedia articles) in at least one month. Retained: still editing (1+ article) in ${RETAINED_MIN_MONTHS}+ months.
      ★ = best contributor of at least one month. Total articles adds the monthly counts, so an article edited in two months counts twice.</div>`;
  return page({ title: `Contributors ${start} to ${end}`, orgName, logoUrl, heading: `Contributor summary — ${periodName(start, end)}`, size: "A4 landscape", body });
}

// ── Certificates ───────────────────────────────────────────────────────────────
const CERT_TEXT = {
  active: {
    title: "Certificate of Recognition",
    badge: "Active Contributor",
    line: (r) => `edited <strong>${r.totalArticles.toLocaleString()}</strong> Wikipedia articles and reached the active contributor level in <strong>${r.monthsActive}</strong> month${r.monthsActive === 1 ? "" : "s"}`,
  },
  retained: {
    title: "Certificate of Appreciation",
    badge: "Retained Volunteer",
    line: (r) => `kept contributing to Wikipedia in <strong>${r.monthsEditing}</strong> months, editing <strong>${r.totalArticles.toLocaleString()}</strong> articles`,
  },
  participated: {
    title: "Certificate of Participation",
    badge: "Community Volunteer",
    line: (r) => r.totalArticles > 0
      ? `took part in our Wikimedia activities and edited <strong>${r.totalArticles.toLocaleString()}</strong> Wikipedia article${r.totalArticles === 1 ? "" : "s"}`
      : "took part in our Wikimedia community activities as a volunteer",
  },
};

function certificate(r, { orgName, logoUrl, start, end, signature = {}, printedOn, art, eventsOnly }) {
  const c = CERT_TEXT[r.label] || CERT_TEXT.participated;
  const best = r.bestOfMonth.length
    ? `<div class="star">★ Best contributor of the month: ${r.bestOfMonth.map(m => esc(monthName(m))).join(", ")}</div>` : "";
  return `<div class="cert">
    ${certificateArtHtml(art)}
    <img src="${esc(logoUrl)}" class="logo" alt="logo"/>
    <div class="org">${esc(orgName)}</div>
    <h1>${c.title}</h1>
    <div class="badge">${c.badge}</div>
    <div class="presented">This is to certify that</div>
    <div class="name">${esc(r.name)}</div>
    <div class="body">
      as a volunteer of <strong>${esc(orgName)}</strong>, ${c.line(r)}${eventsOnly && r.totalArticles > 0 ? " in our community events" : ""}
      during <strong>${esc(periodName(start, end))}</strong>, helping to grow free knowledge.
      <br><span class="user">Wikipedia username: <strong>${esc(r.username)}</strong></span>
    </div>
    ${best}
    ${certificateFooterHtml(signature, printedOn)}
    ${certificateIconRowHtml(art)}
  </div>`;
}

// signature: { signatureImage, signatoryName, signatoryTitle } from Settings.
// printedOn defaults to today — the day the certificate is printed.
// eventsOnly: the numbers count only edits made in Kilimanjaro events.
export function certificatesHtml(rows, { orgName, logoUrl, start, end, signature = {}, printedOn = today(), art, eventsOnly = false }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${rows.length === 1 ? `Certificate — ${esc(rows[0].name)}` : `Certificates (${rows.length})`}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    body { font-family: 'Segoe UI', Georgia, serif; margin: 0; background: #fff; color: #1c2b1e; }
    .cert { box-sizing: border-box; width: 270mm; min-height: 180mm; margin: 12mm auto; text-align: center; border: 8px double #2d7a4f; padding: 34px 56px; page-break-after: always; }
    .cert:last-child { page-break-after: auto; }
    .logo { width: 72px; height: 72px; object-fit: contain; margin-bottom: 8px; }
    .org { font-size: 13px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    h1 { font-size: 34px; font-weight: 300; color: #2d7a4f; margin: 0 0 6px; }
    .badge { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #fff; background: #2d7a4f; border-radius: 14px; padding: 3px 14px; margin-bottom: 18px; }
    .presented { font-size: 14px; color: #555; margin-bottom: 10px; }
    .name { font-size: 32px; font-weight: 700; border-bottom: 2px solid #4a9e6b; display: inline-block; padding-bottom: 6px; margin-bottom: 18px; }
    .body { font-size: 14px; color: #444; line-height: 1.8; margin-bottom: 12px; }
    .user { font-size: 12px; color: #777; }
    .star { display: inline-block; font-size: 13px; font-weight: 600; color: #b45309; border: 1px solid #f0d5b0; background: #fffaf0; border-radius: 6px; padding: 4px 12px; margin-bottom: 6px; }
    ${CERT_FOOTER_CSS}
    ${CERT_ART_CSS}
    .no-print { position: fixed; top: 16px; right: 16px; }
    .no-print button { padding: 8px 20px; background: #2d7a4f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
    @media print { .no-print { display: none; } .cert { margin: 15mm auto 0; } }
  </style></head><body>
  <div class="no-print"><button onclick="window.print()">Print / Save PDF${rows.length > 1 ? ` (${rows.length})` : ""}</button></div>
  ${rows.map(r => certificate(r, { orgName, logoUrl, start, end, signature, printedOn, art, eventsOnly })).join("")}
  </body></html>`;
}

export function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=1000,height=750");
  if (!w) { alert("Please allow pop-ups for this site to print."); return; }
  w.document.write(html);
  w.document.close();
}
