import {
  addDocument, updateDocument, deleteDocument,
  listenCollection, getCollection, getDocument,
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

export async function getRegistrations(formId) {
  return getCollection("registrations", where("formId", "==", formId), orderBy("registeredAt", "desc"));
}

export async function getAllRegistrations() {
  return getCollection("registrations", orderBy("registeredAt", "desc"));
}

export function listenRegistrations(formId, callback) {
  return listenCollection("registrations", callback,
    where("formId", "==", formId),
    orderBy("registeredAt", "desc")
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

  // Auto-add to participants (no auth required — dedup handled by coordinators)
  if (regData.email) {
    await addParticipant({
      name:              regData.name,
      wikimediaUsername: regData.wikimediaUsername || "",
      email:             regData.email,
      phone:             regData.phone || "",
      gender:            regData.gender || "",
      region:            "",
      isNew:             regData.isNew || false,
      programId:         regData.programId || "",
      source:            "self-registered",
      registeredViaForm: formId,
      formId,
    });
  }

  return regId;
}

export async function updateAttendance(regId, status) {
  return updateDocument("registrations", regId, { attendance: status });
}
