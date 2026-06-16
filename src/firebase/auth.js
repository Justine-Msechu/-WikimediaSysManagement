import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  browserSessionPersistence,
  browserLocalPersistence,
  setPersistence,
  updatePassword,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "./config";

export async function login(email, password, rememberMe = false) {
  const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

export async function sendReset(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function createAuthUser(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function changePassword(currentPassword, newPassword) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  return updatePassword(auth.currentUser, newPassword);
}
