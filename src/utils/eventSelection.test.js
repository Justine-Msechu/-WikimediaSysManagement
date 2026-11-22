import { planEventSeats, rankingMonth, activeSummary, activeAtLeastOnce } from "./eventSelection";

const report = (wiki, month, rows, extra = {}) => ({ id: `${wiki}_${month}`, wiki, month, threshold: 60, partial: false, rows, ...extra });
const row = (username, articles) => ({ username, articles, edits: articles, active: articles >= 60 });
const reg = (id, name, username, minute) => ({ id, name, wikimediaUsername: username, registeredAt: `2026-11-01T10:${String(minute).padStart(2, "0")}:00Z` });

const reports = [
  report("sw.wikipedia.org", "2026-09", [row("Amina", 10), row("Baraka", 90)]),
  report("sw.wikipedia.org", "2026-10", [row("Amina", 80), row("Baraka", 20), row("Chausiku", 61)]),
  report("en.wikipedia.org", "2026-10", [row("Baraka", 70)]),
  report("sw.wikipedia.org", "2026-11", [row("Amina", 5)], { partial: true }),
];
const members = [{ wikimediaUsername: "Amina" }, { wikimediaUsername: "Baraka" }, { wikimediaUsername: "Chausiku" }, { wikimediaUsername: "Dora" }];

describe("rankingMonth", () => {
  test("uses the latest finished month, skipping partial ones", () => {
    expect(rankingMonth(reports)).toBe("2026-10");
  });
  test("only months before the event month count", () => {
    expect(rankingMonth(reports, "2026-10")).toBe("2026-09");
    expect(rankingMonth(reports, "2026-09")).toBe("");
  });
});

describe("activeSummary / activeAtLeastOnce", () => {
  test("counts each person once across wikis", () => {
    // October: Amina (sw 80), Baraka (en 70), Chausiku (sw 61) → 3 active of 3 checked
    expect(activeSummary(reports, "2026-10")).toMatchObject({ active: 3, checked: 3, threshold: 60 });
  });
  test("people active in at least one finished month", () => {
    expect(activeAtLeastOnce(reports)).toEqual({ people: 3, months: 2 });
  });
});

describe("planEventSeats", () => {
  const registrations = [
    reg("r1", "Amina", "Amina", 1),
    reg("r2", "Baraka", "baraka", 2),
    reg("r3", "Dora", "Dora", 3),          // member with no report rows → 0 articles
    reg("r4", "Esther", "Esther", 4),      // new (username not in list)
    reg("r5", "Faraja", "", 5),            // new, no Wikipedia account
    reg("r6", "Chausiku", "Chausiku", 6),
  ];

  test("ranks members by articles (best wiki) and keeps a share for new members", () => {
    const plan = planEventSeats({ registrations, members, reports, seats: 4, newPct: 25, eventMonth: "2026-11" });
    expect(plan.month).toBe("2026-10");
    expect(plan.newSeats).toBe(1);
    expect(plan.memberSeats).toBe(3);
    expect(plan.existing.map(p => [p.reg.name, p.articles, p.status])).toEqual([
      ["Amina", 80, "recommended"],
      ["Baraka", 70, "recommended"],
      ["Chausiku", 61, "recommended"],
      ["Dora", 0, "waitlist"],
    ]);
    expect(plan.newcomers.map(p => [p.reg.name, p.status])).toEqual([
      ["Esther", "recommended"],
      ["Faraja", "waitlist"],
    ]);
    expect(plan.recommended).toBe(4);
  });

  test("seats new members can't fill go to members (and the other way round)", () => {
    const onlyMembers = registrations.filter(r => ["r1", "r2", "r3"].includes(r.id));
    const plan = planEventSeats({ registrations: onlyMembers, members, reports, seats: 3, newPct: 50 });
    expect(plan.existing.every(p => p.status === "recommended")).toBe(true);

    const onlyNew = [reg("n1", "A", "", 1), reg("n2", "B", "Bnew", 2), reg("n3", "C", "", 3)];
    const plan2 = planEventSeats({ registrations: onlyNew, members, reports, seats: 2, newPct: 10 });
    expect(plan2.newcomers.map(p => p.status)).toEqual(["recommended", "recommended", "waitlist"]);
  });

  test("blank seats means everyone fits; duplicate usernames count once", () => {
    const dup = [...registrations, reg("r7", "Amina again", "User:Amina", 9)];
    const plan = planEventSeats({ registrations: dup, members, reports, seats: "" });
    expect(plan.seats).toBe(6);
    expect(plan.recommended).toBe(6);
    expect(plan.existing.filter(p => p.username === "Amina")).toHaveLength(1);
  });

  test("without saved reports, members keep registration order", () => {
    const plan = planEventSeats({ registrations, members, reports: [], seats: 2, newPct: 0 });
    expect(plan.month).toBe("");
    expect(plan.existing.map(p => p.reg.name)).toEqual(["Amina", "Baraka", "Dora", "Chausiku"]);
  });
});
