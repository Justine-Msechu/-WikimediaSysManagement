import React, { useState } from "react";

const STEPS = {
  admin: [
    {
      icon: "👋",
      title: "Welcome to WikiKilimanjaro GSF Manager",
      body: "You are signed in as Admin — you have full access to all features. This short guide will walk you through the key parts of the system.",
    },
    {
      icon: "◇",
      title: "Start with a Grant",
      body: "Go to Grant in the sidebar to create your first grant record (e.g. R-GS-2606-22863). Everything else — programs, activities, budget, reports — lives inside a grant. Create the grant before inviting your team.",
    },
    {
      icon: "◈",
      title: "Programs & Activities",
      body: "Coordinators will create Programs (e.g. Wiki Malkia, School Kiwix Outreach) and log Activities under each one. You review and approve programs before they become official. Activities record attendance, Wikipedia contributions, and costs.",
    },
    {
      icon: "◎",
      title: "Budget",
      body: "Finance officers add budget entries under Personnel, Operational, or Programmatic categories. They submit entries for your approval. You can approve, reject, or send back with a comment.",
    },
    {
      icon: "◯",
      title: "Manage your team",
      body: "Go to Users to create accounts for your coordinators, finance officers, and volunteers. Each person gets an email to set their own password. Assign the right role — it controls exactly what they can see and do.",
    },
    {
      icon: "▤",
      title: "When the grant is done",
      body: "The Final Report page auto-compiles the Wikimedia GSF Final Learning Report from all your data. Copy and paste it directly into Fluxx. The Audit log records every action your team took throughout the year.",
    },
  ],
  coordinator: [
    {
      icon: "",
      title: "Welcome to WikiKilimanjaro GSF Manager",
      body: "You are signed in as Coordinator. You create programs, log activities, and manage participants and volunteers. This guide covers the key steps.",
    },
    {
      icon: "◈",
      title: "Create Programs",
      body: "Go to Programs and click '+ Add program'. Give it a name (e.g. 'Wiki Malkia Session'), description, and target metrics. Once ready, click 'Submit for review' — your admin will approve it. Approved programs appear in the final report.",
    },
    {
      icon: "◉",
      title: "Log Activities",
      body: "After each event, go to Activities and click '+ Log activity'. Record the date, location, number of participants, Wikipedia articles created or improved, and a short summary. This is the most important data for your grant report.",
    },
    {
      icon: "◐",
      title: "Participants & Volunteers",
      body: "Add participants (event attendees) to the Participants registry — manually or by importing from a registration form. For your organising team, use Volunteers. You can assign tasks to volunteers and track their progress.",
    },
    {
      icon: "◫",
      title: "Registration forms",
      body: "Create a public sign-up link under Reg. forms. Share the link for any event — people register without needing an account. After the event, import the responses into the participant registry with one click.",
    },
  ],
  finance_officer: [
    {
      icon: "",
      title: "Welcome to WikiKilimanjaro GSF Manager",
      body: "You are signed in as Finance Officer. You manage grant expenses, track the budget, and approve financial submissions. Here is a quick overview.",
    },
    {
      icon: "◎",
      title: "Add budget entries",
      body: "Go to Budget and click '+ Add entry' for each expense. Choose the category (Personnel, Operational, or Programmatic), enter the amount in TZS, and add a description. Submit the entry for approval when it is ready.",
    },
    {
      icon: "✓",
      title: "Review & approve",
      body: "The Review page shows all submitted budget entries and programs waiting for approval. Read the details and click Approve or Reject. A comment is required when rejecting so the submitter knows what to fix.",
    },
    {
      icon: "▤",
      title: "Reports",
      body: "The Final Report and Donor Report pages compile your financial data automatically. Use these for grant submissions and presentations to the Wikimedia Foundation.",
    },
  ],
  viewer: [
    {
      icon: "",
      title: "Welcome to WikiKilimanjaro GSF Manager",
      body: "You are signed in as Viewer. You have read-only access — you can see all data but cannot edit anything. This is useful for following the grant's progress without risk of changing records.",
    },
    {
      icon: "⊞",
      title: "Dashboard & Metrics",
      body: "The Dashboard shows a live summary of the grant: activities completed, participants reached, budget used, and progress toward targets. The Metrics page shows detailed target vs result comparisons.",
    },
    {
      icon: "▤",
      title: "Reports",
      body: "The Final Report and Donor Report pages show the compiled grant narrative and financial summary. You can read but not edit these reports.",
    },
  ],
  volunteer: [
    {
      icon: "",
      title: "Welcome to WikiKilimanjaro GSF Manager",
      body: "You are signed in as Volunteer. This portal is your personal workspace — you can see your tasks, read announcements, and check upcoming deadlines.",
    },
    {
      icon: "✓",
      title: "My Tasks",
      body: "The My Tasks page shows all tasks assigned to you by your coordinator. Update the status as you work: To do, In progress, Done. You can also add comments to a task to communicate progress.",
    },
    {
      icon: "📢",
      title: "Announcements & Deadlines",
      body: "Check Announcements for team news and important updates from your coordinators. Check Deadlines for upcoming dates you need to know about — event days, submission deadlines, and milestones.",
    },
  ],
};

export default function OnboardingModal({ profile, onDismiss }) {
  const role  = profile?.role || "viewer";
  const steps = STEPS[role] || STEPS.viewer;
  const [step, setStep] = useState(0);

  const isLast = step === steps.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 2000, padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        maxWidth: 480, width: "100%", padding: "36px 32px 28px",
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        {/* Step dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {steps.map((_, i) => (
            <div
              key={i}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 22 : 8, height: 8,
                borderRadius: 4, cursor: "pointer",
                background: i === step ? "#2d7a4f" : "#d0d0c8",
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>{steps[step].icon}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1c2b1e", marginBottom: 12 }}>
            {steps[step].title}
          </div>
          <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, margin: 0 }}>
            {steps[step].body}
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{ flex: 1, padding: "10px 0", background: "#f5f4f0", border: "1.5px solid #d0d0c8", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#555" }}
            >
              ← Back
            </button>
          )}
          {!isLast ? (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{ flex: 2, padding: "10px 0", background: "#2d7a4f", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff" }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={onDismiss}
              style={{ flex: 2, padding: "10px 0", background: "#2d7a4f", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff" }}
            >
              Got it, let's go
            </button>
          )}
        </div>

        <button
          onClick={onDismiss}
          style={{ background: "none", border: "none", fontSize: 12, color: "#aaa", cursor: "pointer", padding: 0 }}
        >
          Skip guide
        </button>
      </div>
    </div>
  );
}
