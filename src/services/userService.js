import {
  getDocument, setDocument, updateDocument,
  deleteDocument, listenCollection, getCollection,
} from "../firebase/firestore";
import { createAuthUser, sendReset } from "../firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { doc, setDoc } from "firebase/firestore";

export const ROLES = {
  ADMIN:           "admin",
  COORDINATOR:     "coordinator",
  FINANCE_OFFICER: "finance_officer",
  VIEWER:          "viewer",
};

export const ROLE_LABELS = {
  admin:           "Admin",
  coordinator:     "Coordinator",
  finance_officer: "Finance Officer",
  viewer:          "Viewer",
};

export const ROLE_COLORS = {
  admin:           "#c0392b",
  coordinator:     "#2d7a4f",
  finance_officer: "#2563eb",
  viewer:          "#888",
};

export const ROLE_RANK = {
  viewer: 0, finance_officer: 1, coordinator: 1, admin: 3,
};

export function canApprove(profile) {
  return profile?.role === "admin" || profile?.role === "finance_officer";
}

export function canEdit(profile) {
  return profile?.role === "admin" || profile?.role === "coordinator";
}

function randomTempPassword() {
  return Math.random().toString(36).slice(2, 10) + "Wk1!";
}

export async function createUser(email, _ignored, userData) {
  const tempPwd = randomTempPassword();
  const cred    = await createAuthUser(email, tempPwd);
  await setDoc(doc(db, "users", cred.user.uid), {
    ...userData,
    email,
    isActive:  true,
    createdAt: serverTimestamp(),
    lastLogin: null,
  });
  // Send reset email so the new user sets their own password — admin never sees it
  await sendReset(email);
  return cred.user.uid;
}

export async function getUserProfile(uid) {
  return getDocument("users", uid);
}

export async function getAllUsers() {
  return getCollection("users");
}

export async function updateUser(uid, data) {
  return updateDocument("users", uid, data);
}

export async function deactivateUser(uid) {
  return updateDocument("users", uid, { isActive: false });
}

export async function activateUser(uid) {
  return updateDocument("users", uid, { isActive: true });
}

export async function touchLastLogin(uid) {
  return updateDocument("users", uid, { lastLogin: serverTimestamp() });
}

export function listenUsers(callback) {
  return listenCollection("users", callback);
}
