import {
  addDocument, updateDocument, deleteDocument,
  listenCollection, getCollection, getDocument,
  increment,
} from "../firebase/firestore";
import { where, orderBy } from "firebase/firestore";
import { addParticipant } from "./participantService";

// ── Registration forms ─────────────────────────────────────────────────────────

export async function getForms() {
  return getCollection("registrationForms", orderBy("createdAt", "desc"));
}

export async function getForm(id) {
  return getDocument("registrationForms", id);
}

export async function addForm(data) {
  return addDocument("registrationForms", data);
}

export async function updateForm(id, data) {
  return updateDocument("registrationForms", id, data);
}

export async function deleteForm(id) {
  return deleteDocument("registrationForms", id);
}

export function listenForms(callback) {
  return listenCollection("registrationForms", callback, orderBy("createdAt", "desc"));
}

// ── Registrations (responses) ──────────────────────────────────────────────────

// Newest first. Sorted here, not in the query: where(formId) + orderBy(registeredAt)
// needs a composite index the project doesn't have, and without it Firestore
// returns nothing (every form showed 0 registrations).
const newestFirst = (list) => [...list].sort((a, b) => String(b.registeredAt || "").localeCompare(String(a.registeredAt || "")));

export async function getRegistrations(formId) {
  return newestFirst(await getCollection("registrations", where("formId", "==", formId)));
}

// No orderBy: it would silently drop registrations without registeredAt.
export async function getAllRegistrations() {
  return newestFirst(await getCollection("registrations"));
}

export function listenRegistrations(formId, callback) {
  return listenCollection("registrations", (list) => callback(newestFirst(list)),
    where("formId", "==", formId)
  );
}

export async function submitRegistration(formId, regData) {
  // Save the registration
  const regId = await addDocument("registrations", {
    ...regData,
    formId,
    registeredAt: new Date().toISOString(),
    attendance: "",
  });

  // Increment the counter on the form document (used for limit enforcement without auth)
  try { await updateDocument("registrationForms", formId, { registrationCount: increment(1) }); } catch (_) {}


  // Auto-add to participants (no auth required — dedup handled by coordinators)
  await addParticipant({
    name:              regData.name,
    wikimediaUsername: regData.wikimediaUsername || "",
    email:             regData.email || "",
    phone:             regData.phone || "",
    gender:            regData.gender || "",
    region:            "",
    isNew:             regData.isNew || false,
    programId:         regData.programId || "",
    grantId:           regData.grantId || "",
    source:            "self-registered",
    registeredViaForm: formId,
    formId,
  });

  return regId;
}

export async function updateAttendance(regId, status) {
  return updateDocument("registrations", regId, { attendance: status });
}
