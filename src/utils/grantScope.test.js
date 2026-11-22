import { oldestGrantId, participantsForGrant, budgetEntryFixes, reportAnswersFor } from "./grantScope";

test("oldestGrantId picks the grant that starts first, then the one created first", () => {
  expect(oldestGrantId([
    { id: "new", createdAt: { seconds: 2000 } },
    { id: "old", createdAt: { seconds: 1000 } },
    { id: "nodate" },
  ])).toBe("old");
  // Old grant re-entered after the new one: its start date still makes it first.
  expect(oldestGrantId([
    { id: "2026-27", startDate: "2026-07-01", createdAt: { seconds: 1000 } },
    { id: "2025-26", startDate: "2025-07-01", createdAt: { seconds: 2000 } },
  ])).toBe("2025-26");
  // An old grant with no dates, created long before the new one, is still first.
  expect(oldestGrantId([
    { id: "new", startDate: "2026-07-01", createdAt: { seconds: Date.parse("2026-06-01") / 1000 } },
    { id: "old", createdAt: { seconds: Date.parse("2025-05-01") / 1000 } },
  ])).toBe("old");
  expect(oldestGrantId([])).toBe("");
});

test("participantsForGrant: tagged with the grant or in one of its programs", () => {
  const programs = [{ id: "p1", grantId: "g1" }, { id: "p2", grantId: "g2" }];
  const people = [
    { id: "a", grantId: "g1" },
    { id: "b", programId: "p1" },
    { id: "c", programId: "p2" },
    { id: "d", programId: "" },
  ];
  expect(participantsForGrant(people, programs, "g1").map(p => p.id)).toEqual(["a", "b"]);
  expect(participantsForGrant(people, programs, "g3")).toEqual([]);   // a brand-new grant is empty
});

test("budgetEntryFixes finds entries with a missing or wrong grant tag", () => {
  const programs = [{ id: "p1", grantId: "old" }, { id: "p2", grantId: "new" }];
  const entries = [
    { id: "e1", programId: "p1" },                  // approval entry without a tag → old grant
    { id: "e2", programId: "p1", grantId: "new" },  // wrongly pulled into the new grant
    { id: "e3", programId: "p2", grantId: "new" },  // fine
    { id: "e4" },                                   // pre-grant data
  ];
  const r = budgetEntryFixes(entries, programs, "new");
  expect(r.missingTag).toEqual([{ id: "e1", grantId: "old" }]);
  expect(r.wrongGrant).toEqual([{ id: "e2", grantId: "old" }]);
  expect(r.orphans.map(e => e.id)).toEqual(["e4"]);
});

test("reportAnswersFor keeps each grant's answers separate", () => {
  const settings = { reportAnswers: { q1: "old answer" }, reportAnswersByGrant: { g2: { q1: "second" } } };
  expect(reportAnswersFor(settings, "g1", "g1")).toEqual({ q1: "old answer" });   // first grant keeps legacy answers
  expect(reportAnswersFor(settings, "g2", "g1")).toEqual({ q1: "second" });
  expect(reportAnswersFor(settings, "g3", "g1")).toEqual({});                     // new grant starts empty
});

