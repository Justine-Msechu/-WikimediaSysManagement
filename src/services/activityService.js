import {
  addDocument, updateDocument, deleteDocument,
  listenCollection, getCollection, getDocument,
} from "../firebase/firestore";
import { orderBy, where } from "firebase/firestore";

export async function getActivities() {
  return getCollection("activities", orderBy("date", "desc"));
}

export async function getActivity(id) {
  return getDocument("activities", id);
}

export async function addActivity(data) {
  return addDocument("activities", data);
}

export async function updateActivity(id, data) {
  return updateDocument("activities", id, data);
}

export async function deleteActivity(id) {
  return deleteDocument("activities", id);
}

export function listenActivities(callback) {
  return listenCollection("activities", callback, orderBy("date", "desc"));
}

// Evidence sub-collection lives under /evidence with activityId field
export async function getEvidenceForActivity(activityId) {
  return getCollection("evidence", where("activityId", "==", activityId));
}

export async function addEvidence(data) {
  return addDocument("evidence", data);
}

export async function deleteEvidence(id) {
  return deleteDocument("evidence", id);
}

export function listenEvidence(activityId, callback) {
  return listenCollection("evidence", callback, where("activityId", "==", activityId));
}

export const ACTIVITY_TYPES = [
  "Edit-a-thon", "Training", "Workshop", "Outreach", "Health outreach",
  "School visit", "Community meeting", "Team meeting", "Campaign",
  "Let's Connect", "Other",
];

export const SESSION_TYPES = [
  "Edit session", "Draft session", "Training", "Workshop", "Outreach",
  "Health outreach", "School visit", "Community meeting", "Team meeting",
  "Campaign", "Other",
];
