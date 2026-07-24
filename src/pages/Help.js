import React, { useState } from "react";

const SECTIONS = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "⊞",
    roles: null,
    desc: "Your home screen. Shows key stats at a glance: total participants, activities completed, budget used, and progress toward grant targets. Use it to quickly spot what needs attention.",
  },
  {
    id: "announcements",
    title: "Announcements",
    icon: "📢",
    roles: null,
    desc: "Team-wide news and updates posted by coordinators and admins. Check here for important notices about upcoming events, changes, or reminders.",
  },
  {
    id: "deadlines",
    title: "Deadlines",
    icon: "⏰",
    roles: null,
    desc: "A list of upcoming reporting deadlines, submission dates, and milestones for the grant cycle. Coordinators and admins can add deadlines; everyone can view them.",
  },
  {
    id: "grant",
    title: "Grant",
    icon: "◇",
    roles: ["admin"],
    desc: "Create and manage grant records (e.g. R-GS-2606-22863). Each grant holds all its own programs, activities, budget, and reports. Admins create grants here before any other work begins.",
  },
  {
    id: "programs",
    title: "Programs",
    icon: "◈",
    roles: null,
    desc: "Programs are the named activities in your grant plan (e.g. \"Wiki Malkia\", \"School Kiwix Outreach\"). Coordinators create programs and submit them for admin approval. Once approved, they appear in reports.",
    steps: [
      "Click '+ Add program' to create a new program.",
      "Fill in the name, description, dates, and target metrics.",
      "Click 'Submit for review' when ready — an admin will approve or reject it.",
      "Approved programs are locked and feed into the final report.",
    ],
  },
  {
    id: "activities",
    title: "Activities",
    icon: "◉",
    roles: null,
    desc: "Log every event your team runs — edit-a-thons, training sessions, school visits, etc. Each activity records attendance, Wikipedia contributions, and budget spend.",
    steps: [
      "Click '+ Log activity' and select the program it belongs to.",
      "Enter the date, location, number of participants (total, women, new editors, youth, PWD).",
      "Add content contributions: articles created/improved, Commons uploads, Wikidata items.",
      "Write a brief narrative: summary, challenges, lessons learned.",
      "Save — the activity is now part of the grant record and feeds into the final report.",
    ],
  },
  {
    id: "participants",
    title: "Participants",
    icon: "◐",
    roles: ["admin", "coordinator"],
    desc: "A registry of everyone who has attended your events. Each record stores name, Wikipedia username, contact details, and which activities they attended. You can also import participants from registration forms or a CSV file.",
    steps: [
      "Add participants manually via '+ Add participant'.",
      "Or import from a public registration form or a CSV spreadsheet.",
      "Participants can be linked to a Wikipedia account so their contributions can be tracked.",
      "Use the search and filter to find specific people quickly.",
    ],
  },
  {
    id: "volunteers",
    title: "Volunteers",
    icon: "◎",
    roles: ["admin", "coordinator"],
    desc: "A separate registry for your volunteer team. Volunteers are different from participants — they help organise events. Each volunteer can be linked to a system login account so they can see their task list.",
    steps: [
      "Add a volunteer via '+ Add volunteer'.",
      "Assign skills, availability, and the programs they support.",
      "Create tasks and assign them to volunteers — they will see the tasks in 'My tasks'.",
      "Track task progress from the volunteer's profile card.",
    ],
  },
  {
    id: "register",
    title: "Registration forms",
    icon: "◫",
    roles: ["admin", "coordinator"],
    desc: "Create a public sign-up link for any event. Share the link with the public — people fill in their name and Wikipedia username without needing a system account. Responses are stored and can be imported into Participants.",
    steps: [
      "Click '+ New form' and enter the event title, date, and location.",
      "Copy the public link and share it via WhatsApp, email, or social media.",
      "View responses in the form's response list.",
      "Click 'Import to participants' to add respondents to the participant registry.",
    ],
  },
  {
    id: "budget",
    title: "Budget",
    icon: "◎",
    roles: null,
    desc: "Track all grant income and spending. Budget entries are categorised as Personnel, Operational, or Programmatic costs. Finance officers add entries and submit them for approval. Admins and finance officers can approve or reject.",
    steps: [
      "Click '+ Add entry' to record an expense.",
      "Choose the correct budget category and enter the amount in TZS.",
      "Submit the entry for approval — a finance officer or admin must approve it.",
      "Approved entries count toward the grant's financial report.",
    ],
  },
  {
    id: "review",
    title: "Review",
    icon: "✓",
    roles: null,
    desc: "A queue of items waiting for approval — program submissions and budget entries. Admins and finance officers review and approve or reject items here. Coordinators can see the status of their own submissions.",
  },
  {
    id: "metrics",
    title: "Metrics",
    icon: "◑",
    roles: null,
    desc: "Tracks your grant targets vs actual results: participants, editors, organizers, and Wikimedia project contributions. Coordinators update the results here as activities are completed.",
  },
  {
    id: "risks",
    title: "Risk register",
    icon: "◬",
    roles: ["admin", "coordinator", "finance_officer"],
    desc: "A log of risks to the grant — financial, operational, or external. Each risk has a likelihood, impact, and mitigation plan. Kept as evidence of good grant management.",
  },
  {
    id: "report",
    title: "Final report",
    icon: "▤",
    roles: null,
    desc: "Auto-compiles the Wikimedia GSF Final Learning Report (Parts 1–4) from all the data entered in the system. When grant activities are complete, use this page to review and copy the report text ready to paste into Fluxx.",
  },
  {
    id: "donor",
    title: "Donor report",
    icon: "◌",
    roles: ["admin", "finance_officer"],
    desc: "A summary dashboard for the Wikimedia Foundation showing key outcomes and financials. Used for donor presentations and grant review meetings.",
  },
  {
    id: "audit",
    title: "Audit log",
    icon: "☰",
    roles: ["admin"],
    desc: "A tamper-proof record of every significant action in the system — who created, edited, approved, or deleted any record, and when. Admin-only. Used to ensure accountability and for grant compliance.",
  },
  {
    id: "users",
    title: "Users",
    icon: "◯",
    roles: ["admin"],
    desc: "Create and manage team login accounts. Assign roles (Admin, Coordinator, Finance Officer, Viewer, Volunteer). Each role controls what the person can see and do in the system.",
    steps: [
      "Click '+ Add user' and enter the person's name, email, and role.",
      "The system sends them a password-setup email automatically.",
      "You can deactivate a user to block their access without deleting them.",
      "Volunteer accounts can be linked to a volunteer record so they see their tasks.",
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: "⚙",
    roles: null,
    desc: "Configure organisation details, grant information, and report settings. Admins can also seed the system with initial data, export a full data backup, and change their password.",
  },
  {
    id: "mytasks",
    title: "My tasks",
    icon: "✓",
    roles: ["volunteer"],
    desc: "A personal view of all tasks assigned to you by your coordinator. Update task status (To do, In progress, Done) as you work. You can also add comments to each task.",
  },
];

