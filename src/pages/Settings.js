import React, { useState, useEffect } from "react";
import { listenSettings, updateSettings, DEFAULT_SETTINGS } from "../services/settingsService";
import { getAllUsers } from "../services/userService";
import { changePassword } from "../firebase/auth";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { db } from "../firebase/config";
import { collection, getDocs, writeBatch, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { setDocument } from "../firebase/firestore";

const WIPE_COLLECTIONS = [
  "activities", "activityFiles", "activityTemplates",
  "participants", "programs", "budgetEntries", "invoices",
  "registrationForms", "registrations",
  "risks", "announcements", "deadlines", "metrics",
  "volunteers", "volunteerTasks", "taskComments",
  "notifications", "comments", "evidence",
];

async function wipeAllData() {
  for (const col of WIPE_COLLECTIONS) {
    const snap = await getDocs(collection(db, col));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach(d => batch.delete(doc(db, col, d.id)));
      await batch.commit();
    }
  }
}

function WipeAllButton({ profile, showToast }) {
  const [confirm, setConfirm] = useState(false);
  const [wiping,  setWiping]  = useState(false);

  const run = async () => {
    setWiping(true);
    try {
      await wipeAllData();
      await addAudit(profile, AUDIT_ACTIONS.DELETE, "settings", { details: "Wiped all system data" });
      showToast("All data deleted.");
    } catch (e) {
      showToast("Error: " + (e.message || "Delete failed."));
    } finally {
      setWiping(false);
      setConfirm(false);
    }
  };

  if (!confirm) {
    return (
      <button className="btn" style={{ background: "#c0392b", color: "#fff", borderColor: "#c0392b" }} onClick={() => setConfirm(true)}>
        Delete all data
      </button>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "#c0392b", fontWeight: 600 }}>Are you sure? This will delete everything permanently.</span>
      <button className="btn" style={{ background: "#c0392b", color: "#fff", borderColor: "#c0392b" }} onClick={run} disabled={wiping}>
        {wiping ? "Deleting…" : "Yes, delete everything"}
      </button>
      <button className="btn" onClick={() => setConfirm(false)} disabled={wiping}>Cancel</button>
    </div>
  );
}

async function seedGrantData(add, grantDef) {
  const { grantId, label, programs: progDefs, activities: actDefs, budget, participants: partDefs, risks: riskDefs, metrics, form: formDef } = grantDef;

  // Programs
  const progRefs = {};
  for (const p of progDefs) {
    const ref = await add("programs", { grantId, ...p });
    progRefs[p._key] = ref.id;
  }

  // Activities + evidence
  const actRefs = {};
  for (const a of actDefs) {
    const { _key, _evidenceTitle, _evidenceUrl, programKey, ...rest } = a;
    const ref = await add("activities", { grantId, programId: progRefs[programKey], ...rest });
    actRefs[_key] = ref.id;
    if (_evidenceTitle) {
      await add("evidence", { activityId: ref.id, title: _evidenceTitle, url: _evidenceUrl || "", evidenceType: "report", description: `Evidence for ${label}`, addedBy: "Test Admin", addedById: "test_uid" });
    }
  }

  // Budget entries
  for (const e of budget) {
    const { programKey, ...rest } = e;
    await add("budgetEntries", { grantId, programId: progRefs[programKey], ...rest });
  }

  // Participants
  for (const p of partDefs) {
    const { programKey, ...rest } = p;
    await add("participants", { grantId, programId: progRefs[programKey], ...rest });
  }

  // Risks
  for (const r of riskDefs) {
    await add("risks", { grantId, ...r });
  }

  // Metrics — use the service wrapper so the path is built correctly
  await setDocument("metrics", grantId, { ...metrics });

  // Registration form + registrations
  const formRef = await add("registrationForms", { grantId, programId: progRefs[formDef.programKey], title: formDef.title, description: formDef.description, status: "active", createdBy: "Test Admin", customFields: formDef.customFields || [] });
  for (const r of formDef.registrations) {
    await add("registrations", { formId: formRef.id, programId: progRefs[formDef.programKey], grantId, ...r, registeredAt: serverTimestamp() });
  }
}

