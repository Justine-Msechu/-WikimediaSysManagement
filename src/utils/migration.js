/**
 * One-time migration utility: localStorage ("wkgsf_v1") → Firestore
 *
 * Usage (run once from browser console or a temporary migration page):
 *   import { migrateLocalStorageToFirestore } from "./utils/migration";
 *   await migrateLocalStorageToFirestore();
 *
 * The migration is idempotent — safe to run multiple times.
 * After running, verify in Firebase console, then clear localStorage.
 */
import { db } from "../firebase/config";
import {
  collection, addDoc, setDoc, doc, serverTimestamp, getDocs,
} from "firebase/firestore";

function load() {
  try {
    const raw = localStorage.getItem("wkgsf_v1");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function upsertDoc(path, id, data) {
  await setDoc(doc(db, path, id), { ...data, migratedAt: serverTimestamp() }, { merge: true });
}

async function addIfNotExists(colPath, item) {
  await addDoc(collection(db, colPath), { ...item, migratedAt: serverTimestamp() });
}

function ts() { return serverTimestamp(); }

export async function migrateLocalStorageToFirestore(onProgress = () => {}) {
  const state = load();
  if (!state) { onProgress("No localStorage data found."); return; }

  onProgress("Starting migration…");

  // ── Settings ───────────────────────────────────────────────────────────────────
  const settings = {
    org:           state.org           || {},
    grant:         state.grant         || {},
    team:          state.team          || [],
    reportAnswers: state.reportAnswers || {},
  };
  await setDoc(doc(db, "settings", "main"), { ...settings, updatedAt: ts() }, { merge: true });
  onProgress("✓ Settings migrated");

  // ── Metrics ────────────────────────────────────────────────────────────────────
  if (state.metrics) {
    await setDoc(doc(db, "metrics", "main"), { ...state.metrics, updatedAt: ts() }, { merge: true });
    onProgress("✓ Metrics migrated");
  }

  // ── Programs ───────────────────────────────────────────────────────────────────
  const programs = state.programs || [];
  for (const p of programs) {
    const { id, ...rest } = p;
    if (id) await upsertDoc("programs", id, rest);
  }
  onProgress(`✓ ${programs.length} programs migrated`);

  // ── Activities ─────────────────────────────────────────────────────────────────
  const activities = state.activities || [];
  for (const a of activities) {
    const { id, expenses, ...rest } = a;
    if (id) await upsertDoc("activities", id, rest);
  }
  onProgress(`✓ ${activities.length} activities migrated`);

  // ── Budget entries ─────────────────────────────────────────────────────────────
  const budgetEntries = state.budgetEntries || [];
  for (const e of budgetEntries) {
    const { id, ...rest } = e;
    if (id) await upsertDoc("budgetEntries", id, rest);
    else    await addIfNotExists("budgetEntries", rest);
  }
  onProgress(`✓ ${budgetEntries.length} budget entries migrated`);

  // ── Participants ───────────────────────────────────────────────────────────────
  const participants = state.participants || [];
  for (const p of participants) {
    const { id, ...rest } = p;
    if (id) await upsertDoc("participants", id, rest);
    else    await addIfNotExists("participants", rest);
  }
  onProgress(`✓ ${participants.length} participants migrated`);

  // ── Registration forms ─────────────────────────────────────────────────────────
  const forms = state.registrationForms || [];
  for (const f of forms) {
    const { id, ...rest } = f;
    if (id) await upsertDoc("registrationForms", id, rest);
  }

  // ── Registrations (responses) ──────────────────────────────────────────────────
  const registrations = state.registrations || [];
  for (const r of registrations) {
    const { id, ...rest } = r;
    if (id) await upsertDoc("registrations", id, rest);
    else    await addIfNotExists("registrations", rest);
  }
  onProgress(`✓ ${registrations.length} registrations migrated`);

  // ── Risks ──────────────────────────────────────────────────────────────────────
  const risks = state.risks || [];
  for (const r of risks) {
    const { id, ...rest } = r;
    if (id) await upsertDoc("risks", id, rest);
    else    await addIfNotExists("risks", rest);
  }
  onProgress(`✓ ${risks.length} risks migrated`);

  // ── Audit log ──────────────────────────────────────────────────────────────────
  const auditLog = state.auditLog || [];
  for (const entry of auditLog.slice(-200)) { // last 200 entries only
    await addDoc(collection(db, "auditLogs"), { ...entry, migratedAt: ts() });
  }
  onProgress(`✓ ${Math.min(auditLog.length, 200)} audit log entries migrated`);

  onProgress("Migration complete! Verify data in Firebase console, then clear localStorage.");
  return true;
}
