// ── Active contributors — Wikipedia contribution counting ─────────────────────
// Pure JS (no React / Firebase) so it can be unit-tested with a fake fetch.
//
// Rule: a community member is ACTIVE in a month if they edited at least
// `threshold` DIFFERENT articles (main namespace, ns=0) on the chosen wiki
// during that calendar month, in UTC. Several edits to one article count once.

export const WIKIS = [
  { id: "sw.wikipedia.org", label: "Swahili Wikipedia" },
  { id: "en.wikipedia.org", label: "English Wikipedia" },
];
export const DEFAULT_WIKI = WIKIS[0].id;
export const DEFAULT_THRESHOLD = 60;
// "Still editing" = edited at least this many different articles in the month.
// Used for retained members; independent of the (much higher) active threshold.
export const STILL_EDITING_MIN = 1;

// What a report counts:
//   "all"    — every article edit on the wiki that month (whole Swahili Wikipedia)
//   "events" — only edits made during Kilimanjaro events, by people enrolled in them
export const SCOPES = [
  { id: "all",    label: "Whole wiki",               long: "All edits on the wiki" },
  { id: "events", label: "Kilimanjaro events only",  long: "Only edits made in Kilimanjaro events" },
];
export const DEFAULT_SCOPE = "all";
// Reports saved before scopes existed count everything.
export function reportScope(report) {
  return report?.scope === "events" ? "events" : "all";
}
export const scopeLabel = (id) => SCOPES.find(s => s.id === id)?.label || SCOPES[0].label;

const BATCH_SIZE = 50;        // MediaWiki limit for ucuser / ususers (anonymous)
const PAUSE_MS   = 150;       // be polite to the API between requests

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Usernames ──────────────────────────────────────────────────────────────────

// "User:amina_juma " → "Amina juma" (MediaWiki canonical form)
export function normalizeUsername(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^(user|mtumiaji)\s*:\s*/i, "");
  s = s.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Months (all UTC) ─────────────────────────────────────────────────────────

function parseMonth(month) {
  const [y, m] = String(month).split("-").map(Number);
  return { y, m };   // m is 1–12
}

function formatMonth(y, m) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Add `delta` months to "YYYY-MM"
export function shiftMonth(month, delta) {
  const { y, m } = parseMonth(month);
  const idx = y * 12 + (m - 1) + delta;
  return formatMonth(Math.floor(idx / 12), (idx % 12) + 1);
}

export function monthBounds(month) {
  return {
    start: `${month}-01T00:00:00Z`,
    end:   `${shiftMonth(month, 1)}-01T00:00:00Z`,
  };
}

export function currentMonth(now = new Date()) {
  return formatMonth(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

// The last month that has fully finished (UTC)
export function lastFullMonth(now = new Date()) {
  return shiftMonth(currentMonth(now), -1);
}

// True for the current month (and any future month) — counts are "so far"
export function isPartialMonth(month, now = new Date()) {
  return month >= currentMonth(now);
}

// The n months ending with `month`, oldest first
export function previousMonths(month, n) {
  return Array.from({ length: n }, (_, i) => shiftMonth(month, i - (n - 1)));
}

// ── API calls ──────────────────────────────────────────────────────────────────

function apiUrl(wiki, params) {
  const qs = new URLSearchParams({ ...params, format: "json", formatversion: "2", origin: "*" });
  return `https://${wiki}/w/api.php?${qs.toString()}`;
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Wikipedia API returned HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Wikipedia API error: ${json.error.info || json.error.code}`);
  return json;
}

function uniqueNormalized(usernames) {
  return [...new Set((usernames || []).map(normalizeUsername).filter(Boolean))];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Collect each user's article edits between two UTC timestamps (start
 * inclusive, end exclusive). Returns Map<normalizedUsername, { pages: Set(pageid),
 * revs: Set(revid) }> — sets, so results from overlapping windows can be merged.
 */
export async function fetchRangeContribs(usernames, start, end, wiki = DEFAULT_WIKI, opts = {}) {
  const { fetchImpl = fetch, onProgress, delayMs = PAUSE_MS } = opts;
  const names = uniqueNormalized(usernames);
  const out = new Map();
  const entry = (u) => out.get(u) || out.set(u, { pages: new Set(), revs: new Set() }).get(u);
  names.forEach(entry);

  let checked = 0;
  let firstRequest = true;
  if (onProgress) onProgress(0, names.length);

  for (const batch of chunk(names, BATCH_SIZE)) {
    let cont = {};
    for (;;) {
      if (!firstRequest && delayMs) await sleep(delayMs);
      firstRequest = false;

      const json = await getJson(fetchImpl, apiUrl(wiki, {
        action:      "query",
        list:        "usercontribs",
        ucuser:      batch.join("|"),
        ucnamespace: "0",
        ucdir:       "newer",
        ucstart:     start,
        ucend:       end,
        ucprop:      "ids|timestamp",
        uclimit:     "max",
        ...cont,
      }));

      for (const c of json.query?.usercontribs || []) {
        if (!c.timestamp || c.timestamp >= end) continue;   // ucend is inclusive
        const e = entry(normalizeUsername(c.user));
        e.pages.add(c.pageid);
        e.revs.add(c.revid ?? `${c.pageid}@${c.timestamp}#${e.revs.size}`);
      }

      if (!json.continue) break;
      cont = { ...json.continue };   // e.g. { uccontinue, continue }
    }
    checked += batch.length;
    if (onProgress) onProgress(checked, names.length);
  }
  return out;
}