async function seedTestData() {
  const add = (col, data) => addDoc(collection(db, col), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  // ── GRANT A: General Support Fund 2024–2025 (completed) ────────────────────
  const gA = await add("grants", {
    title: "General Support Fund 2024–2025",
    grantNumber: "R-GS-2406-10001",
    type: "General Support Fund", cycle: "2024–2025", status: "completed",
    startDate: "2024-07-01", endDate: "2025-06-30",
    totalUSD: 45000, conversionRate: 0.000385, odCampaignUrl: "",
  });
  await seedGrantData(add, {
    grantId: gA.id, label: "GSF 2024–2025",
    programs: [
      { _key: "p1", name: "Kiwix School Outreach", category: "Education", description: "Offline Wikipedia in rural schools.", plannedSessions: 8, plannedBudget: 4500000, status: "approved", submittedBy: "Coord A", approvedBy: "Admin", color: "#4a9e6b" },
      { _key: "p2", name: "Community Edit-a-thons", category: "Content", description: "Monthly community editing events.", plannedSessions: 10, plannedBudget: 6000000, status: "approved", submittedBy: "Coord A", approvedBy: "Admin", color: "#d97706" },
    ],
    activities: [
      { _key: "a1", programKey: "p1", name: "Kiwix Setup — Moshi Primary School", type: "Outreach", date: "2024-09-05", location: "Moshi", reportedBy: "Coord A", participants: 120, women: 60, newEditors: 5, retainedEditors: 2, youth: 110, pwd: 3, organizers: 4, newOrganizers: 1, created: 0, improved: 0, commons: 0, wikidata: 0, summary: "Installed Kiwix on 30 school computers.", challenges: "Power outages delayed setup.", lessons: "Bring UPS battery backup.", stories: "Students read about Kilimanjaro in Swahili for the first time.", nextSteps: "Follow-up visit in December.", cost: 550000, _evidenceTitle: "School visit report", _evidenceUrl: "" },
      { _key: "a2", programKey: "p2", name: "Edit-a-thon — Tanzania Independence Day", type: "Edit-a-thon", date: "2024-12-09", location: "Arusha Library", reportedBy: "Coord A", participants: 30, women: 14, newEditors: 10, retainedEditors: 4, youth: 12, pwd: 0, organizers: 3, newOrganizers: 0, created: 18, improved: 25, commons: 8, wikidata: 4, summary: "High-quality articles on Tanzanian history.", challenges: "Some editors struggled with citations.", lessons: "Run a citation workshop beforehand.", stories: "Omar wrote his first Wikipedia article on uhuru celebrations.", nextSteps: "Nominate best articles for DYK.", cost: 720000, _evidenceTitle: "Edit-a-thon outcome report", _evidenceUrl: "" },
      { _key: "a3", programKey: "p2", name: "Edit-a-thon — Women in Science", type: "Edit-a-thon", date: "2025-03-08", location: "UDSM Arusha Campus", reportedBy: "Coord A", participants: 22, women: 22, newEditors: 8, retainedEditors: 3, youth: 10, pwd: 1, organizers: 2, newOrganizers: 1, created: 12, improved: 18, commons: 5, wikidata: 6, summary: "Focused on Tanzanian women scientists.", challenges: "Limited reference sources in Swahili.", lessons: "Partner with university library next time.", stories: "Dr Neema's biography was created and reached 1000 views.", nextSteps: "Translate articles to English Wikipedia.", cost: 640000, _evidenceTitle: "Women in Science report", _evidenceUrl: "" },
    ],
    budget: [
      { programKey: "p1", title: "Transport to schools", category: "Operational costs", amount: 400000, date: "2024-09-05", status: "approved", requestedBy: "Coord A", approvedBy: "Admin" },
      { programKey: "p1", title: "Kiwix USB drives (×30)", category: "Programmatic costs", amount: 900000, date: "2024-09-05", status: "approved", requestedBy: "Coord A", approvedBy: "Admin" },
      { programKey: "p2", title: "Venue hire — December edit-a-thon", category: "Programmatic costs", amount: 350000, date: "2024-12-09", status: "approved", requestedBy: "Coord A", approvedBy: "Admin" },
      { programKey: "p2", title: "Refreshments", category: "Programmatic costs", amount: 180000, date: "2024-12-09", status: "approved", requestedBy: "Coord A", approvedBy: "Admin" },
      { programKey: "p2", title: "Venue hire — Women in Science", category: "Programmatic costs", amount: 300000, date: "2025-03-08", status: "approved", requestedBy: "Coord A", approvedBy: "Admin" },
    ],
    participants: [
      { programKey: "p2", name: "Amina Juma", wikimediaUsername: "Amina Juma", email: "amina.a@example.com", phone: "+255712001001", gender: "Female", region: "Kilimanjaro", isNew: true, notes: "Grant A participant." },
      { programKey: "p2", name: "Omar Mrisho", wikimediaUsername: "Omar Mrisho", email: "omar.a@example.com", phone: "+255712001002", gender: "Male", region: "Arusha", isNew: true, notes: "" },
      { programKey: "p1", name: "Neema Shirima", wikimediaUsername: "Neema Shirima", email: "neema.a@example.com", phone: "+255712001003", gender: "Female", region: "Moshi", isNew: false, notes: "School teacher, key contact." },
    ],
    risks: [
      { title: "School calendar conflicts", category: "Operational", likelihood: 3, impact: 2, score: 6, status: "closed", owner: "Coord A", response: "Confirm dates with headmaster 4 weeks in advance." },
      { title: "Budget exchange rate volatility", category: "Financial", likelihood: 4, impact: 3, score: 12, status: "mitigated", owner: "Finance Officer", response: "Convert funds at start of grant period to lock in rate." },
    ],
    metrics: {
      participants: { target: 300, result: 172 }, allEditors: { target: 60, result: 38 },
      newEditors: { target: 40, result: 23 }, retainedEditors: { target: 20, result: 9 },
      allOrganizers: { target: 8, result: 9 }, newOrganizers: { target: 3, result: 2 },
      projects: [
        { name: "Wikipedia (Swahili)", tCreated: 80, tImproved: 120, rCreated: 30, rImproved: 43 },
        { name: "Wikimedia Commons", tCreated: 150, tImproved: 0, rCreated: 13, rImproved: 0 },
        { name: "Wikidata", tCreated: 40, tImproved: 0, rCreated: 10, rImproved: 0 },
      ],
    },
    form: {
      programKey: "p2", title: "Edit-a-thon Sign-up — Grant A", description: "Register for Grant A editing events.",
      customFields: [{ label: "Wikipedia username", type: "text", required: false }],
      registrations: [
        { name: "Grace Mollel", wikimediaUsername: "Grace Mollel", email: "grace.a@example.com", phone: "+255712001004", gender: "Female", age: "25–34", wikistatus: "new" },
        { name: "David Kimaro", wikimediaUsername: "David Kimaro", email: "david.a@example.com", phone: "+255712001005", gender: "Male", age: "18–24", wikistatus: "experienced" },
      ],
    },
  });

  // ── GRANT B: Rapid Grant 2025 (active) ─────────────────────────────────────
  const gB = await add("grants", {
    title: "Rapid Grant — Kiwix Rural Expansion 2025",
    grantNumber: "R-RG-2506-20001",
    type: "Rapid Grant", cycle: "2025", status: "active",
    startDate: "2025-01-01", endDate: "2025-06-30",
    totalUSD: 8000, conversionRate: 0.000400, odCampaignUrl: "",
  });
  await seedGrantData(add, {
    grantId: gB.id, label: "Rapid Grant 2025",
    programs: [
      { _key: "p1", name: "Kiwix Rural District Roll-out", category: "Education", description: "Expanding Kiwix to 5 more rural districts.", plannedSessions: 5, plannedBudget: 12000000, status: "approved", submittedBy: "Coord B", approvedBy: "Admin", color: "#2563eb" },
    ],
    activities: [
      { _key: "a1", programKey: "p1", name: "Kiwix Installation — Rombo District", type: "Outreach", date: "2025-02-10", location: "Rombo", reportedBy: "Coord B", participants: 80, women: 35, newEditors: 3, retainedEditors: 1, youth: 75, pwd: 2, organizers: 2, newOrganizers: 1, created: 0, improved: 0, commons: 0, wikidata: 0, summary: "Installed at 3 primary schools in Rombo.", challenges: "Roads were difficult in rainy season.", lessons: "Plan installations for dry season.", stories: "Principal Mwamba praised offline access for students.", nextSteps: "Visit Same District next.", cost: 1800000, _evidenceTitle: "Rombo installation report", _evidenceUrl: "" },
      { _key: "a2", programKey: "p1", name: "Kiwix Installation — Same District", type: "Outreach", date: "2025-04-14", location: "Same", reportedBy: "Coord B", participants: 95, women: 48, newEditors: 4, retainedEditors: 0, youth: 88, pwd: 4, organizers: 2, newOrganizers: 0, created: 0, improved: 0, commons: 0, wikidata: 0, summary: "Successful rollout across 4 schools.", challenges: "One laptop was damaged in transit.", lessons: "Use padded cases for all equipment.", stories: "Teacher Zawadi used Wikipedia lessons for geography class.", nextSteps: "Visit Hai District.", cost: 2100000, _evidenceTitle: "Same district report", _evidenceUrl: "" },
    ],
    budget: [
      { programKey: "p1", title: "Fuel & transport — Rombo", category: "Operational costs", amount: 600000, date: "2025-02-10", status: "approved", requestedBy: "Coord B", approvedBy: "Admin" },
      { programKey: "p1", title: "Kiwix USB sticks — Rombo (×20)", category: "Programmatic costs", amount: 600000, date: "2025-02-10", status: "approved", requestedBy: "Coord B", approvedBy: "Admin" },
      { programKey: "p1", title: "Fuel & transport — Same", category: "Operational costs", amount: 700000, date: "2025-04-14", status: "approved", requestedBy: "Coord B", approvedBy: "Admin" },
      { programKey: "p1", title: "Per diem — 2 staff × 2 days", category: "Personnel costs", amount: 400000, date: "2025-04-14", status: "submitted", requestedBy: "Coord B" },
    ],
    participants: [
      { programKey: "p1", name: "Zawadi Minja", wikimediaUsername: "Zawadi Minja", email: "zawadi.b@example.com", phone: "+255712002001", gender: "Female", region: "Same", isNew: false, notes: "Lead teacher at Same Primary." },
      { programKey: "p1", name: "Baraka Mwamba", wikimediaUsername: "Baraka Mwamba", email: "baraka.b@example.com", phone: "+255712002002", gender: "Male", region: "Rombo", isNew: false, notes: "School principal, champion of the project." },
    ],
    risks: [
      { title: "Equipment damage during rural transport", category: "Operational", likelihood: 3, impact: 4, score: 12, status: "open", owner: "Coord B", response: "Use padded carry cases and insure equipment." },
      { title: "Insufficient school electricity supply", category: "Technical", likelihood: 4, impact: 3, score: 12, status: "mitigated", owner: "IT Lead", response: "Pre-charge all devices; provide solar charger." },
    ],
    metrics: {
      participants: { target: 400, result: 175 }, allEditors: { target: 10, result: 7 },
      newEditors: { target: 7, result: 7 }, retainedEditors: { target: 3, result: 0 },
      allOrganizers: { target: 4, result: 4 }, newOrganizers: { target: 2, result: 1 },
      projects: [
        { name: "Wikipedia (Swahili)", tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 },
        { name: "Wikimedia Commons", tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 },
      ],
    },
    form: {
      programKey: "p1", title: "Kiwix Training Feedback Form", description: "Post-installation feedback from school staff.",
      customFields: [{ label: "School name", type: "text", required: true }],
      registrations: [
        { name: "Lightness Kimaro", wikimediaUsername: "", email: "lightness.b@example.com", phone: "+255712002003", gender: "Female", age: "35–44", wikistatus: "none" },
      ],
    },
  });

  // ── GRANT C: General Support Fund 2025–2026 (active, current) ──────────────
  const gC = await add("grants", {
    title: "General Support Fund 2025–2026",
    grantNumber: "R-GS-2606-22863",
    type: "General Support Fund", cycle: "2025–2026", status: "active",
    startDate: "2025-07-01", endDate: "2026-06-30",
    totalUSD: 52000, conversionRate: 0.000413, odCampaignUrl: "",
  });
  await seedGrantData(add, {
    grantId: gC.id, label: "GSF 2025–2026",
    programs: [
      { _key: "p1", name: "Wikipedia Editing Workshop", category: "Education", description: "Monthly editing sessions for new and returning editors.", plannedSessions: 8, plannedBudget: 5000000, status: "approved", submittedBy: "Coord C", approvedBy: "Admin", color: "#4a9e6b" },
      { _key: "p2", name: "Wiki Malkia Women Outreach", category: "Gender & Diversity", description: "Empowering women to contribute to Wikimedia projects.", plannedSessions: 6, plannedBudget: 3500000, status: "approved", submittedBy: "Coord C", approvedBy: "Admin", color: "#9333ea" },
      { _key: "p3", name: "Let's Connect Community Meetings", category: "Community", description: "Quarterly community engagement and planning sessions.", plannedSessions: 4, plannedBudget: 2000000, status: "approved", submittedBy: "Coord C", approvedBy: "Admin", color: "#d97706" },
    ],
    activities: [
      { _key: "a1", programKey: "p1", name: "Edit-a-thon #1 — Kilimanjaro Heritage", type: "Edit-a-thon", date: "2025-08-20", location: "Moshi Community Centre", reportedBy: "Coord C", participants: 28, women: 13, newEditors: 9, retainedEditors: 6, youth: 11, pwd: 1, organizers: 3, newOrganizers: 1, created: 17, improved: 24, commons: 11, wikidata: 7, summary: "Strong turnout for first event of the new cycle.", challenges: "Slow internet in afternoon session.", lessons: "Pre-load articles and cache Wikipedia for editing sessions.", stories: "Siti edited the Kilimanjaro article and it was featured on the Swahili main page.", nextSteps: "Plan edit-a-thon #2 for November.", cost: 880000, _evidenceTitle: "Edit-a-thon #1 report", _evidenceUrl: "" },
      { _key: "a2", programKey: "p2", name: "Wiki Malkia Session #1 — Commons Basics", type: "Training", date: "2025-09-15", location: "Arusha Library", reportedBy: "Coord C", participants: 20, women: 20, newEditors: 7, retainedEditors: 4, youth: 9, pwd: 0, organizers: 2, newOrganizers: 1, created: 9, improved: 15, commons: 20, wikidata: 4, summary: "Introduction to Wikimedia Commons photo uploads.", challenges: "Licensing concepts were confusing for first-timers.", lessons: "Use visual guides for Creative Commons licences.", stories: "Rehema uploaded 30 photos from the Arusha market; 5 already used in articles.", nextSteps: "Advanced session on structured data next month.", cost: 650000, _evidenceTitle: "Wiki Malkia S1 report", _evidenceUrl: "" },
      { _key: "a3", programKey: "p3", name: "Let's Connect Q1 — Planning Meeting", type: "Community gathering", date: "2025-10-05", location: "Moshi", reportedBy: "Coord C", participants: 15, women: 7, newEditors: 0, retainedEditors: 0, youth: 4, pwd: 0, organizers: 5, newOrganizers: 0, created: 0, improved: 0, commons: 0, wikidata: 0, summary: "Quarterly review of grant progress and Q2 planning.", challenges: "Two team members could not attend.", lessons: "Share agenda 5 days early to allow remote input.", stories: "Community voted to add a Wikidata training track for 2026.", nextSteps: "Confirm Q2 activity calendar by end of October.", cost: 300000, _evidenceTitle: "", _evidenceUrl: "" },
    ],
    budget: [
      { programKey: "p1", title: "Venue hire — edit-a-thon #1", category: "Programmatic costs", amount: 350000, date: "2025-08-20", status: "approved", requestedBy: "Coord C", approvedBy: "Admin" },
      { programKey: "p1", title: "Refreshments", category: "Programmatic costs", amount: 180000, date: "2025-08-20", status: "approved", requestedBy: "Coord C", approvedBy: "Admin" },
      { programKey: "p2", title: "Transport allowance — Wiki Malkia S1", category: "Operational costs", amount: 220000, date: "2025-09-15", status: "approved", requestedBy: "Coord C", approvedBy: "Admin" },
      { programKey: "p2", title: "Printed learning materials", category: "Programmatic costs", amount: 130000, date: "2025-09-15", status: "submitted", requestedBy: "Coord C" },
      { programKey: "p3", title: "Meeting hall hire", category: "Operational costs", amount: 150000, date: "2025-10-05", status: "draft", requestedBy: "Coord C" },
    ],
    participants: [
      { programKey: "p1", name: "Siti Moshi", wikimediaUsername: "Siti Moshi", email: "siti.c@example.com", phone: "+255712003001", gender: "Female", region: "Kilimanjaro", isNew: true, notes: "Very active editor, featured article contributor." },
      { programKey: "p1", name: "Hassan Kimaro", wikimediaUsername: "Hassan Kimaro", email: "hassan.c@example.com", phone: "+255712003002", gender: "Male", region: "Moshi", isNew: false, notes: "" },
      { programKey: "p2", name: "Rehema Ally", wikimediaUsername: "Rehema Ally", email: "rehema.c@example.com", phone: "+255712003003", gender: "Female", region: "Arusha", isNew: true, notes: "Focused on Commons photography." },
      { programKey: "p2", name: "Lucia Temba", wikimediaUsername: "Lucia Temba", email: "lucia.c@example.com", phone: "+255712003004", gender: "Female", region: "Moshi", isNew: true, notes: "" },
      { programKey: "p3", name: "Moses Mwanga", wikimediaUsername: "Moses Mwanga", email: "moses.c@example.com", phone: "+255712003005", gender: "Male", region: "Kilimanjaro", isNew: false, notes: "Community organizer." },
    ],
    risks: [
      { title: "Low attendance due to Ramadhan schedule", category: "Operational", likelihood: 3, impact: 3, score: 9, status: "open", owner: "Coord C", response: "Reschedule sessions around Ramadhan; use shorter evening formats." },
      { title: "Key coordinator unavailability", category: "Personnel", likelihood: 2, impact: 4, score: 8, status: "open", owner: "Admin", response: "Cross-train a second coordinator; maintain a deputy plan." },
      { title: "Wikimedia server downtime during edit-a-thon", category: "Technical", likelihood: 2, impact: 5, score: 10, status: "mitigated", owner: "IT Lead", response: "Cache article drafts locally and upload when connectivity restored." },
    ],
    metrics: {
      participants: { target: 250, result: 63 }, allEditors: { target: 100, result: 26 },
      newEditors: { target: 60, result: 16 }, retainedEditors: { target: 40, result: 10 },
      allOrganizers: { target: 12, result: 10 }, newOrganizers: { target: 5, result: 2 },
      projects: [
        { name: "Wikipedia (Swahili)", tCreated: 120, tImproved: 180, rCreated: 26, rImproved: 39 },
        { name: "Wikimedia Commons", tCreated: 250, tImproved: 0, rCreated: 31, rImproved: 0 },
        { name: "Wikidata", tCreated: 60, tImproved: 0, rCreated: 11, rImproved: 0 },
      ],
    },
    form: {
      programKey: "p1", title: "Edit-a-thon #2 Registration", description: "Sign up for the November Wikipedia editing session.",
      customFields: [{ label: "District", type: "text", required: false }, { label: "Wikipedia username (if any)", type: "text", required: false }],
      registrations: [
        { name: "Tumaini Lema", wikimediaUsername: "Tumaini Lema", email: "tumaini.c@example.com", phone: "+255712003006", gender: "Male", age: "18–24", wikistatus: "new" },
        { name: "Amali Nkya", wikimediaUsername: "Amali Nkya", email: "amali.c@example.com", phone: "+255712003007", gender: "Female", age: "25–34", wikistatus: "new" },
        { name: "Frank Kimaro", wikimediaUsername: "Frank Kimaro", email: "frank.c@example.com", phone: "+255712003008", gender: "Male", age: "35–44", wikistatus: "experienced" },
      ],
    },
  });

  // ── Shared: Volunteers, tasks, announcements, deadlines (not grant-specific) ─
  const vol1 = await add("volunteers", {
    name: "Sarah Laizer", email: "sarah@example.com", phone: "+255712000006",
    wikimediaUsername: "Sarah Laizer", region: "Kilimanjaro",
    skills: ["Wikipedia editing", "Training & facilitation"],
    availability: "Weekends", isActive: true, notes: "Lead facilitator across all grants.",
  });
  const vol2 = await add("volunteers", {
    name: "Peter Ngowi", email: "peter@example.com", phone: "+255712000007",
    wikimediaUsername: "Peter Ngowi", region: "Arusha",
    skills: ["Photography", "Commons uploads"],
    availability: "Flexible", isActive: true, notes: "Event photographer.",
  });
  const vol3 = await add("volunteers", {
    name: "Dorcas Mrema", email: "dorcas@example.com", phone: "+255712000008",
    wikimediaUsername: "Dorcas Mrema", region: "Moshi",
    skills: ["Wikidata", "Research & writing"],
    availability: "Weekdays", isActive: true, notes: "Wikidata specialist.",
  });
  const task1 = await add("volunteerTasks", {
    volunteerId: vol1.id, title: "Prepare slides for Edit-a-thon #2",
    description: "Cover sourcing, notability, and infoboxes.",
    status: "in_progress", dueDate: "2025-11-01", assignedBy: "Admin",
  });
  const task2 = await add("volunteerTasks", {
    volunteerId: vol2.id, title: "Upload Oct event photos to Commons",
    description: "Tag with CC-BY-SA and add to Wikimedia project categories.",
    status: "pending", dueDate: "2025-10-20", assignedBy: "Admin",
  });
  await add("volunteerTasks", {
    volunteerId: vol3.id, title: "Add Wikidata items for new participants",
    description: "Create Wikidata items for participants who created Wikipedia accounts.",
    status: "completed", dueDate: "2025-09-30", assignedBy: "Admin",
  });
  await add("taskComments", {
    taskId: task1.id, authorName: "Sarah Laizer", authorRole: "volunteer",
    text: "Slides are 70% done. Will share draft by Monday.",
  });
  await add("taskComments", {
    taskId: task2.id, authorName: "Peter Ngowi", authorRole: "volunteer",
    text: "Photos uploaded — waiting for licence review.",
  });
  await add("announcements", {
    title: "Q1 report submitted to Wikimedia Foundation",
    body: "Our first quarterly report for GSF 2025–2026 has been submitted. Great work team!",
    author: "Admin",
  });
  await add("announcements", {
    title: "New volunteer orientation — October 18",
    body: "We welcome 3 new volunteers this month. Orientation session on October 18 at 10am.",
    author: "Admin",
  });
  await add("deadlines", {
    title: "Midterm narrative report — GSF 2025–2026",
    type: "report", date: "2026-01-31",
    description: "Submit midterm report via Fluxx portal.",
    owner: "Programme Coordinator",
  });
  await add("deadlines", {
    title: "Final financial report — Rapid Grant",
    type: "financial", date: "2025-07-15",
    description: "Submit all expense documentation to finance officer.",
    owner: "Finance Officer",
  });
}

function SeedButton({ showToast }) {
  const [seeding, setSeeding] = useState(false);
  const run = async () => {
    if (!window.confirm("Insert dummy test data into all collections? This will add records alongside any existing data.")) return;
    setSeeding(true);
    try {
      await seedTestData();
      showToast("Test data inserted — check all pages.");
    } catch (e) {
      showToast("Seed error: " + (e.message || "failed"));
    } finally {
      setSeeding(false);
    }
  };
  return (
    <button className="btn" onClick={run} disabled={seeding}>
      {seeding ? "Inserting…" : "Insert test data into all tables"}
    </button>
  );
}

function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides || {})) {
    const val = overrides[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      result[key] = deepMerge(defaults[key] || {}, val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export default function Settings({ profile, goPage }) {
  const [settings, setSettings] = useState(null);
  const [form,     setForm]     = useState(null);
  const [saved,    setSaved]    = useState(false);
  const [toast,    setToast]    = useState("");
  const [pwdForm,  setPwdForm]  = useState({ current: "", next: "", confirm: "" });
  const [pwdErr,   setPwdErr]   = useState("");
  const [pwdOk,    setPwdOk]    = useState(false);

  const isAdmin = profile?.role === "admin";
  const canEditPayment = ["admin", "finance_officer"].includes(profile?.role);

  useEffect(() => {
    return listenSettings(s => {
      const d = deepMerge(DEFAULT_SETTINGS, s || {});
      setSettings(d);
      setForm(JSON.parse(JSON.stringify(d)));
    });
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (path, val) => {
    setForm(f => {
      const c = JSON.parse(JSON.stringify(f));
      const keys = path.split(".");
      let obj = c;
      keys.slice(0, -1).forEach(k => {
        if (obj[k] == null || typeof obj[k] !== "object") obj[k] = {};
        obj = obj[k];
      });
      obj[keys[keys.length - 1]] = val;
      return c;
    });
  };

  const save = async () => {
    await updateSettings(form);
    await addAudit(profile, AUDIT_ACTIONS.UPDATE, "settings", { details: "Settings updated" });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    showToast("Settings saved.");
  };

  const pwdRules = [
    { label: "At least 8 characters",          test: v => v.length >= 8 },
    { label: "At least one uppercase letter",   test: v => /[A-Z]/.test(v) },
    { label: "At least one lowercase letter",   test: v => /[a-z]/.test(v) },
    { label: "At least one number",             test: v => /[0-9]/.test(v) },
    { label: "At least one special character",  test: v => /[^A-Za-z0-9]/.test(v) },
  ];
  const pwdScore = pwdRules.filter(r => r.test(pwdForm.next)).length;
  const pwdStrong = pwdScore === pwdRules.length;

  const changePwd = async () => {
    setPwdErr("");
    if (!pwdForm.current) { setPwdErr("Current password is required."); return; }
    if (!pwdForm.next)    { setPwdErr("New password is required."); return; }
    if (!pwdStrong) { setPwdErr("Password does not meet the requirements below."); return; }
    if (pwdForm.next !== pwdForm.confirm) { setPwdErr("Passwords do not match."); return; }
    try {
      await changePassword(pwdForm.current, pwdForm.next);
      setPwdOk(true); setPwdForm({ current: "", next: "", confirm: "" });
      await addAudit(profile, AUDIT_ACTIONS.RESET_PASSWORD, "settings", { details: "Password changed by user" });
    } catch (err) {
      setPwdErr(err.message || "Failed to change password.");
    }
  };

  const exportBackup = async () => {
    const users = await getAllUsers();
    const colls = ["activities", "participants", "programs", "budgetEntries", "risks", "registrationForms", "registrations", "auditLogs"];
    const data  = { settings, users, exportedAt: new Date().toISOString() };
    for (const col of colls) {
      const snap = await getDocs(collection(db, col));
      data[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `wkgsf-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    await addAudit(profile, AUDIT_ACTIONS.BACKUP, "settings", { details: "Full data export" });
    showToast("Backup exported.");
  };

  if (!form) return <div className="empty">Loading settings…</div>;

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Settings</div>

      {/* Organisation */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Organisation</div>
        {!isAdmin && <div style={{ fontSize: 12, color: "#888", background: "#f5f4f0", borderRadius: 6, padding: "7px 11px", marginBottom: 12 }}>Organisation details can only be edited by Admin.</div>}
        <div className="form-grid">
          <div className="field"><label>Organisation name</label><input value={form.org?.name || ""} onChange={e => setF("org.name", e.target.value)} disabled={!isAdmin} /></div>
          <div className="field"><label>Country</label><input value={form.org?.country || ""} onChange={e => setF("org.country", e.target.value)} disabled={!isAdmin} placeholder="Tanzania" /></div>
          <div className="field"><label>Contact email</label><input type="email" value={form.org?.contactEmail || ""} onChange={e => setF("org.contactEmail", e.target.value)} disabled={!isAdmin} /></div>
          <div className="field"><label>Website</label><input value={form.org?.website || ""} onChange={e => setF("org.website", e.target.value)} disabled={!isAdmin} placeholder="https://…" /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Meta-Wiki grant page</label><input value={form.org?.metaPage || ""} onChange={e => setF("org.metaPage", e.target.value)} disabled={!isAdmin} placeholder="https://meta.wikimedia.org/…" /></div>
        </div>
        {isAdmin && (
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save settings</button>
            {saved && <span style={{ fontSize: 13, color: "#2d7a4f" }}>✓ Saved</span>}
          </div>
        )}
      </div>

      {/* Payment details */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Payment details</div>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
          Default bank account used to pre-fill new invoices. Each invoice keeps its own copy of these details once created, so editing here only affects future invoices.
        </div>
        {!canEditPayment && <div style={{ fontSize: 12, color: "#888", background: "#f5f4f0", borderRadius: 6, padding: "7px 11px", marginBottom: 12 }}>Payment details can only be edited by Admin or Finance officer.</div>}
        <div className="form-grid">
          <div className="field"><label>Account holder name</label><input value={form.paymentDetails?.accountHolderName || ""} onChange={e => setF("paymentDetails.accountHolderName", e.target.value)} disabled={!canEditPayment} /></div>
          <div className="field"><label>Account holder address</label><input value={form.paymentDetails?.accountHolderAddress || ""} onChange={e => setF("paymentDetails.accountHolderAddress", e.target.value)} disabled={!canEditPayment} /></div>
          <div className="field"><label>Name of financial institution</label><input value={form.paymentDetails?.bankName || ""} onChange={e => setF("paymentDetails.bankName", e.target.value)} disabled={!canEditPayment} /></div>
          <div className="field"><label>Bank branch address</label><input value={form.paymentDetails?.branchAddress || ""} onChange={e => setF("paymentDetails.branchAddress", e.target.value)} disabled={!canEditPayment} /></div>
          <div className="field"><label>Bank account number</label><input value={form.paymentDetails?.accountNumber || ""} onChange={e => setF("paymentDetails.accountNumber", e.target.value)} disabled={!canEditPayment} /></div>
          <div className="field"><label>SWIFT / BIC code</label><input value={form.paymentDetails?.swift || ""} onChange={e => setF("paymentDetails.swift", e.target.value)} disabled={!canEditPayment} /></div>
          <div className="field"><label>Currency</label><input value={form.paymentDetails?.currency || ""} onChange={e => setF("paymentDetails.currency", e.target.value)} disabled={!canEditPayment} placeholder="USD" /></div>
        </div>
        {canEditPayment && (
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save settings</button>
            {saved && <span style={{ fontSize: 13, color: "#2d7a4f" }}>✓ Saved</span>}
          </div>
        )}
      </div>

      {/* Grant — managed in the Grant page */}
      <div className="panel" style={{ marginBottom: 20, background: "#f9fdf9", border: "1px solid #c8e6d4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="panel-title" style={{ marginBottom: 4 }}>Grant configuration</div>
            <div style={{ fontSize: 13, color: "#555" }}>
              Grant details (title, dates, budget, type) are managed in the <strong>Grants</strong> page — the single place for all grant setup.
            </div>
          </div>
          {goPage && (
            <button className="btn btn-primary" onClick={() => goPage("grant")}>
              Go to Grants
            </button>
          )}
        </div>
      </div>

      {/* Team */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Team members</div>
        {(form.team || []).length === 0 ? (
          <div className="empty">No team members configured.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Wikipedia username</th><th>Email</th></tr></thead>
              <tbody>
                {(form.team || []).map((m, i) => (
                  <tr key={i}>
                    <td><input value={m.name || ""} onChange={e => { const t = [...form.team]; t[i] = { ...t[i], name: e.target.value }; setForm(f => ({ ...f, team: t })); }} disabled={!isAdmin} style={{ width: "100%" }} /></td>
                    <td><input value={m.role || ""} onChange={e => { const t = [...form.team]; t[i] = { ...t[i], role: e.target.value }; setForm(f => ({ ...f, team: t })); }} disabled={!isAdmin} style={{ width: "100%" }} /></td>
                    <td><input value={m.username || ""} onChange={e => { const t = [...form.team]; t[i] = { ...t[i], username: e.target.value }; setForm(f => ({ ...f, team: t })); }} disabled={!isAdmin} style={{ width: "100%" }} /></td>
                    <td><input value={m.email || ""} onChange={e => { const t = [...form.team]; t[i] = { ...t[i], email: e.target.value }; setForm(f => ({ ...f, team: t })); }} disabled={!isAdmin} style={{ width: "100%" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isAdmin && (
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setForm(f => ({ ...f, team: [...(f.team || []), { name: "", role: "", username: "", email: "" }] }))}>+ Add team member</button>
            <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
          </div>
        )}
      </div>

      {/* Password change */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Change password</div>
        {pwdOk && <div style={{ color: "#2d7a4f", fontSize: 13, marginBottom: 10 }}>✓ Password changed successfully.</div>}
        {pwdErr && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{pwdErr}</div>}
        <div className="form-grid">
          <div className="field"><label>Current password</label><input type="password" value={pwdForm.current} onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} /></div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={pwdForm.next} onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))} placeholder="Min. 8 characters" />
            {pwdForm.next && (
              <div style={{ marginTop: 8 }}>
                {/* Strength bar */}
                <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                  {pwdRules.map((_, i) => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < pwdScore ? (pwdScore <= 2 ? "#c0392b" : pwdScore <= 3 ? "#d97706" : "#2d7a4f") : "#e0e0e0", transition: "background 0.2s" }} />
                  ))}
                </div>
                {/* Rule checklist */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {pwdRules.map(r => (
                    <div key={r.label} style={{ fontSize: 11, color: r.test(pwdForm.next) ? "#2d7a4f" : "#aaa", display: "flex", alignItems: "center", gap: 5 }}>
                      <span>{r.test(pwdForm.next) ? "✓" : "○"}</span> {r.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="field"><label>Confirm new password</label><input type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} /></div>
        </div>
        <button className="btn btn-primary" onClick={changePwd} disabled={pwdForm.next && !pwdStrong}>Change password</button>
      </div>

      {/* SMS Notifications — Africa's Talking */}
      {isAdmin && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">SMS notifications (Africa's Talking)</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.6 }}>
            Configure Africa's Talking to send SMS alerts for task assignments and deadline reminders.
            Get credentials at <strong>africastalking.com</strong>. Use Sandbox mode for testing.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <input type="checkbox" id="smsEnabled" checked={form.sms?.enabled || false} onChange={e => setF("sms.enabled", e.target.checked)} />
            <label htmlFor="smsEnabled" style={{ fontSize: 13 }}>Enable SMS notifications</label>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>AT Username</label>
              <input value={form.sms?.atUsername || ""} onChange={e => setF("sms.atUsername", e.target.value)} placeholder="e.g. wikikilimanjaro" />
            </div>
            <div className="field">
              <label>AT API Key</label>
              <input type="password" value={form.sms?.atApiKey || ""} onChange={e => setF("sms.atApiKey", e.target.value)} placeholder="Your Africa's Talking API key" />
            </div>
            <div className="field">
              <label>Sender ID (optional)</label>
              <input value={form.sms?.atSenderId || ""} onChange={e => setF("sms.atSenderId", e.target.value)} placeholder="e.g. WikiKili (max 11 chars)" />
            </div>
            <div className="field">
              <label>Mode</label>
              <select value={form.sms?.sandbox ? "sandbox" : "live"} onChange={e => setF("sms.sandbox", e.target.value === "sandbox")}>
                <option value="sandbox">Sandbox (testing)</option>
                <option value="live">Live (production)</option>
              </select>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save SMS settings</button>
          </div>
        </div>
      )}

      {/* Data export — admin only */}
      {isAdmin && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">Data management</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>Export a full backup of all Firestore data as a JSON file.</div>
          <button className="btn" onClick={exportBackup}>↓ Export full backup (JSON)</button>
        </div>
      )}

      {/* Developer tools — admin only */}
      {isAdmin && (
        <div className="panel" style={{ marginBottom: 20, border: "1px solid #c8e6d4", background: "#f9fdf9" }}>
          <div className="panel-title">Developer tools</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            Insert dummy records into every collection to verify the database is connected and all pages receive data correctly. Safe to run alongside existing data.
          </div>
          <SeedButton showToast={showToast} />
        </div>
      )}

      {/* Danger zone — admin only */}
      {isAdmin && (
        <div className="panel" style={{ border: "2px solid #f87171", background: "#fff8f8" }}>
          <div className="panel-title" style={{ color: "#c0392b" }}>Danger zone</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 1.6 }}>
            Permanently delete <strong>all data</strong> in the system — activities, participants, programs, budget entries, registration forms, registrations, risks, announcements, deadlines, and metrics. Grants and user accounts are kept. <strong>This cannot be undone.</strong>
          </div>
          <WipeAllButton profile={profile} showToast={showToast} />
        </div>
      )}
    </div>
  );
}
