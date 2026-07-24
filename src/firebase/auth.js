import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  browserSessionPersistence,
  browserLocalPersistence,
  setPersistence,
  updatePassword,
  createUserWithEmailAndPassword,
  getAuth,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { auth, firebaseConfig } from "./config";

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

// Creates a Firebase Auth user WITHOUT signing the current admin out.
// Uses a temporary secondary app instance so the main auth session is untouched.
export async function createAuthUser(email, password) {
  const secondaryApp  = initializeApp(firebaseConfig, `reg-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth);
    return cred;
  } catch (err) {
    await signOut(secondaryAuth).catch(() => {});
    throw err;
  }
}

export async function changePassword(currentPassword, newPassword) {
  if (!auth.currentUser) throw new Error("Not authenticated");
  const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  return updatePassword(auth.currentUser, newPassword);
}
