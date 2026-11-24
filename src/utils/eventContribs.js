// ── Kilimanjaro events only — count contributions made in our own events ──────
// Pure JS (no React / Firebase), tested with a fake fetch.
//
// Each Kilimanjaro event on Wikipedia (Special:EventDetails) tracks contributions
// through a Programs & Events (Outreach) Dashboard course. The dashboard's
// public JSON gives the event's dates and who joined it (CORS open). A member's
// edit counts for Kilimanjaro only if they JOINED that event and made the edit
// between its start and end. Edits in other groups' events (e.g. Wikimedians of
// Arusha) at other times are not counted.
//
// Joined = enrolled on the dashboard course, OR registered on one of our
// registration forms linked to the event (event.formUsernames), unless marked
// absent. Walk-ins who never join the dashboard still count.

import { normalizeUsername, monthBounds, fetchRangeContribs, contribsToStats, DEFAULT_WIKI } from "./wikiContribs";

export const OUTREACH = "https://outreachdashboard.wmflabs.org";

// "https://outreachdashboard.wmflabs.org/courses/School/Title/home" or
// "School/Title" → "School/Title". Returns "" if it isn't a course link.
export function parseCourseSlug(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  let parts;
  if (/^https?:\/\//i.test(raw)) {
    let u;
    try { u = new URL(raw); } catch { return ""; }
    if (!/outreachdashboard\.wmflabs\.org$/i.test(u.hostname)) return "";
    const p = u.pathname.split("/").filter(Boolean);
    const i = p.indexOf("courses");
    if (i < 0 || p.length < i + 3) return "";
    parts = [p[i + 1], p[i + 2]];
  } else {
    parts = raw.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length !== 2) return "";
  }
  try { parts = parts.map(decodeURIComponent); } catch { return ""; }
  return parts.every(Boolean) ? parts.join("/") : "";
}

export function courseUrl(slug) {
  return `${OUTREACH}/courses/${slug.split("/").map(encodeURIComponent).join("/")}`;
}

