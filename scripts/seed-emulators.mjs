// Seed the LOCAL Firebase emulators (Docker) with test accounts and sample data.
//
//   docker compose run --rm seed
//
// Only talks to the emulators (project "demo-wikikilimanjaro"); it refuses to run
// against anything else. Safe to run again — it updates the same records.
//
// Test logins (emulator only — not real accounts). All use LOCAL_PASSWORD below.

const HOST = process.env.EMULATOR_HOST || "localhost";
const PROJECT = "demo-wikikilimanjaro";
const AUTH = `http://${HOST}:9099`;
const DB = `http://${HOST}:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

export const LOCAL_PASSWORD = "kilimanjaro-local-test";
export const TEST_USERS = [
  { email: "admin@wikikilimanjaro.test",       name: "Test Admin",       role: "admin" },
  { email: "coordinator@wikikilimanjaro.test", name: "Test Coordinator", role: "coordinator" },
  { email: "finance@wikikilimanjaro.test",     name: "Test Finance",     role: "finance_officer" },
  { email: "viewer@wikikilimanjaro.test",      name: "Test Viewer",      role: "viewer" },
  { email: "volunteer@wikikilimanjaro.test",   name: "Test Volunteer",   role: "volunteer", volunteerId: "vol-demo" },
];

if (!PROJECT.startsWith("demo-")) throw new Error("Refusing to seed a non-demo project.");

// JS value → Firestore REST value
function val(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
}

async function setDoc(path, data) {
  const res = await fetch(`${DB}/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },   // emulator admin: skips rules
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, val(v)])) }),
  });
  if (!res.ok) throw new Error(`Firestore ${path}: HTTP ${res.status} ${await res.text()}`);
}

async function authUser(email, password, displayName) {
  const call = (op, body) => fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=demo-api-key`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }).then(r => r.json());
  let r = await call("signUp", { email, password, displayName, returnSecureToken: true });
  if (r.error?.message === "EMAIL_EXISTS") r = await call("signInWithPassword", { email, password, returnSecureToken: true });
  if (!r.localId) throw new Error(`Auth ${email}: ${JSON.stringify(r.error || r)}`);
  return r.localId;
}

const now = new Date();
for (const u of TEST_USERS) {
  const uid = await authUser(u.email, LOCAL_PASSWORD, u.name);
  await setDoc(`users/${uid}`, {
    name: u.name, email: u.email, role: u.role, isActive: true, createdAt: now, lastLogin: null,
    ...(u.volunteerId ? { volunteerId: u.volunteerId } : {}),
  });
  console.log(`✔ ${u.role.padEnd(16)} ${u.email}`);
}

await setDoc("grants/grant-demo", {
  title: "Demo General Support Fund", grantNumber: "DEMO-0001", type: "GSF", cycle: "2026-27", status: "active",
  startDate: "2026-07-01", endDate: "2027-06-30", totalUSD: 10000, conversionRate: 0.000385, createdAt: now,
});
await setDoc("programs/program-demo", {
  name: "Monthly edit-a-thon", category: "Content", description: "Sample program for local testing.",
  status: "draft", color: "#4a9e6b", grantId: "grant-demo", budgetItems: [], subPrograms: [], createdAt: now,
});
await setDoc("registrationForms/form-demo", {
  title: "Demo edit-a-thon registration", description: "Sample <strong>open</strong> form.", date: "2026-12-05",
  location: "Moshi", status: "open", programId: "program-demo", grantId: "grant-demo", registrationCount: 0, createdAt: now,
});
await setDoc("volunteers/vol-demo", {
  name: "Test Volunteer", email: "volunteer@wikikilimanjaro.test", grantIds: ["grant-demo"], createdAt: now,
});
await setDoc("settings/main", { org: { name: "Wikimedia Community Kilimanjaro (local)" } });

console.log("✔ sample grant, program, open registration form, volunteer and settings");
console.log(`\nApp: http://localhost:3000/-WikimediaSysManagement/   Emulator UI: http://localhost:4000`);
console.log("Logins and password: see TEST_USERS and LOCAL_PASSWORD in scripts/seed-emulators.mjs");
