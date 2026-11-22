import {
  normalizeUsername, monthBounds, previousMonths, isPartialMonth,
  fetchMonthStats, buildReportRows, rowsToCsv,
} from "./wikiContribs";

// Fake fetch: `pages` is a list of API responses returned in order.
// Records every requested URL so tests can inspect the query parameters.
function fakeFetch(pages) {
  const calls = [];
  let i = 0;
  const impl = async (url) => {
    calls.push(new URL(url));
    const body = typeof pages === "function" ? pages(new URL(url), i) : pages[Math.min(i, pages.length - 1)];
    i++;
    return { ok: true, status: 200, json: async () => body };
  };
  return { impl, calls };
}

const contrib = (user, pageid, timestamp = "2026-10-15T12:00:00Z") => ({ user, pageid, timestamp });
const opts = (impl) => ({ fetchImpl: impl, delayMs: 0 });

describe("normalizeUsername", () => {
  test("strips namespace prefixes, converts underscores, capitalises", () => {
    expect(normalizeUsername("User:amina_juma")).toBe("Amina juma");
    expect(normalizeUsername("Mtumiaji:Baraka_2024 ")).toBe("Baraka 2024");
    expect(normalizeUsername("  user: zawadi  ")).toBe("Zawadi");
    expect(normalizeUsername("Already Fine")).toBe("Already Fine");
    expect(normalizeUsername("")).toBe("");
    expect(normalizeUsername(null)).toBe("");
  });
});

describe("months", () => {
  test("December rolls over into January of the next year", () => {
    expect(monthBounds("2026-12")).toEqual({ start: "2026-12-01T00:00:00Z", end: "2027-01-01T00:00:00Z" });
    expect(monthBounds("2026-03")).toEqual({ start: "2026-03-01T00:00:00Z", end: "2026-04-01T00:00:00Z" });
  });

  test("previousMonths returns n months ending with the given one, oldest first", () => {
    expect(previousMonths("2027-02", 4)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  test("isPartialMonth is true only for the current (or a future) month", () => {
    const now = new Date("2026-11-22T10:00:00Z");
    expect(isPartialMonth("2026-11", now)).toBe(true);
    expect(isPartialMonth("2026-10", now)).toBe(false);
  });
});

describe("fetchMonthStats", () => {
  test("repeat edits to the same page count once as an article", async () => {
    const { impl } = fakeFetch([{ query: { usercontribs: [
      contrib("Amina", 1), contrib("Amina", 1), contrib("Amina", 1), contrib("Amina", 2),
    ] } }]);
    const stats = await fetchMonthStats(["Amina"], "2026-10", "sw.wikipedia.org", opts(impl));
    expect(stats.get("Amina")).toEqual({ articles: 2, edits: 4 });
  });

  test("follows continuation until the API stops returning it", async () => {
    const { impl, calls } = fakeFetch([
      { query: { usercontribs: [contrib("Amina", 1)] }, continue: { uccontinue: "A|1", continue: "-||" } },
      { query: { usercontribs: [contrib("Amina", 2)] }, continue: { uccontinue: "A|2", continue: "-||" } },
      { query: { usercontribs: [contrib("Amina", 3)] } },
    ]);
    const stats = await fetchMonthStats(["Amina"], "2026-10", "sw.wikipedia.org", opts(impl));
    expect(calls).toHaveLength(3);
    expect(calls[0].searchParams.get("uccontinue")).toBeNull();
    expect(calls[1].searchParams.get("uccontinue")).toBe("A|1");
    expect(calls[2].searchParams.get("uccontinue")).toBe("A|2");
    expect(stats.get("Amina").articles).toBe(3);
  });

  test("an edit at exactly the end timestamp is excluded (ucend is inclusive)", async () => {
    const { impl } = fakeFetch([{ query: { usercontribs: [
      contrib("Amina", 1, "2026-10-01T00:00:00Z"),
      contrib("Amina", 2, "2026-10-31T23:59:59Z"),
      contrib("Amina", 3, "2026-11-01T00:00:00Z"),
    ] } }]);
    const stats = await fetchMonthStats(["Amina"], "2026-10", "sw.wikipedia.org", opts(impl));
    expect(stats.get("Amina")).toEqual({ articles: 2, edits: 2 });
  });

  test("sends the documented query parameters", async () => {
    const { impl, calls } = fakeFetch([{ query: { usercontribs: [] } }]);
    await fetchMonthStats(["User:amina_juma"], "2026-12", "sw.wikipedia.org", opts(impl));
    const p = calls[0].searchParams;
    expect(calls[0].origin).toBe("https://sw.wikipedia.org");
    expect(calls[0].pathname).toBe("/w/api.php");
    expect(p.get("list")).toBe("usercontribs");
    expect(p.get("ucuser")).toBe("Amina juma");
    expect(p.get("ucnamespace")).toBe("0");
    expect(p.get("ucdir")).toBe("newer");
    expect(p.get("ucstart")).toBe("2026-12-01T00:00:00Z");
    expect(p.get("ucend")).toBe("2027-01-01T00:00:00Z");
    expect(p.get("origin")).toBe("*");
  });

  test("more than 50 members are split into batches of 50, members with no edits get 0", async () => {
    const names = Array.from({ length: 120 }, (_, i) => `User${i}`);
    const { impl, calls } = fakeFetch(() => ({ query: { usercontribs: [] } }));
    const progress = [];
    const stats = await fetchMonthStats(names, "2026-10", "sw.wikipedia.org", {
      ...opts(impl), onProgress: (done, total) => progress.push([done, total]),
    });
    const sizes = calls.map(u => u.searchParams.get("ucuser").split("|").length);
    expect(sizes).toEqual([50, 50, 20]);
    expect(stats.size).toBe(120);
    expect(stats.get("User7")).toEqual({ articles: 0, edits: 0 });
    expect(progress[progress.length - 1]).toEqual([120, 120]);
  });
});

describe("buildReportRows", () => {
  test("applies the threshold and sorts by articles", () => {
    const members = [
      { id: "a", name: "Amina", wikimediaUsername: "Amina" },
      { id: "b", name: "Baraka", wikimediaUsername: "baraka" },
      { id: "c", name: "Chausiku", wikimediaUsername: "Chausiku" },
    ];
    const stats = new Map([
      ["Amina",  { articles: 59, edits: 80 }],
      ["Baraka", { articles: 65, edits: 70 }],
    ]);
    const rows = buildReportRows(members, stats, 60);
    expect(rows.map(r => r.name)).toEqual(["Baraka", "Amina", "Chausiku"]);
    expect(rows[0]).toMatchObject({ username: "Baraka", articles: 65, active: true });
    expect(rows[1]).toMatchObject({ articles: 59, active: false });
    expect(rows[2]).toMatchObject({ articles: 0, edits: 0, active: false });
  });
});

describe("rowsToCsv", () => {
  test("quotes cells that contain commas", () => {
    const csv = rowsToCsv([{ name: "Juma, A.", username: "Juma", articles: 61, edits: 90, active: true }],
      { month: "2026-10", wiki: "sw.wikipedia.org", threshold: 60 });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("#,Name,Username,Different articles,Total edits,Active (>= 60),Month,Wiki");
    expect(lines[1]).toBe('1,"Juma, A.",Juma,61,90,Yes,2026-10,sw.wikipedia.org');
  });
});
