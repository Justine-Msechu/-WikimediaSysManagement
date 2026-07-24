export const fmt = (n) => Number(n || 0).toLocaleString();
export const pct = (a, b) => (b ? Math.min(Math.round((a / b) * 100), 999) : 0);
export const today = () => new Date().toISOString().slice(0, 10);

export const ACTIVITY_TYPES = [
  "Edit-a-thon",
  "Wiki Malkia session",
  "Mentorship session",
  "School outreach / Kiwix",
  "Training workshop",
  "Community gathering",
  "Let's Connect session",
  "Campaign (Wiki Loves Africa etc.)",
  "Error-fix campaign",
  "Other",
];

export const BUDGET_CATS = [
  { key: "personnel", label: "Personnel costs" },
  { key: "operational", label: "Operational costs" },
  { key: "programmatic", label: "Programmatic costs" },
];

export const PROGRAM_CATS = [
  "Education",
  "Culture, heritage or GLAM",
  "Gender and diversity",
  "Community support and engagement",
  "Participation in campaigns and contests",
  "Public policy advocacy",
  "Technology (software development)",
  "Other",
];

export const MS_OPTIONS = [
  "Increase sustainability",
  "Improve user experience",
  "Provide for safety and inclusion",
  "Ensure equity in decision-making",
  "Coordinate across stakeholders",
  "Invest in skills and leadership",
  "Manage internal knowledge",
  "Identify topics for impact",
  "Innovate in free knowledge",
  "Evaluate, iterate and adapt",
];

export function buildActivityReport(activity) {
  const wPct = activity.participants
    ? Math.round((activity.women / activity.participants) * 100)
    : 0;
  return `ACTIVITY REPORT
═══════════════════════════════════════════
Activity: ${activity.name}
Type: ${activity.type}
Date: ${activity.date}
Location: ${activity.location}
Reported by: ${activity.reportedBy || "Team"}
───────────────────────────────────────────
PARTICIPATION
  Total participants:  ${activity.participants}
  Women:               ${activity.women} (${wPct}%)
  New editors:         ${activity.newEditors}
  Youth (under 30):    ${activity.youth || 0}
  PWD:                 ${activity.pwd || 0}

CONTENT CONTRIBUTIONS
  Articles created:    ${fmt(activity.created)}
  Articles improved:   ${fmt(activity.improved)}
  Commons uploads:     ${fmt(activity.commons || 0)}
  Wikidata items:      ${fmt(activity.wikidata || 0)}
  Outreach Dashboard:  ${activity.link || "N/A"}

BUDGET
  Cost (TZS):          ${fmt(activity.cost)}
  Budget category:     ${activity.budgetCat || "Programmatic costs"}

SUMMARY
${activity.summary || "(No summary provided)"}

CHALLENGES
${activity.challenges || "(None reported)"}

LESSONS LEARNED
${activity.lessons || "(None reported)"}

IMPACT STORIES
${activity.stories || "(None recorded)"}

NEXT STEPS
${activity.nextSteps || "(None planned)"}
═══════════════════════════════════════════
Generated: ${new Date().toLocaleString()}`;
}

