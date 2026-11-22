// ── Grant scoping — what belongs to which grant ───────────────────────────────
// Pure JS (no React / Firebase). Every grant-data page should show only the
// selected grant's records, so a new grant starts empty.

// The grant created first (grants are listed newest first). Data saved before
// grants existed (e.g. old final report answers) belongs to it.
export function oldestGrantId(grants) {
  const ms = (g) => {
    const c = g.createdAt;
    if (!c) return Infinity;
    if (typeof c.toMillis === "function") return c.toMillis();
    if (typeof c.seconds === "number") return c.seconds * 1000;
    const t = Date.parse(c);
    return Number.isNaN(t) ? Infinity : t;
  };
  const sorted = [...(grants || [])].sort((a, b) => ms(a) - ms(b));
  return sorted[0]?.id || "";
}

// Participants of a grant: tagged with the grant, or linked to one of its programs.
export function participantsForGrant(participants, programs, grantId) {
  if (!grantId) return participants || [];
  const ids = new Set((programs || []).filter(p => p.grantId === grantId).map(p => p.id));
  return (participants || []).filter(p => p.grantId === grantId || (p.programId && ids.has(p.programId)));
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
