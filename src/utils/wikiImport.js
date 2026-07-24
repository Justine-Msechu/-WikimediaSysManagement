/**
 * Utilities for importing participant data from:
 * 1. Wikipedia Campaign Events REST API (accurate — requires EventDetails URL)
 * 2. Wikipedia Event page wikitext (fallback — may include organizers)
 * 3. Outreach Dashboard CSV exports
 */

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * Detect an EventDetails URL and extract the event registration ID.
 * Supports any language prefix (Maalum, Special, Especial, Speciale …).
 *
 * Example: https://sw.wikipedia.org/wiki/Maalum:EventDetails/2936 → { eventId: "2936", origin: "https://sw.wikipedia.org" }
 */
function parseEventDetailsId(url) {
  const m = url.match(/(?:Special|Maalum|Speciale|Speciaal|Especial|Spesial|Especial|特別):EventDetails\/(\d+)/i);
  if (!m) return null;
  try {
    return { eventId: m[1], origin: new URL(url).origin };
  } catch {
    return null;
  }
}

/**
 * Parse a Wikipedia Event page URL into { apiBase, pageTitle, origin }.
 * Works for both Event:Title and Maalum:EventDetails/ID URLs.
 */
export function parseWikiEventUrl(url) {
  try {
    const u = new URL(url);
    const apiBase = `${u.origin}/w/api.php`;
    let title = "";
    if (u.pathname.startsWith("/wiki/")) {
      title = decodeURIComponent(u.pathname.replace("/wiki/", "")).replace(/_/g, " ");
    } else if (u.searchParams.get("title")) {
      title = decodeURIComponent(u.searchParams.get("title")).replace(/_/g, " ");
    }
    if (!title) throw new Error("Cannot extract page title from URL.");
    return { apiBase, title, origin: u.origin };
  } catch (e) {
    throw new Error("Invalid Wikipedia URL: " + e.message);
  }
}

// ── Campaign Events REST API ──────────────────────────────────────────────────

/**
 * Fetch actual registered participants via the Campaign Events REST API.
 * Handles pagination automatically (limit=500 per request).
 * Returns array of { username, displayName, source, registeredAt } or null on failure.
 */
async function fetchCampaignEventParticipants(origin, eventId) {
  const results = [];
  let lastId = null;

  for (;;) {
    let url = `${origin}/w/rest.php/campaignevents/v0/event_registration/${eventId}/participants?include_private=false&limit=500`;
    if (lastId) url += `&last_participant_id=${lastId}`;

    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // MediaWiki blocks anonymous cross-origin requests to the Campaign Events REST API.
      // This cannot be worked around client-side — a backend proxy would be required.
      if (body.error === "rest-cross-origin-anon-write" || res.status === 403) {
        throw new Error(
          "CROSS_ORIGIN_BLOCKED: Wikipedia's Campaign Events API does not allow direct browser access. " +
          "Use the Outreach Dashboard CSV export instead: go to your OD program → Editors table → Download CSV."
        );
      }
      if (results.length === 0) return null;
      break;
    }

    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;

    page.forEach(p => {
      results.push({
        username:     p.user_name,
        displayName:  p.user_name,
        source:       "campaign-events-api",
        registeredAt: p.user_registered_at_formatted || "",
      });
    });

    if (page.length < 500) break;
    lastId = page[page.length - 1].participant_id;
  }

  return results.length > 0 ? results : null;
}

// ── Wikitext fallback ─────────────────────────────────────────────────────────

/**
 * Fetch user links from an Event page's wikitext and namespace-2 links.
 * NOTE: This catches users who *edited* the page (often organizers) rather
 * than registered participants. Use the Campaign Events API when possible.
 */
