const KEY = "wkgsf_v1";
export const SESSION_KEY = "wkgsf_session_v1";

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;

export const EXPENSE_TEMPLATES = [
  { description: "Venue / Room Hire", comments: "Venue hire for the event", expenseType: "Venue" },
  { description: "Food and drinks", comments: "Refreshments for participants", expenseType: "Food and drinks" },
  { description: "Participants transport", comments: "Transport support for participants", expenseType: "Transport" },
  { description: "Facilitator fees", comments: "Trainer / facilitator fee", expenseType: "Facilitators" },
  { description: "Equipment rent", comments: "Projector, camera and other equipment", expenseType: "Equipment" },
  { description: "Training materials", comments: "Printed handouts and stationery", expenseType: "Materials" },
  { description: "Internet package", comments: "", expenseType: "Internet/Supplies" },
  { description: "Bank charges", comments: "", expenseType: "Bank charges" },
];

export const EXPENSE_TYPES = [
  "Venue", "Food and drinks", "Transport", "Facilitators",
  "Equipment", "Materials", "Internet/Supplies", "Bank charges",
  "Trainers/Stipend", "Other",
];

export const SESSION_TYPES = [
  "Edit session", "Draft session", "Training", "Workshop", "Outreach",
  "Health outreach", "School visit", "Community meeting", "Team meeting",
  "Campaign", "Other",
];

export const PROGRAM_CATEGORIES = [
  "Coordination", "Content Creation", "Content Quality", "Gender Equity",
  "Capacity Building", "Health & Outreach", "Community", "Education", "Other",
];

export const PROGRAM_COLORS = [
  "#4a9e6b", "#2563eb", "#ea580c", "#9333ea",
  "#ec4899", "#0891b2", "#d97706", "#16a34a", "#0284c7",
];

export const RISK_CATEGORIES = [
  "Financial", "Operational", "Reputational", "Legal/Compliance",
  "Technical", "Personnel", "External", "Strategic",
];

export const EVIDENCE_TYPES = [
  "Photo", "Attendance sheet", "Receipt", "Invoice",
  "Supporting document", "Training material", "Report", "Other",
];

export const BUDGET_STATUSES = ["draft", "submitted", "approved", "rejected"];

export function makeDefaultExpenses() {
  return EXPENSE_TEMPLATES.map(t => ({
    id: uid(), description: t.description, comments: t.comments,
    units: 0, unitCostTZS: 0, totalTZS: 0,
    expenseType: t.expenseType, hasReceipt: false,
  }));
}

// ─── Session management ────────────────────────────────────────────────────────
export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!s) return null;
    if (new Date(s.expiresAt) < new Date()) { clearSession(); return null; }
    return s;
  } catch { return null; }
}

export function setSession(userId, rememberMe = false) {
  const loginAt = new Date().toISOString();
  const hours = rememberMe ? 720 : 8;
  const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, loginAt, expiresAt, rememberMe }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Default state ─────────────────────────────────────────────────────────────
