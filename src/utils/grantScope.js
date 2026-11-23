// ── Grant scoping — what belongs to which grant ───────────────────────────────
// Pure JS (no React / Firebase). Every grant-data page should show only the
// selected grant's records, so a new grant starts empty.

// The first grant: earliest start date (then the one created first). Data saved
// before grants existed (old members, volunteers, forms, report answers) belongs to it.
export function oldestGrantId(grants) {
  const ms = (g) => {
    const c = g.createdAt;
    if (!c) return Infinity;
    if (typeof c.toMillis === "function") return c.toMillis();
    if (typeof c.seconds === "number") return c.seconds * 1000;
    const t = Date.parse(c);
    return Number.isNaN(t) ? Infinity : t;
  };
  // A grant without a start date is placed by the day it was created.
  const key = (g) => g.startDate || (Number.isFinite(ms(g)) ? new Date(ms(g)).toISOString().slice(0, 10) : "9999");
  const sorted = [...(grants || [])].sort((a, b) => key(a).localeCompare(key(b)) || ms(a) - ms(b));
  return sorted[0]?.id || "";
}

// Participants of a grant: tagged with the grant, linked to one of its programs,
// or (self-registered, no grant or program) registered through one of its forms.
export function participantsForGrant(participants, programs, grantId, { forms = [], firstGrantId = "" } = {}) {
  if (!grantId) return participants || [];
  const ids = new Set((programs || []).filter(p => p.grantId === grantId).map(p => p.id));
  const programGrant = new Map((programs || []).filter(p => p.grantId).map(p => [p.id, p.grantId]));
  const formById = new Map((forms || []).map(f => [f.id, f]));
  return (participants || []).filter(p => {
    if (p.grantId) return p.grantId === grantId;
    if (p.programId && programGrant.has(p.programId)) return ids.has(p.programId);
    const f = formById.get(p.formId || p.registeredViaForm);
    return !!f && belongsToGrant(f, grantId, { firstGrantId, programs });
  });
}

/**
 * Budget entries whose grant tag is missing or wrong, judged by their program.
 *  missingTag: no grantId, but their program belongs to a grant → set it to that grant
 *  wrongGrant: tagged with `grantId` but their program belongs to another grant
 *  orphans:    no grantId and no program with a grant (old data from before grants)
 * Each fix is { id, grantId } — the grant the entry really belongs to.
 */
export function budgetEntryFixes(entries, programs, grantId) {
  const grantOf = new Map((programs || []).filter(p => p.grantId).map(p => [p.id, p.grantId]));
  const missingTag = [];
  const wrongGrant = [];
  const orphans = [];
  for (const e of entries || []) {
    const owner = e.programId ? grantOf.get(e.programId) : "";
    if (!e.grantId) {
      if (owner) missingTag.push({ id: e.id, grantId: owner });
      else orphans.push(e);
    } else if (grantId && e.grantId === grantId && owner && owner !== grantId) {
      wrongGrant.push({ id: e.id, grantId: owner });
    }
  }
  return { missingTag, wrongGrant, orphans };
}

// Final report answers are kept per grant (settings.reportAnswersByGrant).
// Answers saved before that (settings.reportAnswers) belong to the first grant only.
export function reportAnswersFor(settings, grantId, firstGrantId) {
  const byGrant = settings?.reportAnswersByGrant || {};
  if (grantId && byGrant[grantId]) return byGrant[grantId];
  if (!grantId || grantId === firstGrantId) return settings?.reportAnswers || {};
  return {};
}

/**
 * Does a record belong to the grant? Works for volunteers (grantIds[]),
 * forms / tasks (grantId, or the grant of their program). Records saved before
 * grants existed (no grant, no program grant) belong to the first grant.
 */
export function belongsToGrant(rec, grantId, { firstGrantId = "", programs = [] } = {}) {
  if (!grantId) return true;
  if (Array.isArray(rec?.grantIds) && rec.grantIds.length) return rec.grantIds.includes(grantId);
  if (rec?.grantId) return rec.grantId === grantId;
  if (rec?.programId) {
    const p = (programs || []).find(x => x.id === rec.programId);
    if (p?.grantId) return p.grantId === grantId;
  }
  return grantId === firstGrantId;
}

// grantIds for a volunteer joining another grant (old volunteers keep the first grant).
export function grantIdsWith(rec, grantId, firstGrantId = "") {
  const current = Array.isArray(rec?.grantIds) && rec.grantIds.length ? rec.grantIds : [firstGrantId].filter(Boolean);
  return [...new Set([...current, grantId])];
}

// "YYYY-MM" months a grant covers, or null when it has no dates yet.
export function grantMonthRange(grant) {
  const s = (grant?.startDate || "").slice(0, 7);
  const e = (grant?.endDate || "").slice(0, 7);
  return s && e && s <= e ? { start: s, end: e } : null;
}

