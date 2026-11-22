// ── Event selection — who should join an event ────────────────────────────────
// Pure JS (no React / Firebase). Uses saved Active contributors reports to rank
// registrants who are already community members, and keeps a share of the seats
// for new members.

import { normalizeUsername } from "./wikiContribs";

export const DEFAULT_NEW_MEMBER_PCT = 30;

// Latest finished month that has a saved report. If `beforeMonth` is given
// ("YYYY-MM", e.g. the event's month), only months before it are considered.
export function rankingMonth(reports, beforeMonth = "") {
  const months = (reports || [])
    .filter(r => !r.partial && r.month && (!beforeMonth || r.month < beforeMonth))
    .map(r => r.month)
    .sort();
  return months.length ? months[months.length - 1] : "";
}

// Map<username, articles> for one month. If a member has reports on more than
// one wiki, their best wiki counts.
export function articlesForMonth(reports, month) {
  const out = new Map();
  for (const r of reports || []) {
    if (r.month !== month) continue;
    for (const row of r.rows || []) {
      const u = normalizeUsername(row.username);
      if (!u) continue;
      out.set(u, Math.max(out.get(u) || 0, Number(row.articles) || 0));
    }
  }
  return out;
}

// Summary for the Metrics page: active contributors in one month (any wiki).
export function activeSummary(reports, month) {
  const active = new Set();
  const checked = new Set();
  let threshold = null;
  for (const r of reports || []) {
    if (r.month !== month) continue;
    if (threshold === null) threshold = r.threshold;
    for (const row of r.rows || []) {
      const u = normalizeUsername(row.username);
      if (!u) continue;
      checked.add(u);
      if (row.active) active.add(u);
    }
  }
  return { month, active: active.size, checked: checked.size, threshold };
}

// Different people who were active in at least one finished month.
export function activeAtLeastOnce(reports) {
  const people = new Set();
  const months = new Set();
  for (const r of reports || []) {
    if (r.partial) continue;
    months.add(r.month);
    for (const row of r.rows || []) {
      if (row.active) people.add(normalizeUsername(row.username));
    }
  }
  people.delete("");
  return { people: people.size, months: months.size };
}

/**
 * Plan who should join an event.
 *  registrations: [{ id, name, wikimediaUsername, registeredAt, ... }]
 *  members:       community members [{ wikimediaUsername }]
 *  reports:       saved contributor reports
 *  seats:         number of places (0/blank → everyone fits)
 *  newPct:        % of seats kept for new members
 *  eventMonth:    "YYYY-MM" of the event, so ranking uses the month before it
 *
 * Existing members are ranked by different articles in the ranking month
 * (ties → who registered first). New members are taken in registration order.
 * Seats one group can't fill go to the other group.
 */
export function planEventSeats({ registrations, members, reports, seats, newPct = DEFAULT_NEW_MEMBER_PCT, eventMonth = "" }) {
  const memberSet = new Set((members || []).map(m => normalizeUsername(m.wikimediaUsername)).filter(Boolean));
  const month = rankingMonth(reports, eventMonth);
  const articles = month ? articlesForMonth(reports, month) : new Map();

  // One entry per person: same username registered twice → keep the earliest.
  const byTime = [...(registrations || [])].sort((a, b) => String(a.registeredAt || "").localeCompare(String(b.registeredAt || "")));
  const seen = new Set();
  const people = [];
  for (const reg of byTime) {
    const username = normalizeUsername(reg.wikimediaUsername);
    if (username) {
      if (seen.has(username)) continue;
      seen.add(username);
    }
    const isMember = !!username && memberSet.has(username);
    people.push({ reg, username, isMember, articles: isMember ? (articles.get(username) || 0) : 0 });
  }

  const existing  = people.filter(p => p.isMember).sort((a, b) => b.articles - a.articles);   // stable: ties keep registration order
  const newcomers = people.filter(p => !p.isMember);

  const total = Number(seats) > 0 ? Math.floor(Number(seats)) : people.length;
  const pct = Math.min(100, Math.max(0, Number(newPct) || 0));
  const newSeats = Math.min(total, Math.round(total * pct / 100));
  const memberSeats = total - newSeats;

  let takeMembers = Math.min(memberSeats, existing.length);
  let takeNew     = Math.min(newSeats, newcomers.length);
  let spare = total - takeMembers - takeNew;
  const extraMembers = Math.min(spare, existing.length - takeMembers);
  takeMembers += extraMembers; spare -= extraMembers;
  takeNew += Math.min(spare, newcomers.length - takeNew);

  const mark = (list, take) => list.map((p, i) => ({ ...p, rank: i + 1, status: i < take ? "recommended" : "waitlist" }));

  return {
    month,
    seats: total,
    newSeats,
    memberSeats,
    existing:  mark(existing, takeMembers),
    newcomers: mark(newcomers, takeNew),
    recommended: takeMembers + takeNew,
  };
}
