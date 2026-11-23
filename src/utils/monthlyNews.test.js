import { monthlyNews, newsText } from "./monthlyNews";

const rows = [
  { name: "Amina", username: "Amina", articles: 70, edits: 90, created: 2, bytes: 5000, active: true, editing: true, pageIds: [1, 2, 3], newArticles: ["Mlima Meru", "Ziwa Chala"] },
  { name: "Baraka", username: "Baraka", articles: 2, edits: 3, created: 0, bytes: 120, active: false, editing: true, pageIds: [3, 4], newArticles: [] },
  { name: "Dora", username: "Dora", articles: 0, edits: 0, created: 0, bytes: 0, active: false, editing: false, pageIds: [], newArticles: [] },
];

test("counts different articles once across volunteers, plus new articles and edits", () => {
  const news = monthlyNews(rows);
  expect(news).toMatchObject({ detailed: true, volunteers: 3, editing: 2, active: 1, articles: 4, created: 2, edits: 93, bytes: 5120 });
  expect(news.newArticles.map(a => a.title)).toEqual(["Mlima Meru", "Ziwa Chala"]);
  expect(news.best.map(b => b.name)).toEqual(["Amina"]);
});

test("older reports without page ids fall back to adding up", () => {
  const news = monthlyNews([{ name: "A", articles: 5, edits: 6 }, { name: "B", articles: 3, edits: 3 }]);
  expect(news).toMatchObject({ detailed: false, articles: 8, created: 0 });
});

test("newsletter text in English and Swahili", () => {
  const news = monthlyNews(rows);
  const en = newsText(news, { monthName: "October 2026" });
  expect(en).toContain("In October 2026, 2 volunteers of Wikimedia Community Kilimanjaro contributed to 4 different articles on Swahili Wikipedia, including 2 new articles, with 93 edits in total.");
  expect(en).toContain("Best contributor of the month: Amina (70 articles).");
  expect(en).toContain("Some of the new articles: Mlima Meru, Ziwa Chala.");
  const sw = newsText(news, { monthName: "Oktoba 2026", lang: "sw" });
  expect(sw).toContain("makala 4 tofauti");
  expect(sw).toContain("makala mpya 2");
});
