// Official WMF-approved programme schedule for the 2026-2027 grant cycle, taken
// directly from "Wikimedia Kilimanjaro Timeline 2026-2027.docx". Used to compare
// planned vs actual session dates on the Timeline page, to answer reporting
// questions about whether the grant followed its approved schedule.
//
// "match" identifies which Program record (by name) this row applies to.
// Team Meeting is intentionally excluded — it has no budget line and isn't
// tracked as a Program/Activity in the system.
export const PLANNED_SCHEDULE = [
  { match: /edit-?a-?thon/i,          label: "Monthly Edit-a-thon",          months: ["2026-07", "2026-09", "2026-12", "2027-03", "2027-06"] },
  { match: /error.*fix/i,             label: "Error and Fix Campaign",       months: ["2026-08", "2026-11", "2027-02", "2027-05"] },
  // "WikiMalkia Leadership & Recognition" is a separate one-off award activity with its
  // own budget line, not the recurring "WikiMalkia (women contributors)" sessions this
  // schedule describes — excluded via lookahead so the two programs don't collide.
  { match: /malkia(?!.*leadership)/i, label: "WikiMalkia \"WikiQueens\"",    months: ["2026-07", "2026-09", "2026-12", "2027-03", "2027-05"] },
  { match: /feminism|folklore/i,      label: "Feminism & Folklore Tanzania", months: ["2026-10", "2026-11", "2027-04", "2027-05"] },
  { match: /connect/i,                label: "Let's Connect",                months: ["2026-09", "2027-03"] },
  { match: /wikihealth/i,             label: "WikiHealth",                   months: ["2026-11", "2027-05"] },
  { match: /community gathering/i,    label: "Community Gathering",          months: ["2027-06"] },
  { match: /kiwix/i,                  label: "Kiwix for Schools",            months: ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"] },
];

export const PLANNED_TIMELINE_MONTHS = [
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
  "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07",
];

export function plannedScheduleFor(programName) {
  return PLANNED_SCHEDULE.find(p => p.match.test(programName || ""));
}

export function monthLabel(yyyymm) {
  const [y, m] = yyyymm.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}
