import {
  addDocument, updateDocument, deleteDocument,
  listenCollection, getCollection, batchWrite,
} from "../firebase/firestore";
import { orderBy } from "firebase/firestore";

export async function getParticipants() {
  return getCollection("participants", orderBy("name"));
}

export async function addParticipant(data) {
  return addDocument("participants", data);
}

export async function updateParticipant(id, data) {
  return updateDocument("participants", id, data);
}

export async function deleteParticipant(id) {
  return deleteDocument("participants", id);
}

export function listenParticipants(callback) {
  return listenCollection("participants", callback, orderBy("name"));
}

export async function batchAddParticipants(records, existingEmails) {
  const emailSet = new Set(existingEmails.map(e => e.toLowerCase()));
  const toAdd = records.filter(r => {
    if (!r.email) return true;
    return !emailSet.has(r.email.toLowerCase());
  });
  if (!toAdd.length) return 0;
  const ops = toAdd.map(r => ({ type: "set", path: "participants", data: r }));
  await batchWrite(ops);
  return toAdd.length;
}
