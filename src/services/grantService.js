import { addDocument, updateDocument, deleteDocument, listenCollection, getCollection, batchWrite, where, setDocument } from "../firebase/firestore";
import { orderBy } from "../firebase/firestore";
import { DEFAULT_METRICS } from "./metricsService";

export const GRANT_TYPES = ["General Support Fund", "Rapid Grant", "Other"];

export async function getGrants() {
  return getCollection("grants", orderBy("createdAt", "desc"));
}

export async function addGrant(data) {
  return addDocument("grants", data);
}

export async function updateGrant(id, data) {
  return updateDocument("grants", id, data);
}

export async function deleteGrant(id) {
  return deleteDocument("grants", id);
}

export async function purgeOrphanedData() {
  // Delete records with no grant assigned (grantId == "")
  const [unassignedA, unassignedP, unassignedE, unassignedR, unassignedI] = await Promise.all([
    getCollection("activities",    where("grantId", "==", "")),
    getCollection("programs",      where("grantId", "==", "")),
    getCollection("budgetEntries", where("grantId", "==", "")),
    getCollection("risks",         where("grantId", "==", "")),
    getCollection("invoices",      where("grantId", "==", "")),
  ]);

  // Participants with programId == "" (no program, no grant)
  const unassignedPart = await getCollection("participants", where("programId", "==", ""));

  const ops = [
    ...unassignedA.map(a    => ({ type: "delete", path: "activities",    id: a.id })),
    ...unassignedP.map(p    => ({ type: "delete", path: "programs",      id: p.id })),
    ...unassignedE.map(e    => ({ type: "delete", path: "budgetEntries", id: e.id })),
    ...unassignedR.map(r    => ({ type: "delete", path: "risks",         id: r.id })),
    ...unassignedI.map(i    => ({ type: "delete", path: "invoices",      id: i.id })),
    ...unassignedPart.map(p => ({ type: "delete", path: "participants",  id: p.id })),
  ];

  for (let i = 0; i < ops.length; i += 400) {
    await batchWrite(ops.slice(i, i + 400));
  }
  return { activities: unassignedA.length, programs: unassignedP.length, budgetEntries: unassignedE.length, risks: unassignedR.length, invoices: unassignedI.length, participants: unassignedPart.length };
}

export function listenGrants(callback) {
  return listenCollection("grants", callback, orderBy("createdAt", "desc"));
}

export async function getGrantCounts(grantId) {
  const [activities, programs, budgetEntries, invoices] = await Promise.all([
    getCollection("activities",   where("grantId", "==", grantId)),
    getCollection("programs",     where("grantId", "==", grantId)),
    getCollection("budgetEntries",where("grantId", "==", grantId)),
    getCollection("invoices",     where("grantId", "==", grantId)),
  ]);
  return { activities: activities.length, programs: programs.length, budgetEntries: budgetEntries.length, invoices: invoices.length };
}

export async function resetGrantData(grantId) {
  const [activities, programs, budgetEntries, risks, invoices] = await Promise.all([
    getCollection("activities",    where("grantId", "==", grantId)),
    getCollection("programs",      where("grantId", "==", grantId)),
    getCollection("budgetEntries", where("grantId", "==", grantId)),
    getCollection("risks",         where("grantId", "==", grantId)),
    getCollection("invoices",      where("grantId", "==", grantId)),
  ]);

  // Participants: query directly by grantId (new records), and also via program chain (legacy)
  const directParticipants = await getCollection("participants", where("grantId", "==", grantId));
  const directIds = new Set(directParticipants.map(p => p.id));
  const programIds = programs.map(p => p.id);
  let chainParticipants = [];
  for (const pid of programIds) {
    const pp = await getCollection("participants", where("programId", "==", pid));
    chainParticipants = chainParticipants.concat(pp.filter(p => !directIds.has(p.id)));
  }
  const participants = [...directParticipants, ...chainParticipants];

  const ops = [
    ...activities.map(a    => ({ type: "delete", path: "activities",    id: a.id })),
    ...programs.map(p      => ({ type: "delete", path: "programs",      id: p.id })),
    ...budgetEntries.map(e => ({ type: "delete", path: "budgetEntries", id: e.id })),
    ...risks.map(r         => ({ type: "delete", path: "risks",         id: r.id })),
    ...invoices.map(i      => ({ type: "delete", path: "invoices",      id: i.id })),
    ...participants.map(p  => ({ type: "delete", path: "participants",  id: p.id })),
  ];

  for (let i = 0; i < ops.length; i += 400) {
    await batchWrite(ops.slice(i, i + 400));
  }
  await setDocument("metrics", grantId, DEFAULT_METRICS);
  return { activities: activities.length, programs: programs.length, budgetEntries: budgetEntries.length, risks: risks.length, invoices: invoices.length, participants: participants.length };
}
