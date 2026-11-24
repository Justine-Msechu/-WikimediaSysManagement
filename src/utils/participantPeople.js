// ── Participants → people ─────────────────────────────────────────────────────
// Pure JS. The registry has one record per sign-up, so one person who joins three
// events has three records — sometimes typed differently ("amina juma",
// "AMINA JUMA", "User:Amina_Juma"). Records are grouped into one person by their
// Wikipedia username (ignoring capitals, spaces/underscores and a "User:"
// prefix), else by email, else by name. A person in 2+ events is a returning editor.

import { normalizeUsername } from "./wikiContribs";
import { tidyName } from "./names";

const lower = (s) => String(s || "").trim().toLowerCase();

// Same person → same key.
export function personKey(p) {
  const u = normalizeUsername(p?.wikimediaUsername);
  if (u) return `u:${u.toLowerCase()}`;
  const e = lower(p?.email);
  if (e) return `e:${e}`;
  const n = tidyName(p?.name).toLowerCase();
  return n ? `n:${n}` : `id:${p?.id || ""}`;
}

// Where a record came from — one event / program.
const eventOf = (p) => p.formId || p.registeredViaForm || p.programId || `record:${p.id}`;

function mostCommon(values) {
  const count = new Map();
  values.filter(Boolean).forEach(v => count.set(v, (count.get(v) || 0) + 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] || "";
}

// The neatest name among the spellings: prefer a full name (with a space),
// then the most common one, tidied ("AMINA JUMA" → "Amina Juma").
export function bestName(names) {
  const tidied = (names || []).map(tidyName).filter(Boolean);
  const full = tidied.filter(n => /\s/.test(n));
  return mostCommon(full.length ? full : tidied);
}

/**
 * participants: registry records (already this grant's)
 * Returns people, most events first:
 *   { key, name, username, records, events (different events/programs),
 *     returning (2+ events), isNew (new at their first record),
 *     nameVariants, usernameVariants, needsFix (spellings differ),
 *     sameEventDuplicates: [[record, …], …] (same event entered twice) }
 */
export function groupPeople(participants) {
  const groups = new Map();
  for (const p of participants || []) {
    const k = personKey(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const time = (p) => {
    const c = p.createdAt;
    if (c && typeof c.seconds === "number") return c.seconds;
    if (c && typeof c.toMillis === "function") return c.toMillis() / 1000;
    const t = Date.parse(c || p.registeredAt || "");
    return Number.isNaN(t) ? Infinity : t / 1000;
  };
  const people = [];
  for (const [key, records] of groups) {
    const sorted = [...records].sort((a, b) => time(a) - time(b));
    const nameVariants = [...new Set(records.map(r => String(r.name || "").trim()).filter(Boolean))];
    const usernameVariants = [...new Set(records.map(r => String(r.wikimediaUsername || "").trim()).filter(Boolean))];
    const byEvent = new Map();
    records.forEach(r => {
      const ev = eventOf(r);
      if (!byEvent.has(ev)) byEvent.set(ev, []);
      byEvent.get(ev).push(r);
    });
    const username = normalizeUsername(mostCommon(usernameVariants.map(normalizeUsername)));
    const name = bestName(nameVariants) || username;
    people.push({
      key, name, username,
      records: sorted,
      events: byEvent.size,
      returning: byEvent.size >= 2,
      isNew: !!sorted[0]?.isNew,
      nameVariants, usernameVariants,
      needsFix: records.some(r => String(r.name || "").trim() !== name)
        || (!!username && records.some(r => r.wikimediaUsername && String(r.wikimediaUsername).trim() !== username)),
      sameEventDuplicates: [...byEvent.values()].filter(list => list.length > 1),
    });
  }
  return people.sort((a, b) => b.events - a.events || a.name.localeCompare(b.name));
}

// Counts for Metrics: editors are people, not sign-ups.
export function peopleCounts(participants) {
  const people = groupPeople(participants);
  const editors = people.filter(p => p.username);
  return {
    records:   (participants || []).length,
    people:    people.length,
    editors:   editors.length,
    newEditors: editors.filter(p => p.isNew).length,
    returning: people.filter(p => p.returning).length,
    retained:  editors.filter(p => !p.isNew || p.returning).length,   // edited before, or came back
  };
}
