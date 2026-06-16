import {
  addDocument, updateDocument, deleteDocument,
  listenCollection, getCollection,
} from "../firebase/firestore";
import { orderBy } from "firebase/firestore";

export const RISK_CATEGORIES = [
  "Financial", "Operational", "Reputational", "Legal/Compliance",
  "Technical", "Personnel", "External", "Strategic",
];

export const RISK_STATUSES = ["open", "mitigated", "closed"];

export async function getRisks() {
  return getCollection("risks", orderBy("createdAt", "desc"));
}

export async function addRisk(data) {
  return addDocument("risks", data);
}

export async function updateRisk(id, data) {
  return updateDocument("risks", id, data);
}

export async function deleteRisk(id) {
  return deleteDocument("risks", id);
}

export function listenRisks(callback) {
  return listenCollection("risks", callback, orderBy("createdAt", "desc"));
}
