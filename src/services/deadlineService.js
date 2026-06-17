import { addDocument, listenCollection, deleteDocument, updateDocument } from "../firebase/firestore";
import { orderBy } from "../firebase/firestore";

export const DEADLINE_TYPES = [
  "Wikimedia report", "Grant milestone", "Activity deadline",
  "Financial deadline", "Internal",
];

export function listenDeadlines(callback) {
  return listenCollection("deadlines", callback, orderBy("date", "asc"));
}
export async function addDeadline(data)    { return addDocument("deadlines", data); }
export async function updateDeadline(id, d){ return updateDocument("deadlines", id, d); }
export async function deleteDeadline(id)   { return deleteDocument("deadlines", id); }
