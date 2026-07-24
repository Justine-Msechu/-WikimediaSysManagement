export const fmt = (n) => Number(n || 0).toLocaleString();

export const OD_BASE = "https://outreachdashboard.wmflabs.org";

// "2026–2027" → "wikimedia_community_kilimanjaro_20262027_programs"
export function getODSlug(grantCycle) {
  const digits = (grantCycle || "").replace(/\D/g, "");
  return `wikimedia_community_kilimanjaro_${digits}_programs`;
}
export const fmtUSD = (n) => `$${Number(n || 0).toFixed(2)}`;
export const pct = (a, b) => (b ? Math.min(Math.round((a / b) * 100), 999) : 0);
export const today = () => new Date().toISOString().slice(0, 10);

export const PROGRAM_CATS_FLUXX = [
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

export function activityTotalTZS(activity) {
  return (activity.expenses || []).reduce((sum, e) => {
    const line = e.units > 0 ? e.units * e.unitCostTZS : e.totalTZS;
    return sum + (Number(line) || 0);
  }, 0);
}

export function activityTotalUSD(activity) {
  const rate = Number(activity.conversionRate) || 0;
  return activityTotalTZS(activity) * rate;
}

export function programStats(programId, activities) {
  const acts = activities.filter(a => a.programId === programId);
  const completed = acts.filter(a => a.status === "Completed").length;
  const totalTZS = acts.reduce((s, a) => s + activityTotalTZS(a), 0);
  const totalUSD = acts.reduce((s, a) => s + activityTotalUSD(a), 0);
  const totalParticipants = acts.reduce((s, a) => s + (Number(a.totalParticipants) || 0), 0);
  return { count: acts.length, completed, totalTZS, totalUSD, totalParticipants };
}

export function buildActivityReport(activity, program) {
  const progName = program ? program.name : "Unknown program";
  const totalTZS = activityTotalTZS(activity);
  const totalUSD = activityTotalUSD(activity);
  const wPct = activity.totalParticipants
    ? Math.round((Number(activity.women || 0) / Number(activity.totalParticipants)) * 100) : 0;

  const expenseLines = (activity.expenses || [])
    .filter(e => (e.units > 0 ? e.units * e.unitCostTZS : e.totalTZS) > 0)
    .map(e => {
      const lineTZS = e.units > 0 ? e.units * e.unitCostTZS : e.totalTZS;
      const lineUSD = lineTZS * (Number(activity.conversionRate) || 0);
      return `  ${e.description.padEnd(28)} ${fmt(lineTZS).padStart(12)} TZS  ($${lineUSD.toFixed(2)})`;
    }).join("\n");

  return `WIKIMEDIA COMMUNITY KILIMANJARO: ACTIVITY REPORT
${"═".repeat(52)}
Program:      ${progName}
Activity:     ${activity.title}
Date:         ${activity.date}
Location:     ${activity.location || "N/A"}
Reported by:  ${activity.reportedBy || "Team"}
Status:       ${activity.status}
${"─".repeat(52)}
PARTICIPATION
  Total participants:  ${activity.totalParticipants || 0}
  Women:               ${activity.women || 0} (${wPct}%)
  Youth (under 30):    ${activity.youth || 0}
  PWD:                 ${activity.pwd || 0}
  New editors:         ${activity.newEditors || 0}

CONTENT CONTRIBUTIONS
  Wikipedia created:   ${fmt(activity.wpCreated || 0)}
  Wikipedia improved:  ${fmt(activity.wpImproved || 0)}
  Commons uploaded:    ${fmt(activity.commonsUploaded || 0)}
  Wikidata items:      ${fmt(activity.wikidataItems || 0)}
  Meta-Wiki link:      ${activity.metaLink || "N/A"}
  Photos link:         ${activity.photosLink || "N/A"}

EXPENSES (conversion rate: ${activity.conversionRate || "N/A"} TZS/USD)
${expenseLines || "  (No expenses logged)"}
  ${"─".repeat(50)}
  TOTAL                         ${fmt(totalTZS).padStart(12)} TZS  ($${totalUSD.toFixed(2)})

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
${"═".repeat(52)}
Generated: ${new Date().toLocaleString()}`;
}

export function compileGrantReport(state) {
  const acts = state.activities || [];
  const programs = state.programs || [];
  const completed = acts.filter(a => a.status === "Completed");
  const totalUSD = acts.reduce((s, a) => s + activityTotalUSD(a), 0);
  const totalTZSAll = acts.reduce((s, a) => s + activityTotalTZS(a), 0);
  const m = state.metrics;
  const ans = state.reportAnswers || {};
  const g = state.grant || {};

  // Per-program narrative block for Q1
  const progNarratives = programs.map(p => {
    const progActs = completed.filter(a => a.programId === p.id);
    if (progActs.length === 0) return null;
    const stats = programStats(p.id, acts);
    const lines = progActs.map(a => {
      const parts = [`  • ${a.title} (${a.date}${a.location ? ", " + a.location : ""}), ${a.totalParticipants || 0} participants`];
      if (a.summary)    parts.push(`    Summary: ${a.summary}`);
      if (a.challenges) parts.push(`    Challenges: ${a.challenges}`);
      if (a.nextSteps)  parts.push(`    Next steps: ${a.nextSteps}`);
      return parts.join("\n");
    }).join("\n\n");
    return `${p.name} (${p.category}) - ${stats.completed}/${p.plannedSessions} sessions, ${stats.totalParticipants} participants, $${stats.totalUSD.toFixed(0)} spent\n${lines}`;
  }).filter(Boolean).join("\n\n─────────────────────────────────────────\n\n");

  // Lessons + impact stories for Q2
  const lessonsBlock = completed
    .filter(a => a.lessons || a.stories)
    .map(a => {
      const parts = [`  ${a.title} (${a.date})`];
      if (a.lessons) parts.push(`  Lessons: ${a.lessons}`);
      if (a.stories) parts.push(`  Impact story: ${a.stories}`);
      return parts.join("\n");
    }).join("\n\n") || "  (No lessons or stories recorded yet)";

  // Diversity stats for Q6.1
  const totalPart = completed.reduce((s, a) => s + Number(a.totalParticipants || 0), 0);
  const totalWomen = completed.reduce((s, a) => s + Number(a.women || 0), 0);
  const totalYouth = completed.reduce((s, a) => s + Number(a.youth || 0), 0);
  const totalPWD   = completed.reduce((s, a) => s + Number(a.pwd || 0), 0);
  const totalNew   = completed.reduce((s, a) => s + Number(a.newEditors || 0), 0);
  const wPct = totalPart ? Math.round((totalWomen / totalPart) * 100) : 0;

  // Meta / photo links for Q3
  const metaLinks = completed
    .filter(a => a.metaLink || a.photosLink)
    .map(a => `  ${a.title}: ${[a.metaLink, a.photosLink].filter(Boolean).join(" | ")}`)
    .join("\n") || "  (No links recorded yet)";

  // Finance detail per program
  const progFinance = programs.map(p => {
    const stats = programStats(p.id, acts);
    const pTZS = acts.filter(a => a.programId === p.id).reduce((s, a) => s + activityTotalTZS(a), 0);
    return `  ${p.name}: ${fmt(pTZS)} TZS ($${stats.totalUSD.toFixed(2)}) : ${stats.completed} sessions`;
  }).join("\n");

  return {
    part1q1: `${ans.q1 || "(Not yet written. Write your narrative above, then the auto-data below feeds into it)"}

════════════════════════════════════════════════
AUTO-GENERATED FROM ACTIVITY LOGS
${g.cycle || "2026–2027"} · ${completed.length} of ${acts.length} activities completed · ${state.programs?.length || 0} programs
════════════════════════════════════════════════

${progNarratives || "(No completed activities yet)"}`,

    part1q2: `${ans.q2 || "(Not yet written)"}

════════════════════════════════════════════════
LESSONS & IMPACT STORIES FROM ACTIVITY LOGS
════════════════════════════════════════════════

${lessonsBlock}`,

    part1q3_q6: `Q3 – Links to documentation:
${metaLinks}
  Organisation Meta-Wiki: ${state.org?.metaPage || "(Not set)"}
${ans.q3 ? "\nAdditional: " + ans.q3 : ""}

Q4 – Sharing broadly:
${ans.q4 || "(Not yet written)"}

Q5 – Measuring impact:
${ans.q5 || "(Not yet written)"}

Q6.1 – Diversity in participants and leadership:
From activity logs (${completed.length} completed activities):
  Total participants:  ${fmt(totalPart)}
  Women:               ${fmt(totalWomen)} (${wPct}%)
  Youth (under 30):    ${fmt(totalYouth)}
  PWD:                 ${fmt(totalPWD)}
  New editors:         ${fmt(totalNew)}
${ans.q6_1 ? "\nNarrative: " + ans.q6_1 : ""}

Q6.2 – Diverse content:
${ans.q6_2 || "(Not yet written)"}

Q6.3 – Retaining underrepresented groups:
${ans.q6_3 || "(Not yet written)"}`,

    part2metrics: `Participants & editors (target vs result):
  All participants   :  Target: ${m.participants.target},    Result: ${m.participants.result}   (${pct(m.participants.result, m.participants.target)}%)
  All editors        :  Target: ${m.allEditors.target},     Result: ${m.allEditors.result}   (${pct(m.allEditors.result, m.allEditors.target)}%)
  New editors        :  Target: ${m.newEditors.target},     Result: ${m.newEditors.result}   (${pct(m.newEditors.result, m.newEditors.target)}%)
  Retained editors   :  Target: ${m.retainedEditors.target}, Result: ${m.retainedEditors.result}   (${pct(m.retainedEditors.result, m.retainedEditors.target)}%)
  All organizers     :  Target: ${m.allOrganizers.target},  Result: ${m.allOrganizers.result}   (${pct(m.allOrganizers.result, m.allOrganizers.target)}%)
  New organizers     :  Target: ${m.newOrganizers.target},  Result: ${m.newOrganizers.result}   (${pct(m.newOrganizers.result, m.newOrganizers.target)}%)

Wikimedia project contributions (target vs result):
${m.projects.map(p =>
  `  ${p.name}:\n    Created :  Target: ${fmt(p.tCreated)}, Result: ${fmt(p.rCreated)} (${pct(p.rCreated, p.tCreated)}%)\n    Improved:  Target: ${fmt(p.tImproved)}, Result: ${fmt(p.rImproved)} (${pct(p.rImproved, p.tImproved)}%)`
).join("\n")}`,

    part3skills: `Q12 – Skills developed:
${ans.q12 || "(Not yet written)"}

Q13 – Capacity focus for next year:
${ans.q13 || "(Not yet written)"}`,

    part4finance: `Grant total:   $${Number(g.totalUSD || 0).toFixed(2)} USD
Total spent:   $${totalUSD.toFixed(2)} USD  (${fmt(totalTZSAll)} TZS)
Conversion:    ${g.conversionRate || 0.000413} TZS/USD
Unspent:       $${Math.max(0, Number(g.totalUSD || 0) - totalUSD).toFixed(2)} USD

Spending by program:
${progFinance}

Q17 – Other revenue sources:
${ans.q17 || "(Not yet written)"}

Q18 – Financial report link:
${ans.q18 || "(Not yet provided)"}

Q19 – Unspent funds plan:
${ans.q19 || "(Not yet written)"}

Compliance with fund agreement: Yes
Compliance with applicable laws and regulations: Yes
Compliance with US IRS Code provisions: Yes`,
  };
}