async function fetchWikitextParticipants(apiBase, title) {
  const base = `${apiBase}?format=json&origin=*`;
  const [textRes, linksRes] = await Promise.all([
    fetch(`${base}&action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}`),
    fetch(`${base}&action=query&prop=links&plnamespace=2&pllimit=500&titles=${encodeURIComponent(title)}`),
  ]);

  if (!textRes.ok || !linksRes.ok) throw new Error("Wikipedia API request failed.");

  const [textData, linksData] = await Promise.all([textRes.json(), linksRes.json()]);
  const participants = new Map();

  // Parse [[User:...]] / [[Mtumiaji:...]] from wikitext
  const pages = Object.values(textData?.query?.pages || {});
  if (pages.length > 0) {
    const wikitext = pages[0].revisions?.[0]?.slots?.main?.["*"]
      || pages[0].revisions?.[0]?.["*"]
      || "";
    const userLinkRe = /\[\[(?:User|Mtumiaji|Utilisateur|Benutzer|Usuario|Utumiaji):([^\]|#]+)(?:\|([^\]]+))?\]\]/gi;
    let match;
    while ((match = userLinkRe.exec(wikitext)) !== null) {
      const raw     = match[1].trim();
      const display = (match[2] || raw).trim();
      const key     = raw.toLowerCase();
      if (!participants.has(key)) {
        participants.set(key, { username: raw, displayName: display, source: "wikitext" });
      }
    }
  }

  // API namespace-2 links
  const linkPages = Object.values(linksData?.query?.pages || {});
  (linkPages[0]?.links || []).forEach(link => {
    const colonIdx = link.title.indexOf(":");
    if (colonIdx < 0) return;
    const raw = link.title.slice(colonIdx + 1).trim();
    const key = raw.toLowerCase();
    if (!participants.has(key)) {
      participants.set(key, { username: raw, displayName: raw, source: "wikitext" });
    } else {
      participants.get(key).source = "wikitext";
    }
  });

  return Array.from(participants.values());
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch participants from a Wikipedia Event or EventDetails URL.
 *
 * Strategy (in order):
 * 1. If the URL contains an EventDetails ID → use Campaign Events REST API
 *    → returns only actual registered participants, no organizers
 * 2. Otherwise → fall back to wikitext parsing
 *    → catches users who edited the page (may include organizers)
 *    → `wikitextFallback: true` is set on the result so the UI can warn the user
 *
 * Returns { pageTitle, participants[], wikitextFallback, eventId? }
 */
export async function fetchEventParticipants(eventUrl) {
  // ── Path 1: EventDetails URL → Campaign Events REST API ──────────────────
  const details = parseEventDetailsId(eventUrl);
  if (details) {
    const { eventId, origin } = details;
    const apiParticipants = await fetchCampaignEventParticipants(origin, eventId);
    if (apiParticipants) {
      return {
        pageTitle:        `Event registration #${eventId}`,
        participants:     apiParticipants,
        wikitextFallback: false,
        eventId,
      };
    }
    // REST API failed — fall through to wikitext
  }

  // ── Path 2: Event:Title URL → wikitext fallback ───────────────────────────
  const { apiBase, title } = parseWikiEventUrl(eventUrl);
  const participants = await fetchWikitextParticipants(apiBase, title);
  return {
    pageTitle:        title,
    participants,
    wikitextFallback: true,
    eventId:          null,
  };
}

// ── Content metrics (articles created/edited, bytes added) ────────────────────

const METRICS_BATCH = 50; // safe batch size for unprivileged (non-bot) API access

/**
 * Fetch aggregate content metrics for a list of Wikipedia usernames within
 * [dateFrom, dateTo] (YYYY-MM-DD, inclusive), on the given wiki origin.
 *
 * Uses the public MediaWiki API — list=usercontribs for edits (read-only,
 * CORS-enabled via origin=*, no auth needed, unlike the Campaign Events REST
 * API) and list=users for registration dates, to flag brand-new accounts.
 * Batched 50 usernames per call, with pagination via uccontinue.
 *
 * Returns { perUser: { [username]: { created, edited, bytesAdded, isNewAccount } },
 *           totals: { created, edited, bytesAdded, newAccounts } }
 */
export async function fetchParticipantMetrics(origin, usernames, dateFrom, dateTo) {
  const apiBase = `${origin}/w/api.php`;
  const ucstart = `${dateTo}T23:59:59Z`;   // newer boundary — usercontribs walks backward from here
  const ucend   = `${dateFrom}T00:00:00Z`; // older boundary

  const perUser = {};
  usernames.forEach(u => {
    perUser[u] = { created: 0, edited: 0, bytesAdded: 0, isNewAccount: false, _createdTitles: new Set(), _editedTitles: new Set() };
  });

  // ── contributions, batched + paginated ────────────────────────────────────
  for (let i = 0; i < usernames.length; i += METRICS_BATCH) {
    const batch = usernames.slice(i, i + METRICS_BATCH);
    let uccontinue = null;
    for (;;) {
      const params = new URLSearchParams({
        action: "query", list: "usercontribs",
        ucuser: batch.join("|"),
        ucnamespace: "0", // articles only
        ucstart, ucend, ucdir: "older",
        uclimit: "500",
        ucprop: "title|timestamp|flags|sizediff",
        format: "json", origin: "*",
      });
      if (uccontinue) params.set("uccontinue", uccontinue);
      const res = await fetch(`${apiBase}?${params.toString()}`);
      if (!res.ok) break;
      const data = await res.json();
      (data?.query?.usercontribs || []).forEach(item => {
        const bucket = perUser[item.user];
        if (!bucket) return;
        if ("new" in item) bucket._createdTitles.add(item.title);
        else bucket._editedTitles.add(item.title);
        if (typeof item.sizediff === "number" && item.sizediff > 0) bucket.bytesAdded += item.sizediff;
      });
      uccontinue = data?.continue?.uccontinue || null;
      if (!uccontinue) break;
    }
  }

  // Distinct-article counts — an article edited further by the same user
  // after they created it counts once, as "created".
  Object.values(perUser).forEach(b => {
    b.created = b._createdTitles.size;
    b.edited  = [...b._editedTitles].filter(t => !b._createdTitles.has(t)).length;
    delete b._createdTitles;
    delete b._editedTitles;
  });

  // ── registration dates, to flag accounts that are new around this event ───
  const THIRTY_DAYS_MS = 30 * 86400000;
  const evtMs = new Date(`${dateTo}T00:00:00Z`).getTime();
  for (let i = 0; i < usernames.length; i += METRICS_BATCH) {
    const batch = usernames.slice(i, i + METRICS_BATCH);
    const params = new URLSearchParams({
      action: "query", list: "users",
      ususers: batch.join("|"),
      usprop: "registration",
      format: "json", origin: "*",
    });
    const res = await fetch(`${apiBase}?${params.toString()}`);
    if (!res.ok) continue;
    const data = await res.json();
    (data?.query?.users || []).forEach(u => {
      const bucket = perUser[u.name];
      if (!bucket || !u.registration) return;
      const regMs = new Date(u.registration).getTime();
      bucket.isNewAccount = regMs <= evtMs && (evtMs - regMs) <= THIRTY_DAYS_MS;
    });
  }

  const totals = Object.values(perUser).reduce((acc, b) => ({
    created:     acc.created + b.created,
    edited:      acc.edited + b.edited,
    bytesAdded:  acc.bytesAdded + b.bytesAdded,
    newAccounts: acc.newAccounts + (b.isNewAccount ? 1 : 0),
  }), { created: 0, edited: 0, bytesAdded: 0, newAccounts: 0 });

  return { perUser, totals };
}

// ── Outreach Dashboard CSV ────────────────────────────────────────────────────

/**
 * Parse an Outreach Dashboard CSV export.
 * Returns array of { username, realName, articlesCreated, articlesEdited, filesUploaded, … }
 */
export function parseODCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV has no data rows.");

  const delim = lines[0].includes("\t") ? "\t" : ",";

  const parseRow = (line) => {
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === delim && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());
  const idx = (names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iUsername  = idx(["username"]);
  const iRealName  = idx(["real name", "name"]);
  const iCreated   = idx(["created articles", "articles created"]);
  const iEdited    = idx(["edited articles", "articles edited"]);
  const iFiles     = idx(["uploaded files", "files uploaded", "uploads"]);
  const iRefs      = idx(["references added"]);
  const iBytes     = idx(["bytes added"]);
  const iEdits     = idx(["total edits", "edits"]);

  if (iUsername < 0) throw new Error("Could not find 'Username' column in CSV. Are you sure this is an Outreach Dashboard export?");

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (!row[iUsername]) continue;
    results.push({
      username:        row[iUsername] || "",
      realName:        iRealName >= 0 ? row[iRealName]  : "",
      articlesCreated: iCreated  >= 0 ? Number(row[iCreated])  || 0 : 0,
      articlesEdited:  iEdited   >= 0 ? Number(row[iEdited])   || 0 : 0,
      filesUploaded:   iFiles    >= 0 ? Number(row[iFiles])    || 0 : 0,
      refsAdded:       iRefs     >= 0 ? Number(row[iRefs])     || 0 : 0,
      bytesAdded:      iBytes    >= 0 ? Number(row[iBytes])    || 0 : 0,
      totalEdits:      iEdits    >= 0 ? Number(row[iEdits])    || 0 : 0,
    });
  }

  if (results.length === 0) throw new Error("No participant rows found in CSV.");
  return results;
}
