// ── Year summary — each member across a period of months ──────────────────────
// Pure JS (no React / Firebase). Built from saved monthly contributor reports,
// no extra Wikipedia requests.

import { normalizeUsername, isEditing, shiftMonth, currentMonth } from "./wikiContribs";

// Still editing in at least this many months → retained member.
export const RETAINED_MIN_MONTHS = 3;

export const LABELS = {
  active:       "Active contributor",
  retained:     "Retained",
  participated: "Participated",
};

// Every "YYYY-MM" from start to end inclusive (empty if end < start).
export function monthRange(start, end) {
  const out = [];
  if (!start || !end || end < start) return out;
  for (let m = start; m <= end && out.length < 120; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

// Default period: the grant's months if it has dates, else the last 12 full months.
export function defaultPeriod(grant, now = new Date()) {
  const s = (grant?.startDate || "").slice(0, 7);
  const e = (grant?.endDate || "").slice(0, 7);
  if (s && e && s <= e) return { start: s, end: e };
  const last = shiftMonth(currentMonth(now), -1);
  return { start: shiftMonth(last, -11), end: last };
}

// Split a period into quarters of 3 months, counted from its first month
// (so a July–June grant year gives Q1 = Jul–Sep). A short last quarter is kept.
export function quarters(start, end) {
  const months = monthRange(start, end);
  const out = [];
  for (let i = 0; i < months.length; i += 3) {
    const chunk = months.slice(i, i + 3);
    out.push({ label: `Q${out.length + 1}`, start: chunk[0], end: chunk[chunk.length - 1], months: chunk });
  }
  return out;
}

/**
 * reports: saved contributorReports
 * members: communityMembers (for names; people only in reports are included too)
 * opts:    { start, end, wiki = "all", now }
 *
 * Per person and month, wikis are combined: articles/edits are added up,
 * active / still editing if true on any wiki. Partial (unfinished) months are skipped.
 */
export function buildYearSummary(reports, members, { start, end, wiki = "all", now = new Date() } = {}) {
  const months = monthRange(start, end);
  const monthSet = new Set(months);
  const used = (reports || []).filter(r =>
    !r.partial && monthSet.has(r.month) && (wiki === "all" || r.wiki === wiki)
  );

  const covered = new Set(used.map(r => r.month));
  const thisMonth = currentMonth(now);
  const missing = months.filter(m => !covered.has(m) && m < thisMonth);
  const future  = months.filter(m => m >= thisMonth);

  const people = new Map();   // username → person
  const person = (username, name) => {
    if (!people.has(username)) people.set(username, { username, name: name || username, byMonth: {} });
    const p = people.get(username);
    if (name && p.name === username) p.name = name;
    return p;
  };

  for (const m of members || []) {
    const u = normalizeUsername(m.wikimediaUsername);
    if (u) person(u, (m.name || "").trim());
  }

  for (const r of used) {
    for (const row of r.rows || []) {
      const u = normalizeUsername(row.username);
      if (!u) continue;
      const p = person(u, row.name);
      const cell = p.byMonth[r.month] || (p.byMonth[r.month] = { articles: 0, edits: 0, active: false, editing: false });
      cell.articles += Number(row.articles) || 0;
      cell.edits    += Number(row.edits) || 0;
      cell.active    = cell.active || !!row.active;
      cell.editing   = cell.editing || isEditing(row);
    }
  }

  const rows = [...people.values()].map(p => {
    const cells = Object.entries(p.byMonth);
    const monthsActive  = cells.filter(([, c]) => c.active).length;
    const monthsEditing = cells.filter(([, c]) => c.editing).length;
    const totalArticles = cells.reduce((s, [, c]) => s + c.articles, 0);
    const totalEdits    = cells.reduce((s, [, c]) => s + c.edits, 0);
    const best = cells.reduce((b, [m, c]) => (c.articles > b.articles ? { month: m, articles: c.articles } : b), { month: "", articles: 0 });
    const isActiveContributor = monthsActive >= 1;
    const isRetained = monthsEditing >= RETAINED_MIN_MONTHS;
    const label = isActiveContributor ? "active" : isRetained ? "retained" : "participated";
    return { ...p, monthsActive, monthsEditing, totalArticles, totalEdits, bestMonth: best, isActiveContributor, isRetained, label };
  });

  const order = { active: 0, retained: 1, participated: 2 };
  rows.sort((a, b) => order[a.label] - order[b.label] || b.totalArticles - a.totalArticles || a.name.localeCompare(b.name));

  return {
    months,
    covered: months.filter(m => covered.has(m)),
    missing,
    future,
    rows,
    totals: {
      people:       rows.length,
      active:       rows.filter(r => r.isActiveContributor).length,
      retained:     rows.filter(r => r.isRetained).length,          // includes active people with 3+ months
      editedOnce:   rows.filter(r => r.monthsEditing >= 1).length,
      participated: rows.filter(r => r.label === "participated").length,
      articles:     rows.reduce((s, r) => s + r.totalArticles, 0),
    },
  };
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function yearSummaryToCsv(summary) {
  const header = ["#", "Name", "Username", "Label", "Months active (60+)", `Months still editing (1+)`, "Total articles", "Total edits", "Best month", "Best month articles", ...summary.months];
  const lines = [header.map(csvCell).join(",")];
  summary.rows.forEach((r, i) => {
    lines.push([
      i + 1, r.name, r.username, LABELS[r.label], r.monthsActive, r.monthsEditing,
      r.totalArticles, r.totalEdits, r.bestMonth.month, r.bestMonth.articles,
      ...summary.months.map(m => (r.byMonth[m] ? r.byMonth[m].articles : "")),
    ].map(csvCell).join(","));
  });
  return lines.join("\r\n");
}
