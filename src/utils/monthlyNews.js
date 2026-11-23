// ── Monthly news — what our volunteers contributed in one month ───────────────
// Pure JS. Built from the rows of a saved (or freshly fetched) monthly report,
// which are already limited to the selected grant's volunteers.

import { bestContributors, isEditing, wikiInfo, normalizeUsername, WIKIS, DEFAULT_WIKI, POINTS_WIKIS, projectPoints } from "./wikiContribs";

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
const word = (count, info) => (Number(count) === 1 ? info.one : info.unit);   // "1 item", "2 items"

// Words for one project in English and Kiswahili.
const SW_UNITS = { articles: "makala", items: "vipengee", files: "faili", entries: "maneno" };
const SW_NEW = { articles: "makala mpya", items: "vipengee vipya", files: "faili zilizopakiwa", entries: "maneno mapya" };

// A short paragraph for the monthly newsletter (one project).
export function newsText(news, { monthName, wiki = "sw.wikipedia.org", wikiLabel, orgName = "Wikimedia Community Kilimanjaro", eventsOnly = false, lang = "en", threshold = 30 } = {}) {
  const w = wikiInfo(wiki);
  const where = wikiLabel || (lang === "sw" ? w.short : w.label);
  const best = news.best.length ? news.best.map(b => b.name).join(" & ") : "";
  const top = news.newArticles.slice(0, 5).map(a => a.title.replace(/^File:/, ""));
  if (lang === "sw") {
    const u = SW_UNITS[w.unit] || "makala";
    return [
      `Mwezi ${monthName}, wanajamii ${n(news.editing)} wa ${orgName} walichangia ${u} ${n(news.articles)} tofauti kwenye ${where}${eventsOnly ? " kupitia matukio yetu" : ""}`
        + `${news.created ? `, zikiwemo ${SW_NEW[w.unit] || "makala mpya"} ${n(news.created)}` : ""}, kwa jumla ya marekebisho ${n(news.edits)}.`,
      news.active ? `Wachangiaji hai (${u} ${threshold}+ kwa mwezi): ${n(news.active)}.` : "",
      best ? `Mchangiaji bora wa mwezi: ${best} (${u} ${n(news.best[0].articles)}).` : "",
      top.length ? `Baadhi ya ${SW_NEW[w.unit] || "makala mpya"}: ${top.join(", ")}.` : "",
      "Asanteni wote kwa michango yenu!",
    ].filter(Boolean).join(" ");
  }
  const newWords = news.created === 1 ? w.newUnit.replace(/s$/, "").replace(/ie$/, "y") : w.newUnit;
  return [
    `In ${monthName}, ${n(news.editing)} volunteers of ${orgName} contributed to ${n(news.articles)} different ${word(news.articles, w)} on ${where}${eventsOnly ? " through our events" : ""}`
      + `${news.created ? `, including ${n(news.created)} ${newWords}` : ""}, with ${n(news.edits)} edits in total.`,
    news.active ? `${n(news.active)} reached the active contributor level.` : "",
    best ? `Best contributor of the month: ${best} (${n(news.best[0].articles)} ${word(news.best[0].articles, w)}).` : "",
    top.length ? `Some of the ${w.newUnit}: ${top.join(", ")}.` : "",
    "Thank you all for your contributions!",
  ].filter(Boolean).join(" ");
}

/**
 * Best contributor across our four projects (POINTS_WIKIS), by points.
 * reports: [{ wiki, rows }] for one month.
 * Returns { ranking: [{ username, name, points, parts: [{ wiki, pages, points }] }] (most first),
 *           best: the top person(s) — ties share it, nobody wins with 0 }
 */
