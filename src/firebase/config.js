import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Local development with Docker (docker compose up) sets REACT_APP_USE_EMULATORS.
// The app then talks only to the local Firebase emulators under a "demo-"
// project id, which can never reach the live project.
export const USE_EMULATORS = process.env.REACT_APP_USE_EMULATORS === "true";
const EMULATOR_HOST = process.env.REACT_APP_EMULATOR_HOST || "localhost";

export function connectToAuthEmulator(authInstance) {
  if (USE_EMULATORS) connectAuthEmulator(authInstance, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
}

export const firebaseConfig = USE_EMULATORS ? {
  apiKey:     "demo-api-key",
  authDomain: "demo-wikikilimanjaro.firebaseapp.com",
  projectId:  "demo-wikikilimanjaro",
  storageBucket: "demo-wikikilimanjaro.appspot.com",
  appId:      "demo-app",
} : {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// App Check — blocks requests that don't come from the real deployed app.
// In development, prints a debug token to the console; add it in Firebase Console
// → App Check → Apps → Manage debug tokens.
if (process.env.NODE_ENV === "development" && !USE_EMULATORS) {
  window.self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
if (process.env.REACT_APP_RECAPTCHA_SITE_KEY && !USE_EMULATORS) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(process.env.REACT_APP_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth    = getAuth(app);
export const db      = getFirestore(app);
if (USE_EMULATORS) {
  connectToAuthEmulator(auth);
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
}
export const storage = getStorage(app);
export default app;
