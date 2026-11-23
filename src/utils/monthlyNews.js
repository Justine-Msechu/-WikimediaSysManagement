// ── Monthly news — what our volunteers contributed in one month ───────────────
// Pure JS. Built from the rows of a saved (or freshly fetched) monthly report,
// which are already limited to the selected grant's volunteers.

import { bestContributors, isEditing } from "./wikiContribs";

/**
 * rows: report rows { name, username, articles, edits, created, bytes, pageIds[], newArticles[] }
 * Returns {
 *   detailed  — false for reports saved before new-article counts existed
 *   volunteers, editing, active
 *   articles  — different articles edited by all volunteers together (each counted once)
 *   created   — new articles started
 *   edits, bytes
 *   newArticles: [{ title, name, username }]
 *   best: rows of the best contributor(s)
 * }
 */
export function monthlyNews(rows) {
  const list = rows || [];
  const detailed = list.some(r => Array.isArray(r.pageIds));
  const pages = new Set();
  list.forEach(r => (r.pageIds || []).forEach(p => pages.add(p)));
  const newArticles = [];
  list.forEach(r => (r.newArticles || []).forEach(title => newArticles.push({ title, name: r.name, username: r.username })));
  newArticles.sort((a, b) => a.title.localeCompare(b.title));
  return {
    detailed,
    volunteers: list.length,
    editing:    list.filter(isEditing).length,
    active:     list.filter(r => r.active).length,
    articles:   detailed ? pages.size : list.reduce((s, r) => s + (Number(r.articles) || 0), 0),
    created:    list.reduce((s, r) => s + (Number(r.created) || 0), 0),
    edits:      list.reduce((s, r) => s + (Number(r.edits) || 0), 0),
    bytes:      list.reduce((s, r) => s + (Number(r.bytes) || 0), 0),
    newArticles,
    best: bestContributors(list),
  };
}

const n = (x) => Number(x || 0).toLocaleString("en-US");

// A short paragraph for the monthly newsletter.
export function newsText(news, { monthName, wikiLabel = "Swahili Wikipedia", orgName = "Wikimedia Community Kilimanjaro", eventsOnly = false, lang = "en", threshold = 60 } = {}) {
  const best = news.best.length ? news.best.map(b => b.name).join(" & ") : "";
  const top = news.newArticles.slice(0, 5).map(a => a.title);
  if (lang === "sw") {
    return [
      `Mwezi ${monthName}, wanajamii ${n(news.editing)} wa ${orgName} walichangia makala ${n(news.articles)} tofauti kwenye ${wikiLabel}${eventsOnly ? " kupitia matukio yetu" : ""}`
        + `${news.created ? `, wakiwemo makala mpya ${n(news.created)}` : ""}, kwa jumla ya marekebisho ${n(news.edits)}.`,
      news.active ? `Wachangiaji hai (makala ${threshold}+ kwa mwezi): ${n(news.active)}.` : "",
      best ? `Mchangiaji bora wa mwezi: ${best} (makala ${n(news.best[0].articles)}).` : "",
      top.length ? `Baadhi ya makala mpya: ${top.join(", ")}.` : "",
      "Asanteni wote kwa michango yenu!",
    ].filter(Boolean).join(" ");
  }
  return [
    `In ${monthName}, ${n(news.editing)} volunteers of ${orgName} contributed to ${n(news.articles)} different articles on ${wikiLabel}${eventsOnly ? " through our events" : ""}`
      + `${news.created ? `, including ${n(news.created)} new article${news.created === 1 ? "" : "s"}` : ""}, with ${n(news.edits)} edits in total.`,
    news.active ? `${n(news.active)} reached the active contributor level.` : "",
    best ? `Best contributor of the month: ${best} (${n(news.best[0].articles)} articles).` : "",
    top.length ? `Some of the new articles: ${top.join(", ")}.` : "",
    "Thank you all for your contributions!",
  ].filter(Boolean).join(" ");
}
