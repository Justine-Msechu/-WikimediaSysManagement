import { oldestGrantId, participantsForGrant, budgetEntryFixes, reportAnswersFor } from "./grantScope";

test("oldestGrantId picks the first grant created", () => {
  expect(oldestGrantId([
    { id: "new", createdAt: { seconds: 2000 } },
    { id: "old", createdAt: { seconds: 1000 } },
    { id: "nodate" },
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