export function compileGrantReport(state) {
  const acts = state.activities || [];
  const totalPart = state.metrics.participants.result;
  const totalWomen = acts.reduce((a, x) => a + Number(x.women || 0), 0);
  const wPct = totalPart ? Math.round((totalWomen / totalPart) * 100) : 0;
  const totalSpent = Object.values(state.budget.spent).reduce((a, b) => a + b, 0);
  const proj = state.metrics.projects[0];
  const actList = acts
    .map(
      (a) =>
        `• ${a.name} (${a.date}, ${a.location}): ${a.participants} participants, ${fmt(a.created)} articles created. ${a.summary ? a.summary.substring(0, 120) + "…" : ""}`
    )
    .join("\n");

  return {
    part1q1: `Our programs, approaches, and strategies contributed significantly to addressing the challenges outlined in our proposal — including limited Swahili content, low digital skills, gender imbalance, and weak community connection.

We organized ${acts.length} activities including monthly edit-a-thons, Wiki Malkia sessions for women contributors, school Kiwix outreach, mentorship programs, and Let's Connect peer learning gatherings.

Activities conducted:
${actList || "(Log activities to populate this section)"}

Through these efforts, we created ${fmt(proj.rCreated)} new Wikipedia articles and improved ${fmt(proj.rImproved)} articles — ${pct(proj.rCreated, proj.tCreated)}% of our creation target and ${pct(proj.rImproved, proj.tImproved)}% of our improvement target.

Women accounted for approximately ${wPct}% of participants overall.

Key challenges and responses:
1. Low-quality articles from new contributors → Introduced mentorship pairing and the "There Is an Error, Fix and Contribute" campaign.
2. Low women's participation → Launched Wiki Malkia dedicated safe spaces with mentorship and leadership training.
3. Internet access in rural schools → Partnered with Reneal International Education Outreach to install Kiwix offline Wikipedia servers.`,

    part1q2: `Yes. Plans for the next cycle include:
1. Continue monthly edit-a-thons focused on Swahili and Kilimanjaro region content.
2. Expand Wiki Malkia with more leadership trainings and contributor recognition.
3. Continue Feminism and Folklore Tanzania and Wiki Loves Africa campaigns.
4. Grow Let's Connect hub to include more Tanzanian Wikimedia groups.
5. Expand Kiwix school outreach with Reneal to more schools in rural areas.
6. Invest in digital storytelling and documentation skills to share impact globally.`,

    part2metrics: `Participants & editors:
  All participants — Target: ${state.metrics.participants.target}, Result: ${state.metrics.participants.result}
  All editors — Target: ${state.metrics.allEditors.target}, Result: ${state.metrics.allEditors.result}
  New editors — Target: ${state.metrics.newEditors.target}, Result: ${state.metrics.newEditors.result}
  Retained editors — Target: ${state.metrics.retainedEditors.target}, Result: ${state.metrics.retainedEditors.result}
  All organizers — Target: ${state.metrics.allOrganizers.target}, Result: ${state.metrics.allOrganizers.result}
  New organizers — Target: ${state.metrics.newOrganizers.target}, Result: ${state.metrics.newOrganizers.result}

Wikimedia project contributions:
${state.metrics.projects
  .map(
    (p) =>
      `  ${p.name}: Created ${fmt(p.rCreated)} (target ${fmt(p.tCreated)}, ${pct(p.rCreated, p.tCreated)}%), Improved ${fmt(p.rImproved)} (target ${fmt(p.tImproved)}, ${pct(p.rImproved, p.tImproved)}%)`
  )
  .join("\n")}`,

    part3skills: `The grant enabled significant skill development across our team:
- Leadership and community organizing through Let's Connect peer learning.
- Conflict resolution and inclusive communication training.
- Project and financial management improvement.
- Mentorship and coaching skills to support newcomers, especially women.
- Digital education tools training with Reneal Outreach for Kiwix use in schools.

Our leadership team includes a majority of women and youth who grew from volunteers into leaders through mentorship. No declared conflicts of interest.

Next year focus: Storytelling and digital documentation — through workshops, video training, and collaboration with Wikimedia movement mentors.`,

    part4finance: `Local currency: TZS
Total amount spent: ${fmt(totalSpent)} TZS

Budget breakdown:
  Personnel costs — Planned: ${fmt(state.budget.planned.personnel)}, Spent: ${fmt(state.budget.spent.personnel)}
  Operational costs — Planned: ${fmt(state.budget.planned.operational)}, Spent: ${fmt(state.budget.spent.operational)}
  Programmatic costs — Planned: ${fmt(state.budget.planned.programmatic)}, Spent: ${fmt(state.budget.spent.programmatic)}

Total from Wikimedia Foundation: ${fmt(state.budget.total)} TZS
Total spent: ${fmt(totalSpent)} TZS
Unspent: ${state.budget.total - totalSpent > 0 ? fmt(state.budget.total - totalSpent) + " TZS" : "None"}

Other revenue sources: ${state.budget.otherRevenue ? "Yes — " + state.budget.otherRevenueDetails : "No"}

Compliance with fund agreement: Yes
Compliance with applicable laws and regulations: Yes
Compliance with US IRS Code provisions: Yes`,
  };
}
