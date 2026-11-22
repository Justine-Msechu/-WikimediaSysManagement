import { certificatesHtml, monthReportHtml, yearReportHtml, esc } from "./contributorPrint";
import { buildYearSummary } from "./yearSummary";

const org = { orgName: "Wikimedians of Kilimanjaro", logoUrl: "https://example.org/logo.png" };
const person = (over) => ({
  name: "Amina Juma", username: "Amina", label: "participated", monthsActive: 0, monthsEditing: 0,
  totalArticles: 0, bestOfMonth: [], ...over,
});

describe("certificatesHtml", () => {
  test("wording follows the recognition level", () => {
    const html = certificatesHtml([
      person({ label: "active", monthsActive: 2, monthsEditing: 5, totalArticles: 410 }),
      person({ name: "Baraka", username: "Baraka", label: "retained", monthsEditing: 4, totalArticles: 30 }),
      person({ name: "Dora", username: "Dora" }),
    ], { ...org, start: "2026-07", end: "2027-06" });
    expect(html).toContain("Certificate of Recognition");
    expect(html).toContain("Active Contributor");
    expect(html).toContain("<strong>410</strong> Wikipedia articles");
    expect(html).toContain("Certificate of Appreciation");
    expect(html).toContain("<strong>4</strong> months");
    expect(html).toContain("Certificate of Participation");
    expect(html).toContain("July 2026 – June 2027");
    expect(html.match(/class="cert"/g)).toHaveLength(3);
  });

  test("best contributor months are shown, names are escaped", () => {
    const html = certificatesHtml([person({ name: "<b>Eve</b>", bestOfMonth: ["2026-09"] })], { ...org, start: "2026-07", end: "2026-09" });
    expect(html).toContain("Best contributor of the month: September 2026");
    expect(html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(html).not.toContain("<b>Eve</b>");
  });
});

describe("report printouts", () => {
  test("monthly report names the best contributor", () => {
    const rows = [
      { name: "Amina", username: "Amina", articles: 72, edits: 90, active: true },
      { name: "Baraka", username: "Baraka", articles: 4, edits: 4, active: false },
    ];
    const html = monthReportHtml({ rows, month: "2026-10", wikiLabel: "Swahili Wikipedia", threshold: 60, partial: false, ...org });
    expect(html).toContain("Best contributor of the month");
    expect(html).toMatch(/class="n">Amina</);
    expect(html).toContain("Active contributors — October 2026");
  });

  test("year report lists the best contributor of each month", () => {
    const reports = [{ wiki: "sw.wikipedia.org", month: "2026-07", partial: false, threshold: 60, rows: [{ username: "Amina", name: "Amina", articles: 9, edits: 9, active: false }] }];
    const summary = buildYearSummary(reports, [], { start: "2026-07", end: "2026-07", now: new Date("2026-11-22T00:00:00Z") });
    const html = yearReportHtml({ summary, start: "2026-07", end: "2026-07", wikiLabel: "All wikis", ...org });
    expect(html).toContain("Best contributor of each month");
    expect(html).toMatch(/July 2026<\/td><td>Amina<\/td>/);
  });

  test("esc escapes HTML", () => {
    expect(esc('a<b>"c"&')).toBe("a&lt;b&gt;&quot;c&quot;&amp;");
  });
});
