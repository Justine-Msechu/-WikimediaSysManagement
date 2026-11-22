import {
  addDocument, updateDocument, deleteDocument, setDocument,
  listenCollection, batchWrite, orderBy, srvTs,
} from "../firebase/firestore";

// ── Community members ──────────────────────────────────────────────────────────
// { name, wikimediaUsername, isActive, source: "manual" | "bulk" | "volunteers" }

const MEMBERS = "communityMembers";
const REPORTS = "contributorReports";
const EVENTS  = "contributorEvents";

export function listenCommunityMembers(callback) {
  return listenCollection(MEMBERS, callback, orderBy("name", "asc"));
}

export async function addCommunityMember(data) {
  return addDocument(MEMBERS, data);
}

export async function updateCommunityMember(id, data) {
  return updateDocument(MEMBERS, id, data);
}

export async function deleteCommunityMember(id) {
  return deleteDocument(MEMBERS, id);
}

// Firestore batches allow 500 writes — stay safely below that.
export async function addCommunityMembersBulk(members) {
  for (let i = 0; i < members.length; i += 450) {
    const ops = members.slice(i, i + 450).map(m => ({
      type: "set", path: MEMBERS, data: { ...m, createdAt: srvTs() },
    }));
    await batchWrite(ops);
  }
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