const ROLE_LABELS = {
  admin:           "Admin",
  coordinator:     "Coordinator",
  finance_officer: "Finance Officer",
  viewer:          "Viewer",
  volunteer:       "Volunteer",
};

export default function Help({ profile }) {
  const role = profile?.role || "viewer";
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const myAccess = (s) => !s.roles || s.roles.includes(role);

  const visible = SECTIONS.filter(s =>
    !search ||
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-title">Help &amp; guide</div>
      <div className="page-sub">
        You are signed in as <strong>{ROLE_LABELS[role]}</strong>. Sections marked with a lock are not available for your role.
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search topics…"
        style={{ width: "100%", fontSize: 13, marginBottom: 20, padding: "8px 12px", border: "1.5px solid #d0d0c8", borderRadius: 7, boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map(s => {
          const hasAccess = myAccess(s);
          const open = expanded === s.id;
          return (
            <div
              key={s.id}
              className="panel"
              style={{ padding: 0, opacity: hasAccess ? 1 : 0.5, border: open ? "2px solid #4a9e6b" : undefined }}
            >
              <button
                onClick={() => setExpanded(open ? null : s.id)}
                style={{ width: "100%", background: "none", border: "none", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: 20, minWidth: 28 }}>{s.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#1c2b1e", flex: 1 }}>{s.title}</span>
                {!hasAccess && <span style={{ fontSize: 11, color: "#aaa" }}>🔒 not available for your role</span>}
                {s.roles && hasAccess && (
                  <span style={{ fontSize: 10, color: "#888", background: "#f5f4f0", padding: "2px 8px", borderRadius: 10 }}>
                    {s.roles.map(r => ROLE_LABELS[r]).join(", ")}
                  </span>
                )}
                <span style={{ fontSize: 12, color: "#4a9e6b", minWidth: 16 }}>{open ? "▲" : "▼"}</span>
              </button>

              {open && (
                <div style={{ padding: "0 18px 18px", borderTop: "1px solid #f0f0ec" }}>
                  <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>{s.desc}</p>
                  {s.steps && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>How to use</div>
                      <ol style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        {s.steps.map((step, i) => (
                          <li key={i} style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24, padding: "14px 18px", background: "#f0f8f3", border: "1px solid #b7e0c8", borderRadius: 10, fontSize: 13, color: "#2d7a4f" }}>
        <strong>Need more help?</strong> Contact your system administrator or the Wikimedians of Kilimanjaro team at <a href="mailto:justinemsechu@gmail.com" style={{ color: "#2d7a4f" }}>justinemsechu@gmail.com</a>.
      </div>
    </div>
  );
}
