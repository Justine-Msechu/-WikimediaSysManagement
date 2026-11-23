import { monthRange, defaultPeriod, quarters, buildYearSummary, yearSummaryToCsv } from "./yearSummary";

const row = (username, articles, name) => ({ username, name: name || username, articles, edits: articles * 2, active: articles >= 60 });
const report = (wiki, month, rows, extra = {}) => ({ wiki, month, threshold: 60, partial: false, rows, ...extra });
const NOW = new Date("2026-11-22T10:00:00Z");

describe("monthRange / defaultPeriod", () => {
  test("crosses the year boundary", () => {
    expect(monthRange("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthRange("2027-02", "2026-11")).toEqual([]);
  });
  test("uses grant dates when present, else the last 12 full months", () => {
    expect(defaultPeriod({ startDate: "2026-07-01", endDate: "2027-06-30" }, NOW)).toEqual({ start: "2026-07", end: "2027-06" });
    expect(defaultPeriod(null, NOW)).toEqual({ start: "2025-11", end: "2026-10" });
  });
});

describe("quarters", () => {
  test("counts from the grant's first month, keeps a short last quarter", () => {
    expect(quarters("2026-07", "2027-06").map(q => `${q.label} ${q.start}..${q.end}`)).toEqual([
      "Q1 2026-07..2026-09", "Q2 2026-10..2026-12", "Q3 2027-01..2027-03", "Q4 2027-04..2027-06",
    ]);
    expect(quarters("2026-07", "2026-11").map(q => q.months.length)).toEqual([3, 2]);
  });
});

describe("buildYearSummary", () => {
  const members = [
    { name: "Amina Juma", wikimediaUsername: "Amina" },
    { name: "Baraka", wikimediaUsername: "Baraka" },
    { name: "Chausiku", wikimediaUsername: "Chausiku" },
    { name: "Dora", wikimediaUsername: "Dora" },
  ];
  const reports = [
    report("sw.wikipedia.org", "2026-07", [row("Amina", 70), row("Baraka", 2), row("Chausiku", 1), row("Dora", 0)]),
    report("sw.wikipedia.org", "2026-08", [row("Amina", 10), row("Baraka", 5), row("Chausiku", 0)]),
    report("en.wikipedia.org", "2026-08", [row("Amina", 55), row("Chausiku", 3)]),
    report("sw.wikipedia.org", "2026-09", [row("Baraka", 1), row("Chausiku", 0)]),
    report("sw.wikipedia.org", "2026-11", [row("Dora", 99)], { partial: true }),   // unfinished → ignored
    report("sw.wikipedia.org", "2026-05", [row("Dora", 99)]),                        // outside period
  ];

  const s = buildYearSummary(reports, members, { start: "2026-07", end: "2026-12", now: NOW });

  test("labels: active (any month 60+) > retained (3+ months editing) > participated", () => {
    const byName = Object.fromEntries(s.rows.map(r => [r.username, r]));
    expect(byName.Amina).toMatchObject({ label: "active", monthsActive: 1, monthsEditing: 2 });
    expect(byName.Baraka).toMatchObject({ label: "retained", monthsActive: 0, monthsEditing: 3, isRetained: true });
    expect(byName.Chausiku).toMatchObject({ label: "participated", monthsEditing: 2 });
    expect(byName.Dora).toMatchObject({ label: "participated", monthsEditing: 0, totalArticles: 0 });
  });

  test("wikis are combined per month (articles added, editing on any wiki)", () => {
    const amina = s.rows.find(r => r.username === "Amina");
    expect(amina.byMonth["2026-08"]).toMatchObject({ articles: 65, editing: true, active: false });
    expect(amina.totalArticles).toBe(135);
    expect(amina.bestMonth).toEqual({ month: "2026-07", articles: 70 });
  });

  test("filtering to one wiki only uses its reports", () => {
    const sw = buildYearSummary(reports, members, { start: "2026-07", end: "2026-12", wiki: "sw.wikipedia.org", now: NOW });
    expect(sw.rows.find(r => r.username === "Amina").totalArticles).toBe(80);
  });

  test("reports which months are missing, and which haven't finished yet", () => {
    expect(s.covered).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(s.missing).toEqual(["2026-10"]);
    expect(s.future).toEqual(["2026-11", "2026-12"]);
  });

  test("best contributor of each saved month, wikis combined", () => {
    expect(s.bestByMonth.map(b => [b.month, b.articles, b.people.map(p => p.username)])).toEqual([
      ["2026-07", 70, ["Amina"]],
      ["2026-08", 65, ["Amina"]],
      ["2026-09", 1, ["Baraka"]],
    ]);
    expect(s.rows.find(r => r.username === "Amina").bestOfMonth).toEqual(["2026-07", "2026-08"]);
    expect(s.rows.find(r => r.username === "Dora").bestOfMonth).toEqual([]);
  });

  test("totals and sort order", () => {
    expect(s.totals).toMatchObject({ people: 4, active: 1, retained: 1, editedOnce: 3, participated: 2 });
    expect(s.rows.map(r => r.username)).toEqual(["Amina", "Baraka", "Chausiku", "Dora"]);
  });

  test("CSV has one column per month", () => {
    const lines = yearSummaryToCsv(s).split("\r\n");
    expect(lines[0].endsWith("2026-07,2026-08,2026-09,2026-10,2026-11,2026-12")).toBe(true);
    expect(lines[1]).toBe("1,Amina Juma,Amina,Active contributor,1,2,135,270,2026-07,70,70,65,,,,");
  });
});

test("all wikis: best of the month by points across our projects", () => {
  const { buildYearSummary } = require("./yearSummary");
  const reports = [
    { wiki: "sw.wikipedia.org", month: "2026-10", rows: [{ username: "Amina", articles: 40 }] },
    { wiki: "www.wikidata.org", month: "2026-10", rows: [{ username: "Baraka", articles: 300 }] },
  ];
  const opts = { start: "2026-10", end: "2026-10", now: new Date("2026-12-01") };
  const all = buildYearSummary(reports, [], opts);
  expect(all.bestByMonth[0]).toMatchObject({ byPoints: true, points: 300, people: [{ username: "Baraka" }] });
  const sw = buildYearSummary(reports, [], { ...opts, wiki: "sw.wikipedia.org" });
  expect(sw.bestByMonth[0]).toMatchObject({ byPoints: false, articles: 40, people: [{ username: "Amina" }] });
});
