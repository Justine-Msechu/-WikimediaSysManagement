import {
  addDocument, updateDocument, deleteDocument, setDocument,
  listenCollection, batchWrite, orderBy, srvTs,
} from "../firebase/firestore";

// ── Community members ──────────────────────────────────────────────────────────
// { name, wikimediaUsername, isActive, source: "manual" | "bulk" | "volunteers" }

const MEMBERS = "communityMembers";
const REPORTS = "contributorReports";

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
// Doc id "{wiki}_{YYYY-MM}" — saving the same wiki + month again overwrites it.
// { wiki, month, threshold, memberCount, activeCount, partial, rows[], generatedBy, generatedAt }

export function reportId(wiki, month) {
  return `${wiki}_${month}`;
}

export async function saveContributorReport(report) {
  return setDocument(REPORTS, reportId(report.wiki, report.month), report);
}

export function listenContributorReports(callback) {
  return listenCollection(REPORTS, callback, orderBy("month", "asc"));
}