export function bestAcrossProjects(reports) {
  const people = new Map();
  for (const r of reports || []) {
    const w = r.wiki || DEFAULT_WIKI;
    if (!POINTS_WIKIS.includes(w)) continue;
    for (const row of r.rows || []) {
      const u = normalizeUsername(row.username);
      const pages = Number(row.articles) || 0;
      if (!u || !pages) continue;
      if (!people.has(u)) people.set(u, { username: u, name: row.name || u, exact: 0, parts: [] });
      const p = people.get(u);
      const pts = projectPoints(w, pages);
      p.exact += pts;
      p.parts.push({ wiki: w, pages, points: Math.round(pts) });
    }
  }
  const order = (w) => POINTS_WIKIS.indexOf(w);
  const ranking = [...people.values()]
    .map(({ exact, ...p }) => ({ ...p, points: Math.round(exact), parts: p.parts.sort((a, b) => order(a.wiki) - order(b.wiki)) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const max = ranking[0]?.points || 0;
  return { ranking, best: max > 0 ? ranking.filter(p => p.points === max) : [] };
}

// "300 items on Wikidata, 10 articles on Swahili Wikipedia"
export function pointsBreakdown(parts, lang = "en") {
  return (parts || []).map(({ wiki, pages }) => {
    const w = wikiInfo(wiki);
    return lang === "sw" ? `${SW_UNITS[w.unit] || "makala"} ${n(pages)} kwenye ${w.short}` : `${n(pages)} ${word(pages, w)} on ${w.label}`;
  }).join(", ");
}

/**
 * The month across all projects.
 * reports: [{ wiki, rows }] — one per project (saved or freshly fetched), same month and scope.
 * Returns { projects: [{ wiki, info, news }] (projects with edits, in WIKIS order),
 *           missing: [wiki ids with no report], volunteers (different people who edited anywhere), edits }
 */
export function projectsNews(reports) {
  const byWiki = new Map((reports || []).map(r => [r.wiki, r]));
  const projects = [];
  const people = new Set();
  let edits = 0;
  for (const w of WIKIS) {
    const r = byWiki.get(w.id);
    if (!r) continue;
    const news = monthlyNews(r.rows);
    (r.rows || []).filter(isEditing).forEach(x => people.add(normalizeUsername(x.username)));
    edits += news.edits;
    if (news.editing > 0) projects.push({ wiki: w.id, info: w, news });
  }
  const { ranking, best } = bestAcrossProjects(reports);
  return { projects, missing: WIKIS.filter(w => !byWiki.has(w.id)).map(w => w.id), volunteers: people.size, edits, ranking, best };
}

// One paragraph covering every project.
export function projectsText(all, { monthName, orgName = "Wikimedia Community Kilimanjaro", eventsOnly = false, lang = "en" } = {}) {
  if (!all.projects.length) return "";
  const list = (parts) => (parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${lang === "sw" ? "na" : "and"} ${parts[parts.length - 1]}` : parts[0]);
  if (lang === "sw") {
    const parts = all.projects.map(({ info, news }) => {
      const u = SW_UNITS[info.unit] || "makala";
      return info.kind === "media"
        ? `${u} ${n(news.articles)} kwenye ${info.short}${news.created ? ` (zilizopakiwa ${n(news.created)})` : ""}`
        : `${u} ${n(news.articles)} kwenye ${info.short}${news.created ? ` (mpya ${n(news.created)})` : ""}`;
    });
    const bestSw = all.best?.length ? ` Mchangiaji bora wa miradi yote: ${all.best.map(b => `${b.name} (alama ${n(b.points)}: ${pointsBreakdown(b.parts, "sw")})`).join(" na ")}.` : "";
    return `Mwezi ${monthName}, wanajamii ${n(all.volunteers)} wa ${orgName} walichangia miradi ya Wikimedia${eventsOnly ? " kupitia matukio yetu" : ""}: ${list(parts)}, kwa jumla ya marekebisho ${n(all.edits)}.${bestSw} Asanteni wote kwa michango yenu!`;
  }
  const parts = all.projects.map(({ info, news }) => info.kind === "media"
    ? `${n(news.articles)} ${word(news.articles, info)} on ${info.label}${news.created ? ` (${n(news.created)} uploaded)` : ""}`
    : `${n(news.articles)} ${word(news.articles, info)} on ${info.label}${news.created ? ` (${n(news.created)} new)` : ""}`);
  const best = all.best?.length ? ` Best contributor across our projects: ${all.best.map(b => `${b.name} (${n(b.points)} points: ${pointsBreakdown(b.parts)})`).join(" & ")}.` : "";
  return `In ${monthName}, ${n(all.volunteers)} volunteers of ${orgName} contributed across Wikimedia projects${eventsOnly ? " through our events" : ""}: ${list(parts)}, with ${n(all.edits)} edits in total.${best} Thank you all for your contributions!`;
}
