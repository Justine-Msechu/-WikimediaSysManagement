/**
 * Utilities for importing participant data from:
 * 1. Wikipedia Event Platform pages (via MediaWiki API, CORS-safe)
 * 2. Outreach Dashboard CSV exports
 */

/**
 * Parse a Wikipedia event page URL into { apiBase, pageTitle }.
 * Handles both:
 *   https://sw.wikipedia.org/wiki/Event:Foo_Bar
 *   https://en.wikipedia.org/w/index.php?title=Event:Foo_Bar
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

/**
 * Fetch participants from a Wikipedia Event page.
 *
 * Strategy:
 * 1. Fetch raw wikitext and parse [[User:...]] / [[Mtumiaji:...]] patterns
 *    — catches participants who sign up by editing the page (most common)
 * 2. Also fetch namespace-2 links via API (authoritative)
 * 3. Merge both lists, deduplicate by username
 *
 * Limitation: Participants who clicked the WEP "Register" button but did NOT
 * edit the page are stored in the MediaWiki database and require auth to read.
 * We cannot access those without a logged-in session.
 */
export async function fetchEventParticipants(eventUrl) {
  const { apiBase, title } = parseWikiEventUrl(eventUrl);

  const base = `${apiBase}?format=json&origin=*`;

  // Fetch both in parallel: raw wikitext + ns-2 links
  const [textRes, linksRes] = await Promise.all([
    fetch(`${base}&action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}`),
    fetch(`${base}&action=query&prop=links&plnamespace=2&pllimit=500&titles=${encodeURIComponent(title)}`),
  ]);

  if (!textRes.ok || !linksRes.ok) throw new Error("Wikipedia API request failed.");

  const [textData, linksData] = await Promise.all([textRes.json(), linksRes.json()]);

  const participants = new Map(); // username (lowercased) → { username, displayName, source }

  // ── 1. Parse wikitext for [[User:...]] / [[Mtumiaji:...]] patterns ──
  const pages = Object.values(textData?.query?.pages || {});
  if (pages.length > 0) {
    const page = pages[0];
    const wikitext = page.revisions?.[0]?.slots?.main?.["*"]
      || page.revisions?.[0]?.["*"]
      || "";

    // Match [[Namespace:Username|Display]] or [[Namespace:Username]]
    // Swahili: Mtumiaji, English: User, French: Utilisateur, etc.
    const userLinkRe = /\[\[(?:User|Mtumiaji|Utilisateur|Benutzer|Usuario|Utumiaji):([^\]|#]+)(?:\|([^\]]+))?\]\]/gi;
    let match;
    while ((match = userLinkRe.exec(wikitext)) !== null) {
      const raw  = match[1].trim();
      const display = (match[2] || raw).trim();
      const key  = raw.toLowerCase();
      if (!participants.has(key)) {
        participants.set(key, { username: raw, displayName: display, source: "wikitext" });
      }
    }
  }

  // ── 2. API namespace-2 links (more authoritative) ──
  const linkPages = Object.values(linksData?.query?.pages || {});
  (linkPages[0]?.links || []).forEach(link => {
    // title is e.g. "Mtumiaji:Justine Msechu" — strip the namespace prefix
    const colonIdx = link.title.indexOf(":");
    if (colonIdx < 0) return;
    const raw = link.title.slice(colonIdx + 1).trim();
    const key = raw.toLowerCase();
    if (!participants.has(key)) {
      participants.set(key, { username: raw, displayName: raw, source: "api-links" });
    } else {
      // Upgrade source
      participants.get(key).source = "api-links";
    }
  });

  return {
    pageTitle: title,
    participants: Array.from(participants.values()),
  };
}

/**
 * Parse an Outreach Dashboard CSV export.
 *
 * OD exports participant CSVs with columns:
 * Username, Real Name, Assigned Articles, Created Articles, Edited Articles,
 * Main Namespace Bytes Added, References Added, Uploaded Files
 *
 * Returns array of { username, realName, articlesCreated, articlesEdited, filesUploaded }
 */
export function parseODCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV has no data rows.");

  // Detect delimiter (comma or tab)
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

  const iUsername     = idx(["username"]);
  const iRealName     = idx(["real name", "name"]);
  const iCreated      = idx(["created articles", "articles created"]);
  const iEdited       = idx(["edited articles", "articles edited"]);
  const iFiles        = idx(["uploaded files", "files uploaded", "uploads"]);
  const iRefsAdded    = idx(["references added"]);
  const iBytesAdded   = idx(["bytes added"]);
  const iEdits        = idx(["total edits", "edits"]);

  if (iUsername < 0) throw new Error("Could not find 'Username' column in CSV. Are you sure this is an Outreach Dashboard export?");

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (!row[iUsername]) continue;
    results.push({
      username:        row[iUsername] || "",
      realName:        iRealName   >= 0 ? row[iRealName]   : "",
      articlesCreated: iCreated    >= 0 ? Number(row[iCreated])    || 0 : 0,
      articlesEdited:  iEdited     >= 0 ? Number(row[iEdited])     || 0 : 0,
      filesUploaded:   iFiles      >= 0 ? Number(row[iFiles])      || 0 : 0,
      refsAdded:       iRefsAdded  >= 0 ? Number(row[iRefsAdded])  || 0 : 0,
      bytesAdded:      iBytesAdded >= 0 ? Number(row[iBytesAdded]) || 0 : 0,
      totalEdits:      iEdits      >= 0 ? Number(row[iEdits])      || 0 : 0,
    });
  }

  if (results.length === 0) throw new Error("No participant rows found in CSV.");
  return results;
}
