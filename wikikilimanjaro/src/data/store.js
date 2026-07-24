// ─── Central data store ───────────────────────────────────────────────────────
// All state is kept in localStorage under key "wkgsf_v1".
// Call load() to get state, save(state) to persist.

const KEY = "wkgsf_v1";

export const defaultState = {
  org: {
    name: "Wikimedians of Kilimanjaro group / Open Knowledge Tanzania",
    country: "Tanzania",
    type: "Wikimedia User Group",
    grantId: "R-GS-2606-22863",
    grantCycle: "2025–2026",
    metaPage: "https://meta.wikimedia.org/wiki/Wikimedia_Community_Kilimanjaro",
    website: "",
    governance: "",
    contactEmail: "",
  },

  application: {
    title: "Wikimedia Community Kilimanjaro Annual Grant 2025–2026",
    startDate: "2025-09-01",
    endDate: "2026-08-31",
    location:
      "Tanzania — primarily Kilimanjaro, Arusha and surrounding regions; school outreach extends to rural and low-connectivity areas nationwide",
    programs: `Our main challenge areas are:
1. Limited Swahili content on Wikipedia
2. Low digital skills among potential contributors
3. Gender imbalance in participation
4. Weak community connection and editor retention
5. Poor internet access in rural schools

Programs to address these:

Monthly Edit-a-thons: Regular in-person editing events focused on Swahili content creation and improvement, particularly on Kilimanjaro region topics (history, culture, geography, development).

Wiki Malkia ("Wiki Queens"): Dedicated program for women contributors providing mentorship, leadership training, safe editing spaces, and recognition. Directly addresses gender imbalance.

"There Is an Error, Fix and Contribute" Campaign: Ongoing campaign for reviewing and fixing errors in existing Swahili Wikipedia articles. Improves content quality and engages new editors.

Mentorship Program: Pairing new contributors with experienced editors to improve article quality and boost retention.

School Outreach with Kiwix (Offline Wikipedia): In partnership with Reneal International Education Outreach, we install offline Wikipedia servers in government schools. Trains teachers and students to access free knowledge without internet.

Let's Connect — Peer Learning Program: Collaboration hub for Wikimedia groups in Tanzania to share skills, plan together, and support each other.

Wikimedia Campaigns: Participation in Wiki Loves Africa, Feminism and Folklore, and others to attract new contributors and diversify content.`,
    team: `Team members:
- Coordinator (paid contractor): Day-to-day operations, reporting, finances
- Program Officer (paid contractor): Leads edit-a-thons and training sessions
- 5–7 Volunteer Organizers: Support events, mentorship, and outreach
- Partnership Liaison (volunteer): Coordinates with Reneal International Education Outreach
Wiki usernames listed on Meta-Wiki page.`,
    partners: `1. Reneal International Education Outreach (external): Provides computers to government schools loaded with Kiwix (offline Wikipedia). Joint teacher and student training.
2. Wikimedia Community User Group Tanzania (internal): Collaboration on Let's Connect and joint campaigns.
3. Jenga Wikipedia ya Kiswahili (internal): Coordination on Swahili content quality and shared editathons.
4. University Student Wikimedians (internal): Engaging youth in editing and organizing.`,
    categories: [
      "Education",
      "Culture, heritage or GLAM",
      "Gender and diversity",
      "Community support and engagement",
      "Participation in campaigns and contests",
    ],
    movementStrategy: [
      "Increase sustainability",
      "Provide for safety and inclusion",
      "Invest in skills and leadership",
      "Coordinate across stakeholders",
      "Identify topics for impact",
    ],
    hasPreviousGrant: "Yes",
    coiDeclaration: "No conflicts of interest",
    additionalInfo: "",
  },

  budget: {
    total: 42740280,
    currency: "TZS",
    planned: {
      personnel: 18150000,
      operational: 3355000,
      programmatic: 19745000,
    },
    spent: {
      personnel: 0,
      operational: 0,
      programmatic: 0,
    },
    expenses: [],
    otherRevenue: false,
    otherRevenueDetails: "",
  },

  metrics: {
    participants: { target: 120, result: 0 },
    allEditors: { target: 110, result: 0 },
    newEditors: { target: 55, result: 0 },
    retainedEditors: { target: 45, result: 0 },
    allOrganizers: { target: 8, result: 0 },
    newOrganizers: { target: 3, result: 0 },
    projects: [
      { name: "Wikipedia", tCreated: 1200, tImproved: 600, rCreated: 0, rImproved: 0 },
      { name: "Wikimedia Commons", tCreated: 350, tImproved: 450, rCreated: 0, rImproved: 0 },
      { name: "Wikidata", tCreated: 250, tImproved: 550, rCreated: 0, rImproved: 0 },
    ],
  },

  activities: [],

  team: [
    { id: "t1", name: "Coordinator", role: "Coordinator", username: "", email: "" },
    { id: "t2", name: "Program Officer", role: "Program Officer", username: "", email: "" },
  ],
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultState));
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function reset() {
  localStorage.removeItem(KEY);
}
