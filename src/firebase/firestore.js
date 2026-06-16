import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";

// ── Generic helpers ────────────────────────────────────────────────────────────

export const col  = (path) => collection(db, path);
export const ref  = (path, id) => doc(db, path, id);
export const srvTs = () => serverTimestamp();

export async function getDocument(path, id) {
  const snap = await getDoc(doc(db, path, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getCollection(path, ...constraints) {
  const q = constraints.length ? query(col(path), ...constraints) : col(path);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function setDocument(path, id, data) {
  await setDoc(doc(db, path, id), { ...data, updatedAt: srvTs() }, { merge: true });
}

export async function addDocument(path, data) {
  const docRef = await addDoc(col(path), { ...data, createdAt: srvTs(), updatedAt: srvTs() });
  return docRef.id;
}

export async function updateDocument(path, id, data) {
  await updateDoc(doc(db, path, id), { ...data, updatedAt: srvTs() });
}

export async function deleteDocument(path, id) {
  await deleteDoc(doc(db, path, id));
}

export function listenDocument(path, id, callback) {
  return onSnapshot(doc(db, path, id), snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function listenCollection(path, callback, ...constraints) {
  const q = constraints.length ? query(col(path), ...constraints) : col(path);
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function batchWrite(operations) {
  const batch = writeBatch(db);
  for (const op of operations) {
    const docRef = op.id ? doc(db, op.path, op.id) : doc(col(op.path));
    if (op.type === "set")    batch.set(docRef, { ...op.data, updatedAt: srvTs() }, { merge: true });
    if (op.type === "update") batch.update(docRef, { ...op.data, updatedAt: srvTs() });
    if (op.type === "delete") batch.delete(docRef);
  }
  await batch.commit();
}

// Re-export Firestore query helpers so services don't import from firebase/firestore directly
export { where, orderBy, limit, serverTimestamp };