// Map<user, { pages, revs }> → Map<user, { articles, edits }>
export function contribsToStats(contribs) {
  const stats = new Map();
  for (const [user, e] of contribs) stats.set(user, { articles: e.pages.size, edits: e.revs.size });
  return stats;
}

/**
 * Count different articles and total edits per user for one UTC month.
 * Returns Map<normalizedUsername, { articles, edits }>; users with no edits → 0.
 */
export async function fetchMonthStats(usernames, month, wiki = DEFAULT_WIKI, opts = {}) {
  const { start, end } = monthBounds(month);
  return contribsToStats(await fetchRangeContribs(usernames, start, end, wiki, opts));
}

/** Check which usernames exist on the wiki. Returns { found, missing } (normalised names). */
export async function checkUsernames(usernames, wiki = DEFAULT_WIKI, opts = {}) {
  const { fetchImpl = fetch, delayMs = PAUSE_MS } = opts;
  const names = uniqueNormalized(usernames);
  const found = [];
  const missing = [];
  let first = true;

  for (const batch of chunk(names, BATCH_SIZE)) {
    if (!first && delayMs) await sleep(delayMs);
    first = false;
    const json = await getJson(fetchImpl, apiUrl(wiki, {
      action: "query", list: "users", ususers: batch.join("|"),
    }));
    for (const u of json.query?.users || []) {
      const name = normalizeUsername(u.name);
      if (u.missing || u.invalid) missing.push(name);
      else found.push(name);
    }
  }
  return { found, missing };
}

// ── Report rows & CSV ───────────────────────────────────────────────────────

export function buildReportRows(members, stats, threshold = DEFAULT_THRESHOLD) {
  const t = Number(threshold) || 0;
  return (members || [])
    .map(m => {
      const username = normalizeUsername(m.wikimediaUsername);
      const s = (stats && stats.get(username)) || { articles: 0, edits: 0 };
      return {
        memberId: m.id || "",
        name:     m.name || username,
        username,
        articles: s.articles,
        edits:    s.edits,
        active:   s.articles >= t,
        editing:  s.articles >= STILL_EDITING_MIN,
      };
    })
    .sort((a, b) => b.articles - a.articles || b.edits - a.edits || a.name.localeCompare(b.name));
}

// Best contributor(s) of a month: most different articles (ties share it).
// Nobody wins a month where no one edited.
export function bestContributors(rows) {
  const max = Math.max(0, ...(rows || []).map(r => Number(r.articles) || 0));
  return max > 0 ? rows.filter(r => (Number(r.articles) || 0) === max) : [];
}

// Works for rows saved before the `editing` field existed.
export function isEditing(row) {
  return row.editing ?? (Number(row.articles) || 0) >= STILL_EDITING_MIN;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Plain CSV text. The page adds a UTF-8 BOM when downloading so Excel reads it.
export function rowsToCsv(rows, { month, wiki, threshold } = {}) {
  const header = ["#", "Name", "Username", "Different articles", "Total edits", `Active (>= ${threshold})`, `Still editing (>= ${STILL_EDITING_MIN})`, "Month", "Wiki"];
  const lines = [header.map(csvCell).join(",")];
  (rows || []).forEach((r, i) => {
    lines.push([i + 1, r.name, r.username, r.articles, r.edits, r.active ? "Yes" : "No", isEditing(r) ? "Yes" : "No", month, wiki].map(csvCell).join(","));
  });
  return lines.join("\r\n");
}