// Firestore ids can't contain "/".
export function eventDocId(slug) {
  return slug.replace(/[/.#$[\]]/g, "_");
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(res.status === 404 ? "event not found on the Outreach Dashboard" : `Outreach Dashboard returned HTTP ${res.status}`);
  return res.json();
}

const isoSeconds = (s) => (s ? new Date(s).toISOString().replace(/\.\d{3}Z$/, "Z") : "");

// Usernames of everyone who joined the event (participants and organisers).
export async function fetchCourseUsers(slug, { fetchImpl = fetch } = {}) {
  const json = await getJson(fetchImpl, `${courseUrl(slug)}/users.json`);
  return [...new Set((json.course?.users || []).map(u => normalizeUsername(u.username)).filter(Boolean))];
}

/** Event details from the dashboard: { slug, title, start, end, wikiEventId, participants[] } */
export async function fetchCourse(slug, { fetchImpl = fetch } = {}) {
  const json = await getJson(fetchImpl, `${courseUrl(slug)}/course.json`);
  const c = json.course || {};
  if (!c.start || !c.end) throw new Error("the event has no start and end dates on the Outreach Dashboard");
  const participants = await fetchCourseUsers(slug, { fetchImpl });
  return {
    slug,
    title:       c.title || slug.split("/")[1].replace(/_/g, " "),
    start:       isoSeconds(c.start),
    end:         isoSeconds(c.end),
    wikiEventId: c.flags?.event_sync ? String(c.flags.event_sync) : "",
    participants,
  };
}

// Usernames from an event's registrations: with a username, not marked absent.
export function formJoiners(registrations) {
  return [...new Set((registrations || [])
    .filter(r => r.attendance !== "absent")
    .map(r => normalizeUsername(r.wikimediaUsername))
    .filter(Boolean))];
}

// Does this registration form belong to the event? Its "Wikipedia event URL"
// points at the event page or its Special:EventDetails/<id>.
export function formMatchesEvent(form, event) {
  const url = String(form?.wikiEventUrl || "").trim();
  if (!url || !event) return false;
  const id = url.match(/EventDetails\/(\d+)/i)?.[1];
  if (id) return !!event.wikiEventId && id === String(event.wikiEventId);
  const page = parseWikiPageUrl(url);
  const norm2 = (t) => String(t || "").replace(/^[^:]+:MyLanguage\//, "").replace(/_/g, " ").trim().toLowerCase();
  return !!page && !!event.wikiPage && norm2(page.title) === norm2(event.wikiPage);
}

// The part of each event that falls in the month: [{ event, start, end }].
export function eventWindowsInMonth(events, month) {
  const { start: ms, end: me } = monthBounds(month);
  const out = [];
  for (const ev of events || []) {
    if (!ev.start || !ev.end) continue;
    const s = ev.start > ms ? ev.start : ms;
    const e = ev.end < me ? ev.end : me;
    if (s < e) out.push({ event: ev, start: s, end: e });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Count different articles / edits per member, only for edits made during
 * Kilimanjaro events in the month, by members who joined that event.
 *
 * events[].formUsernames: usernames from linked registration forms (see formJoiners).
 *
 * Returns {
 *   stats:    Map<username, { articles, edits }>  — every member (0 if in no event)
 *   formOnly: Set<username>  — members who joined only through our form, never the dashboard
 *   events:   [{ slug, title, start, end, members, viaDashboard, viaForm }]
 * }
 * Dashboard participants are fetched live, so late sign-ups still count.
 */
export async function fetchEventMonthStats(usernames, events, month, wiki = DEFAULT_WIKI, opts = {}) {
  const { fetchImpl = fetch, onProgress, delayMs } = opts;
  const members = [...new Set((usernames || []).map(normalizeUsername).filter(Boolean))];
  const memberSet = new Set(members);
  // Names typed on forms may differ in capitals from the member's username.
  const memberByKey = new Map(members.map(u => [u.toLowerCase(), u]));
  const keyOf = (u) => memberByKey.get(u.toLowerCase()) || u;
  const windows = eventWindowsInMonth(events, month);

  const blank = () => ({ pages: new Set(), revs: new Map(), created: new Map(), events: new Set() });
  const merged = new Map(members.map(u => [u, blank()]));
  const outside = new Map();   // joined our events but not in the community list
  const used = [];
  const plan = [];
  const onDashboard = new Set();
  const onForm = new Set();
  for (const w of windows) {
    const dashNames = (await fetchCourseUsers(w.event.slug, { fetchImpl })).map(normalizeUsername).filter(Boolean);
    const formNames = (w.event.formUsernames || []).map(normalizeUsername).filter(Boolean);
    // person (member spelling when they're a member) → spelling to ask Wikipedia
    // for: the dashboard's (a real account) wins over what was typed on a form.
    const fetchName = new Map();
    formNames.forEach(u => fetchName.set(keyOf(u), memberSet.has(keyOf(u)) ? keyOf(u) : u));
    dashNames.forEach(u => fetchName.set(keyOf(u), u));
    const dash = new Set(dashNames.map(keyOf));
    const form = new Set(formNames.map(keyOf));
    dash.forEach(u => onDashboard.add(u));
    form.forEach(u => onForm.add(u));
    const joined = [...fetchName.keys()];
    const mem = joined.filter(u => memberSet.has(u));
    plan.push({
      w, joined, fetchName,
      members: mem.length,
      viaDashboard: mem.filter(u => dash.has(u)).length,
      viaForm: mem.filter(u => !dash.has(u)).length,
      notMembers: joined.length - mem.length,
    });
  }
  const total = plan.reduce((s, p) => s + p.joined.length, 0);
  let done = 0;
  if (onProgress) onProgress(0, total);

  for (const { w, joined, fetchName, ...counts } of plan) {
    const title = w.event.title || w.event.slug;
    used.push({ slug: w.event.slug, title, start: w.start, end: w.end, ...counts });
    if (joined.length === 0) continue;
    const contribs = await fetchRangeContribs([...new Set(fetchName.values())], w.start, w.end, wiki, {
      fetchImpl, delayMs,
      onProgress: (d) => onProgress && onProgress(done + d, total),
    });
    for (const u of joined) {
      const target = memberSet.has(u) ? merged : outside;
      if (!target.has(u)) target.set(u, blank());
      const m = target.get(u);
      m.events.add(title);
      const e = contribs.get(fetchName.get(u));
      if (e) {
        e.pages.forEach(p => m.pages.add(p));
        e.revs.forEach((v, k) => m.revs.set(k, v));
        e.created.forEach((v, k) => m.created.set(k, v));
      }
    }
    done += joined.length;
  }
  const formOnly = new Set([...onForm].filter(u => !onDashboard.has(u)));
  const notMembers = [...outside].map(([username, e]) => ({
    username, articles: e.pages.size, edits: e.revs.size, events: [...e.events], formOnly: formOnly.has(username),
  })).sort((a, b) => b.articles - a.articles || a.username.localeCompare(b.username));
  return { stats: contribsToStats(merged), formOnly, notMembers, events: used };
}

// Everyone who joined our events (dashboard + linked forms) but isn't in the
// community list. events[].participants = dashboard usernames from the last refresh.
// Returns [{ username, events: [titles] }].
export function joinedNotMembers(events, memberUsernames, formUsernamesById = {}) {
  const memberSet = new Set((memberUsernames || []).map(u => normalizeUsername(u).toLowerCase()).filter(Boolean));
  const out = new Map();
  for (const ev of events || []) {
    const people = [...(ev.participants || []), ...(formUsernamesById[ev.id] || [])].map(normalizeUsername).filter(Boolean);
    for (const u of new Set(people)) {
      if (memberSet.has(u.toLowerCase())) continue;   // capitals ignored
      if (!out.has(u)) out.set(u, new Set());
      out.get(u).add(ev.title || ev.slug);
    }
  }
  return [...out].map(([username, evs]) => ({ username, events: [...evs] }))
    .sort((a, b) => b.events.length - a.events.length || a.username.localeCompare(b.username));
}

// ── Finding events from our activities page ────────────────────────────────────
// The activities page links to each program; each program's events are pages in
// the Event: namespace (often sub-pages, e.g. "Event:<program>/July 2026 …").
// Wikipedia doesn't let a browser read which dashboard course an event uses, so
// each event is matched to a dashboard course with the same name.

export const DEFAULT_ACTIVITIES_PAGE = "https://sw.wikipedia.org/wiki/Wikipedia:Wikimedia_Community_Kilimanjaro_2026-27_GSF_Activities";
const EVENT_NS = 1728;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// "https://sw.wikipedia.org/wiki/Some_Page" → { wiki: "sw.wikipedia.org", title: "Some Page" }
export function parseWikiPageUrl(input) {
  let u;
  try { u = new URL(String(input || "").trim()); } catch { return null; }
  if (!/\.wikipedia\.org$/i.test(u.hostname)) return null;
  let title = "";
  if (u.pathname.startsWith("/wiki/")) title = u.pathname.slice(6);
  else title = u.searchParams.get("title") || "";
  try { title = decodeURIComponent(title); } catch { return null; }
  title = title.replace(/_/g, " ").trim();
  return title ? { wiki: u.hostname, title } : null;
}

function wikiApi(wiki, params) {
  const qs = new URLSearchParams({ ...params, format: "json", formatversion: "2", origin: "*" });
  return `https://${wiki}/w/api.php?${qs.toString()}`;
}

// Wikipedia answers 429 when asked too quickly — wait and try again a few times.
async function wikiJson(fetchImpl, url, retries = 3) {
  let res = await fetchImpl(url);
  for (let i = 0; res.status === 429 && i < retries; i++) {
    const wait = Number(res.headers?.get?.("Retry-After")) || 2 * (i + 1);
    await sleep(Math.min(wait, 30) * 1000);
    res = await fetchImpl(url);
  }
  if (!res.ok) throw new Error(`Wikipedia API returned HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.info || json.error.code);
  return json;
}

const stripNs = (title) => title.replace(/^[^:/]+:(?=\S)/, "");
const lastPart = (title) => stripNs(title).split("/").pop().trim();

// Event: page titles linked from rendered HTML (incl. Special:MyLanguage/Event:… tabs).
export function eventLinksInHtml(html) {
  const out = new Set();
  for (const m of String(html || "").matchAll(/href="\/wiki\/(?:[^/"]+:MyLanguage\/)?(Event:[^"#?]+)/g)) {
    try { out.add(decodeURIComponent(m[1]).replace(/_/g, " ").trim()); } catch { /* bad link */ }
  }
  return [...out];
}

/**
 * Every event under the activities page, down to the last sub-event:
 *  - each program linked from the page, and the Event: links on its page
 *    (the navigation tabs list planned sub-events, even before they're created)
 *  - every Event: page whose title starts with the program name (any depth)
 * Worklist pages are skipped.
 * Returns [{ title, name, program, isParent, exists }].
 */
export async function discoverEventPages(pageUrl, { fetchImpl = fetch, delayMs = 150 } = {}) {
  const page = parseWikiPageUrl(pageUrl);
  if (!page) throw new Error("not a Wikipedia page link");
  const { wiki } = page;
  const pause = () => (delayMs ? sleep(delayMs) : null);

  const root = await wikiJson(fetchImpl, wikiApi(wiki, { action: "parse", page: page.title, prop: "links", redirects: "1" }));
  const linked = (root.parse?.links || []).map(l => ({ title: l.title, exists: l.exists !== false }));

  const found = new Map();   // title → { program, exists }
  const add = (title, program, exists) => {
    const prev = found.get(title);
    found.set(title, { program, exists: exists || !!prev?.exists });
  };

  for (const l of linked) {
    const base = stripNs(l.title);
    if (l.title.startsWith("Event:")) add(l.title, base, l.exists);

    // Links on the program page itself (navigation tabs)
    if (l.exists) {
      await pause();
      const prog = await wikiJson(fetchImpl, wikiApi(wiki, { action: "parse", page: l.title, prop: "text", redirects: "1" }));
      for (const t of eventLinksInHtml(prog.parse?.text)) add(t, base, false);
    }

    // Event pages that really exist under this program's name
    let cont = {};
    for (;;) {
      await pause();
      const json = await wikiJson(fetchImpl, wikiApi(wiki, {
        action: "query", list: "allpages", apnamespace: String(EVENT_NS), apprefix: base, aplimit: "max", ...cont,
      }));
      for (const p of json.query?.allpages || []) {
        const rest = stripNs(p.title);
        if (rest === base || rest.startsWith(`${base}/`)) add(p.title, base, true);
      }
      if (!json.continue) break;
      cont = { ...json.continue };
    }
  }

  // Tab links may point at pages that don't exist (yet) — check them.
  const unknown = [...found].filter(([, v]) => !v.exists).map(([t]) => t);
  for (let i = 0; i < unknown.length; i += 50) {
    await pause();
    const json = await wikiJson(fetchImpl, wikiApi(wiki, { action: "query", titles: unknown.slice(i, i + 50).join("|") }));
    for (const p of json.query?.pages || []) if (!p.missing && found.has(p.title)) found.get(p.title).exists = true;
  }

  const titles = [...found.keys()].filter(t => !/^worklist$/i.test(lastPart(t)));
  return titles.sort().map(title => ({
    title,
    name: lastPart(title),
    program: found.get(title).program,
    isParent: titles.some(o => o.startsWith(`${title}/`)),
    exists: found.get(title).exists,
  }));
}

const norm = (s) => String(s || "").toLowerCase().replace(/_/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Dashboard course whose name matches the event name exactly (ignoring case,
// spaces and punctuation). Returns its slug or "".
export async function findCourseForEvent(name, { fetchImpl = fetch } = {}) {
  const json = await getJson(fetchImpl, `${OUTREACH}/courses/search.json?search=${encodeURIComponent(name)}`);
  const want = norm(name);
  const hit = (json.courses || []).find(c => norm(String(c.slug || "").split("/").slice(1).join("/")) === want || norm(c.title) === want);
  return hit ? hit.slug : "";
}