// Members of this grant who were also in an earlier grant — returning
// volunteers, the grant's retention. Old records with no grantIds count as the first grant's.
export function isReturning(rec, grantId, firstGrantId = "") {
  if (!grantId) return false;
  const ids = Array.isArray(rec?.grantIds) && rec.grantIds.length ? rec.grantIds : [firstGrantId].filter(Boolean);
  return ids.includes(grantId) && ids.some(id => id !== grantId);
}

// A saved monthly report seen from one grant: only that grant's members' rows,
// with the counts recalculated.
export function reportForMembers(report, memberUsernames, isEditing = (r) => (Number(r.articles) || 0) >= 1) {
  const rows = (report.rows || []).filter(r => memberUsernames.has(r.username));
  return {
    ...report,
    rows,
    memberCount: rows.length,
    activeCount: rows.filter(r => r.active).length,
    stillEditingCount: rows.filter(isEditing).length,
  };
}

// Grants in order, first grant first (same rule as oldestGrantId).
export function sortGrants(grants) {
  const first = [];
  let rest = [...(grants || [])];
  while (rest.length) {
    const id = oldestGrantId(rest);
    first.push(rest.find(g => g.id === id));
    rest = rest.filter(g => g.id !== id);
  }
  return first;
}

const uname = (u) => {
  let s = String(u || "").trim().replace(/^(user|mtumiaji)\s*:\s*/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
};

/**
 * Who took part in each grant — the grant's members are the community members
 * in this set. Taking part = any of:
 *  - on the grant's participant list (participantsForGrant)
 *  - registered on one of the grant's registration forms (not marked absent)
 *  - joined one of our events inside the grant's dates (dashboard or linked form)
 * Returns Map<grantId, Set<username>>.
 */
export function grantParticipation({ grants, participants, programs, forms, registrations, events, firstGrantId = "" }) {
  const out = new Map();
  const regsByForm = new Map();
  for (const r of registrations || []) {
    if (r.attendance === "absent") continue;
    const u = uname(r.wikimediaUsername);
    if (!u) continue;
    if (!regsByForm.has(r.formId)) regsByForm.set(r.formId, new Set());
    regsByForm.get(r.formId).add(u);
  }
  for (const g of grants || []) {
    const set = new Set();
    for (const p of participantsForGrant(participants, programs, g.id, { forms, firstGrantId })) {
      const u = uname(p.wikimediaUsername);
      if (u) set.add(u);
    }
    for (const f of forms || []) {
      if (belongsToGrant(f, g.id, { firstGrantId, programs })) (regsByForm.get(f.id) || []).forEach(u => set.add(u));
    }
    const range = grantMonthRange(g);
    if (range) {
      for (const ev of events || []) {
        const s = (ev.start || "").slice(0, 7);
        const e = (ev.end || "").slice(0, 7);
        if (!s || s > range.end || e < range.start) continue;
        (ev.participants || []).forEach(u => { const n = uname(u); if (n) set.add(n); });
        for (const fid of ev.formIds || []) (regsByForm.get(fid) || []).forEach(u => set.add(u));
      }
    }
    out.set(g.id, set);
  }
  return out;
}

// People who took part in this grant AND in any grant before it — retention.
export function returningPeople(participation, grants, grantId) {
  const order = sortGrants(grants).map(g => g.id);
  const idx = order.indexOf(grantId);
  const mine = participation.get(grantId) || new Set();
  if (idx <= 0) return new Set();
  const earlier = new Set();
  order.slice(0, idx).forEach(id => (participation.get(id) || []).forEach(u => earlier.add(u)));
  return new Set([...mine].filter(u => earlier.has(u)));
}

// Everyone who took part in any grant before this one (to label newcomers vs returning).
export function earlierPeople(participation, grants, grantId) {
  const order = sortGrants(grants).map(g => g.id);
  const idx = order.indexOf(grantId);
  const earlier = new Set();
  order.slice(0, Math.max(0, idx)).forEach(id => (participation.get(id) || []).forEach(u => earlier.add(u)));
  return earlier;
}

// Women / new editors from a participant list (Dashboard, Donor report).
const WOMAN = /^(female|woman|f|mwanamke|ke|kike)$/i;
export function participantStats(list) {
  const people = list || [];
  return {
    total:       people.length,
    women:       people.filter(p => WOMAN.test(String(p.gender || "").trim())).length,
    newEditors:  people.filter(p => p.isNew).length,
    genderKnown: people.filter(p => String(p.gender || "").trim()).length,
  };
}

// "YYYY-MM" a participant was added (createdAt Timestamp / ISO), or "".
export function participantMonth(p) {
  const c = p?.createdAt;
  let d = null;
  if (c && typeof c.toDate === "function") d = c.toDate();
  else if (c && typeof c.seconds === "number") d = new Date(c.seconds * 1000);
  else if (c) d = new Date(c);
  if (d && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 7);
  return String(p?.registeredAt || p?.date || "").slice(0, 7);
}
