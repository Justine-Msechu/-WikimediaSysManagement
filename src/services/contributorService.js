import {
  addDocument, updateDocument, deleteDocument, setDocument,
  listenCollection, batchWrite, orderBy, srvTs,
} from "../firebase/firestore";
import { normalizeUsername } from "../utils/wikiContribs";
import { belongsToGrant, grantIdsWith } from "../utils/grantScope";

// ── Community members ──────────────────────────────────────────────────────────
// { name, wikimediaUsername, isActive, source: "manual" | "bulk" | "volunteers" }

const MEMBERS = "communityMembers";
const REPORTS = "contributorReports";
const EVENTS  = "contributorEvents";

export function listenCommunityMembers(callback) {
  return listenCollection(MEMBERS, callback, orderBy("name", "asc"));
}

export async function addCommunityMember(data, grantId = "") {
  return addDocument(MEMBERS, { ...data, grantIds: grantId ? [grantId] : [] });
}

export async function updateCommunityMember(id, data) {
  return updateDocument(MEMBERS, id, data);
}

export async function deleteCommunityMember(id) {
  return deleteDocument(MEMBERS, id);
}

// Add members to a grant. Someone already in the list (from an earlier grant)
// gets this grant added to their record instead of a duplicate.
//   existing: all community members; grantId / firstGrantId: see utils/grantScope.
// Firestore batches allow 500 writes — stay safely below that.
export async function addCommunityMembersBulk(members, { grantId = "", firstGrantId = "", existing = [] } = {}) {
  const byUser = new Map(existing.map(m => [normalizeUsername(m.wikimediaUsername), m]));
  const seen = new Set();
  const ops = [];
  for (const m of members) {
    const u = normalizeUsername(m.wikimediaUsername);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    const old = byUser.get(u);
    if (old) {
      if (grantId && !belongsToGrant(old, grantId, { firstGrantId })) {
        ops.push({ type: "update", path: MEMBERS, id: old.id, data: { grantIds: grantIdsWith(old, grantId, firstGrantId) } });
      }
    } else {
      ops.push({ type: "set", path: MEMBERS, data: { ...m, wikimediaUsername: u, grantIds: grantId ? [grantId] : [], createdAt: srvTs() } });
    }
  }
  for (let i = 0; i < ops.length; i += 450) await batchWrite(ops.slice(i, i + 450));
  return ops.length;
}

// ── Saved monthly reports ──────────────────────────────────────────────────────
// Doc id "{wiki}_{YYYY-MM}" (whole wiki) or "{wiki}_{YYYY-MM}_events"
// (Kilimanjaro events only) — saving the same wiki + month + scope overwrites it.
// { wiki, month, scope, threshold, memberCount, activeCount, partial, rows[], events[], generatedBy, generatedAt }

export function reportId(wiki, month, scope = "all") {
  return scope === "events" ? `${wiki}_${month}_events` : `${wiki}_${month}`;
}

export async function saveContributorReport(report) {
  return setDocument(REPORTS, reportId(report.wiki, report.month, report.scope), report);
}

export function listenContributorReports(callback) {
  return listenCollection(REPORTS, callback, orderBy("month", "asc"));
}

// ── Kilimanjaro events (Outreach Dashboard courses) ─────────────────────────────
// Doc id = eventDocId(slug). { slug, title, start, end, wikiEventId, participants[], refreshedAt }

export function listenContributorEvents(callback) {
  return listenCollection(EVENTS, callback, orderBy("start", "asc"));
}

export async function saveContributorEvent(id, data) {
  return setDocument(EVENTS, id, data);
}

export async function deleteContributorEvent(id) {
  return deleteDocument(EVENTS, id);
}