describe("belongsToGrant", () => {
  const { belongsToGrant, grantIdsWith, grantMonthRange } = require("./grantScope");
  const programs = [{ id: "p1", grantId: "g1" }, { id: "p2", grantId: "g2" }];
  const opts = { firstGrantId: "g1", programs };

  test("volunteers with grantIds, forms/tasks by grantId or program, old records → first grant", () => {
    expect(belongsToGrant({ grantIds: ["g1", "g2"] }, "g2", opts)).toBe(true);
    expect(belongsToGrant({ grantIds: ["g1"] }, "g2", opts)).toBe(false);
    expect(belongsToGrant({ grantId: "g2" }, "g2", opts)).toBe(true);
    expect(belongsToGrant({ programId: "p2" }, "g2", opts)).toBe(true);
    expect(belongsToGrant({ programId: "p1" }, "g2", opts)).toBe(false);
    expect(belongsToGrant({}, "g1", opts)).toBe(true);    // old record → first grant
    expect(belongsToGrant({}, "g2", opts)).toBe(false);   // ...not a new grant
  });

  test("grantIdsWith keeps an old volunteer in the first grant", () => {
    expect(grantIdsWith({}, "g2", "g1")).toEqual(["g1", "g2"]);
    expect(grantIdsWith({ grantIds: ["g2"] }, "g2", "g1")).toEqual(["g2"]);
  });

  test("grantMonthRange", () => {
    expect(grantMonthRange({ startDate: "2026-07-01", endDate: "2027-06-30" })).toEqual({ start: "2026-07", end: "2027-06" });
    expect(grantMonthRange({})).toBe(null);
  });
});

test("isReturning: in this grant and an earlier one", () => {
  const { isReturning } = require("./grantScope");
  expect(isReturning({ grantIds: ["g1", "g2"] }, "g2", "g1")).toBe(true);
  expect(isReturning({ grantIds: ["g2"] }, "g2", "g1")).toBe(false);   // new this grant
  expect(isReturning({}, "g1", "g1")).toBe(false);                      // old member, first grant only
});

test("reportForMembers keeps only the grant's members and recounts", () => {
  const { reportForMembers } = require("./grantScope");
  const r = { month: "2026-07", memberCount: 3, activeCount: 2, rows: [
    { username: "A", articles: 70, active: true }, { username: "B", articles: 65, active: true }, { username: "C", articles: 0, active: false },
  ] };
  const v = reportForMembers(r, new Set(["B", "C"]));
  expect(v.rows.map(x => x.username)).toEqual(["B", "C"]);
  expect([v.memberCount, v.activeCount, v.stillEditingCount]).toEqual([2, 1, 1]);
});

describe("grant members come from participation", () => {
  const { grantParticipation, returningPeople, earlierPeople, sortGrants } = require("./grantScope");
  const grants = [
    { id: "new", startDate: "2026-07-01", endDate: "2027-06-30" },
    { id: "old", startDate: "2025-07-01", endDate: "2026-06-30" },
  ];
  const programs = [{ id: "pOld", grantId: "old" }, { id: "pNew", grantId: "new" }];
  const participants = [
    { wikimediaUsername: "amina", programId: "pOld" },
    { wikimediaUsername: "Baraka", programId: "pOld" },
    { wikimediaUsername: "Amina", programId: "pNew" },
  ];
  const forms = [{ id: "fNew", programId: "pNew" }];
  const registrations = [
    { formId: "fNew", wikimediaUsername: "Chausiku" },
    { formId: "fNew", wikimediaUsername: "Dora", attendance: "absent" },
  ];
  const events = [
    { start: "2026-11-01T00:00:00Z", end: "2026-11-20T00:00:00Z", participants: ["Eli"] },
    { start: "2026-01-25T00:00:00Z", end: "2026-02-05T00:00:00Z", participants: ["Baraka", "Fatma"] },
  ];
  const map = grantParticipation({ grants, participants, programs, forms, registrations, events });

  test("each grant has only the people who took part in it", () => {
    expect([...map.get("old")].sort()).toEqual(["Amina", "Baraka", "Fatma"]);
    expect([...map.get("new")].sort()).toEqual(["Amina", "Chausiku", "Eli"]);   // Dora was absent
  });

  test("returning = took part in this grant and an earlier one", () => {
    expect(sortGrants(grants).map(g => g.id)).toEqual(["old", "new"]);
    expect([...returningPeople(map, grants, "new")]).toEqual(["Amina"]);
    expect([...returningPeople(map, grants, "old")]).toEqual([]);
    expect(earlierPeople(map, grants, "new").has("Baraka")).toBe(true);
  });
});