export const defaultState = {
  org: {
    name: "Wikimedia Community Kilimanjaro",
    country: "Tanzania",
    type: "Wikimedia User Group",
    metaPage: "",
    website: "",
    contactEmail: "",
  },

  grant: {
    title: "",
    id: "",
    cycle: "2026–2027",
    startDate: "",
    endDate: "",
    totalUSD: 0,
    conversionRate: 0.000413,
    odCampaignUrl: "",
    status: "active",
  },

  programs: [
    { id: "prog-1", name: "Team Meeting", category: "Coordination", description: "Monthly internal coordination meeting", plannedSessions: 13, color: "#4a9e6b" },
    { id: "prog-2", name: "Monthly Edit-a-thon", category: "Content Creation", description: "Regular editing sessions for existing and new contributors", plannedSessions: 5, color: "#2563eb" },
    { id: "prog-3", name: "Error and Fix Campaign", category: "Content Quality", description: "Collaborative campaign to identify and correct errors in Wikipedia articles", plannedSessions: 4, color: "#ea580c" },
    { id: "prog-4", name: "Wikimalkia — WikiQueens", category: "Gender Equity", description: "Dedicated program for women contributors", plannedSessions: 5, color: "#9333ea" },
    { id: "prog-5", name: "Feminism and Folklore Tanzania", category: "Gender Equity", description: "Documents Tanzanian feminism and folklore", plannedSessions: 4, color: "#ec4899" },
    { id: "prog-6", name: "Let's Connect", category: "Capacity Building", description: "Internal capacity building through training", plannedSessions: 2, color: "#0891b2" },
    { id: "prog-7", name: "WikiHealth", category: "Health & Outreach", description: "Improves health-related Wikipedia content", plannedSessions: 2, color: "#d97706" },
    { id: "prog-8", name: "Community Gathering", category: "Community", description: "Annual celebration and community bonding", plannedSessions: 1, color: "#16a34a" },
    { id: "prog-9", name: "Kiwix for Schools", category: "Education", description: "Offline Wikipedia access and training for schools", plannedSessions: 10, color: "#0284c7" },
  ],

  proposals: [],
  planned: [],
  activities: [],

  metrics: {
    participants:    { target: 200, result: 0 },
    allEditors:      { target: 150, result: 0 },
    newEditors:      { target: 80,  result: 0 },
    retainedEditors: { target: 60,  result: 0 },
    allOrganizers:   { target: 10,  result: 0 },
    newOrganizers:   { target: 4,   result: 0 },
    projects: [
      { name: "Wikipedia (Swahili)", tCreated: 800, tImproved: 400, rCreated: 0, rImproved: 0 },
      { name: "Wikipedia (English)", tCreated: 400, tImproved: 200, rCreated: 0, rImproved: 0 },
      { name: "Wikimedia Commons",   tCreated: 350, tImproved: 0,   rCreated: 0, rImproved: 0 },
      { name: "Wikidata",            tCreated: 250, tImproved: 0,   rCreated: 0, rImproved: 0 },
    ],
    // M&E custom indicators
    indicators: [],
  },

  admin: {
    salaries: [],
    adminCosts: [],
  },

  team: [
    { id: "t1", name: "", role: "Program Coordinator", username: "", email: "" },
    { id: "t2", name: "", role: "Community Manager",   username: "", email: "" },
  ],

  reportAnswers: {
    q1: "", q2: "", q3: "", q4: "", q5: "",
    q6_1: "", q6_2: "", q6_3: "",
    q12: "", q13: "",
    q17: "", q18: "", q19: "",
  },

  // Auth (legacy PIN kept for migration, but users[] is primary)
  auth: { pinHash: "" },

  // ── Persistent user accounts ──
  users: [],

  // ── Audit log ──
  auditLog: [],

  // ── Participant registry ──
  participants: [],

  // ── Budget approval entries ──
  budgetEntries: [],

  // ── Evidence / document attachments ──
  evidence: [],

  // ── Risk register ──
  risks: [],

  // ── Backup history ──
  backupHistory: [],

  // ── Registration forms ──
  registrationForms: [],

  // ── Registrations (responses) ──
  registrations: [],
};

// ─── Load ──────────────────────────────────────────────────────────────────────
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultState));
    const stored = JSON.parse(raw);

    // Legacy migrations
    if (!stored.auth) stored.auth = { pinHash: "" };
    if (!stored.proposals) stored.proposals = [];
    if (!stored.planned) stored.planned = [];
    if (!stored.grant) {
      stored.grant = {
        title: stored.org?.grantTitle || "",
        id: stored.org?.grantId || "",
        cycle: stored.org?.grantCycle || "2026–2027",
        startDate: stored.org?.startDate || "",
        endDate: stored.org?.endDate || "",
        totalUSD: stored.admin?.grantTotalUSD || 0,
        conversionRate: stored.admin?.defaultConversionRate || 0.000413,
        odCampaignUrl: stored.org?.odCampaignUrl || "",
        status: "active",
      };
    }

    // New-feature migrations
    if (!stored.users)        stored.users = [];
    if (!stored.auditLog)     stored.auditLog = [];
    if (!stored.participants) stored.participants = [];
    if (!stored.budgetEntries) stored.budgetEntries = [];
    if (!stored.evidence)     stored.evidence = [];
    if (!stored.risks)          stored.risks = [];
    if (!stored.backupHistory)       stored.backupHistory = [];
    if (!stored.registrationForms)   stored.registrationForms = [];
    if (!stored.registrations)       stored.registrations = [];
    if (!stored.metrics.indicators)  stored.metrics.indicators = [];

    // Auto-sync: anyone who registered via a form should appear in the participants registry.
    // Runs on every load so it retroactively fixes existing data too. Deduplicates by email.
    if (stored.registrations && stored.registrations.length > 0) {
      const existingEmails = new Set(
        (stored.participants || []).map(p => (p.email || "").toLowerCase()).filter(Boolean)
      );
      const toAdd = stored.registrations
        .filter(r => r.email && !existingEmails.has(r.email.toLowerCase()))
        .map(r => ({
          id: uid(),
          name: r.name,
          wikimediaUsername: r.wikimediaUsername || "",
          email: r.email,
          phone: r.phone || "",
          gender: r.gender || "",
          age: r.age || "",
          organization: r.organization || "",
          district: r.district || "",
          region: "",
          programIds: [],
          source: "self-registered",
          registeredViaForm: r.formId,
          addedAt: r.registeredAt || new Date().toISOString(),
        }));
      if (toAdd.length > 0) {
        stored.participants = [...(stored.participants || []), ...toAdd];
      }
    }

    // Ensure "under_review" is valid proposal status
    if (stored.proposals) {
      stored.proposals = stored.proposals.map(p =>
        p.status === "pending" ? { ...p, status: "submitted" } : p
      );
    }

    return stored;
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function reset() {
  localStorage.removeItem(KEY);
  clearSession();
}


