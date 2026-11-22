import { parseCourseSlug, courseUrl, eventDocId, eventWindowsInMonth, fetchCourse, fetchEventMonthStats } from "./eventContribs";
import { reportScope } from "./wikiContribs";

const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe("course links", () => {
  test("parses dashboard URLs and plain slugs", () => {
    expect(parseCourseSlug("https://outreachdashboard.wmflabs.org/courses/Wikimedia_Community_Kilimanjaro/January_2026_Training/home"))
      .toBe("Wikimedia_Community_Kilimanjaro/January_2026_Training");
    expect(parseCourseSlug("Wikimedia_Community_Kilimanjaro/Wiki%20Health")).toBe("Wikimedia_Community_Kilimanjaro/Wiki Health");
    expect(parseCourseSlug("https://example.org/courses/a/b")).toBe("");
    expect(parseCourseSlug("https://outreachdashboard.wmflabs.org/campaigns/x")).toBe("");
    expect(parseCourseSlug("just-text")).toBe("");
  });

  test("builds URLs and safe document ids", () => {
    expect(courseUrl("School/Wiki Health")).toBe("https://outreachdashboard.wmflabs.org/courses/School/Wiki%20Health");
    expect(eventDocId("School/Jan.2026")).toBe("School_Jan_2026");
  });
});

describe("eventWindowsInMonth", () => {
  const ev = { slug: "S/A", start: "2026-01-25T21:00:00Z", end: "2026-02-05T20:59:00Z" };
  test("clips an event to the month", () => {
    expect(eventWindowsInMonth([ev], "2026-01")).toEqual([{ event: ev, start: "2026-01-25T21:00:00Z", end: "2026-02-01T00:00:00Z" }]);
    expect(eventWindowsInMonth([ev], "2026-02")).toEqual([{ event: ev, start: "2026-02-01T00:00:00Z", end: "2026-02-05T20:59:00Z" }]);
    expect(eventWindowsInMonth([ev], "2026-03")).toEqual([]);
  });
});

test("fetchCourse reads dates, Wikipedia event id and participants", async () => {
  const fetchImpl = (url) => url.endsWith("/course.json")
    ? ok({ course: { title: "January 2026 Training", start: "2026-01-25T21:00:00.000Z", end: "2026-02-05T20:59:00.000Z", flags: { event_sync: 2936 } } })
    : ok({ course: { users: [{ username: "amina_juma" }, { username: "Baraka" }] } });
  const c = await fetchCourse("S/January_2026_Training", { fetchImpl });
  expect(c).toEqual({
    slug: "S/January_2026_Training", title: "January 2026 Training",
    start: "2026-01-25T21:00:00Z", end: "2026-02-05T20:59:00Z", wikiEventId: "2936",
    participants: ["Amina juma", "Baraka"],
  });
});

describe("fetchEventMonthStats", () => {
  const events = [
    { slug: "S/One", title: "One", start: "2026-03-10T00:00:00Z", end: "2026-03-12T00:00:00Z" },
    { slug: "S/Two", title: "Two", start: "2026-03-11T00:00:00Z", end: "2026-03-20T00:00:00Z" },
    { slug: "S/Old", title: "Old", start: "2026-01-01T00:00:00Z", end: "2026-01-05T00:00:00Z" },
  ];
  const users = { "S/One": ["Amina", "Outsider"], "S/Two": ["Amina", "Baraka"], "S/Old": ["Dora"] };
  // Amina: 2 edits in the overlap of One and Two (must count once), plus one in Two only.
  const contribs = [
    { user: "Amina",  pageid: 1, revid: 11, timestamp: "2026-03-11T08:00:00Z" },
    { user: "Amina",  pageid: 1, revid: 12, timestamp: "2026-03-11T09:00:00Z" },
    { user: "Amina",  pageid: 2, revid: 13, timestamp: "2026-03-15T09:00:00Z" },
    { user: "Baraka", pageid: 3, revid: 14, timestamp: "2026-03-18T09:00:00Z" },
  ];
  const calls = [];
  const fetchImpl = (url) => {
    calls.push(url);
    if (url.includes("outreachdashboard")) {
      const slug = decodeURIComponent(url.split("/courses/")[1].replace("/users.json", ""));
      return ok({ course: { users: users[slug].map(username => ({ username })) } });
    }
    const p = new URL(url).searchParams;
    const people = p.get("ucuser").split("|");
    const list = contribs.filter(c => people.includes(c.user) && c.timestamp >= p.get("ucstart") && c.timestamp <= p.get("ucend"));
    return ok({ query: { usercontribs: list } });
  };

  test("counts only members who joined, inside the event dates, without double counting", async () => {
    const { stats, events: used } = await fetchEventMonthStats(["Amina", "Baraka", "Chausiku"], events, "2026-03", "sw.wikipedia.org", { fetchImpl, delayMs: 0 });
    expect(stats.get("Amina")).toEqual({ articles: 2, edits: 3 });
    expect(stats.get("Baraka")).toEqual({ articles: 1, edits: 1 });
    expect(stats.get("Chausiku")).toEqual({ articles: 0, edits: 0 });   // member, but in no event
    expect(stats.has("Outsider")).toBe(false);                          // joined, but not a member
    expect(used.map(e => [e.title, e.members])).toEqual([["One", 1], ["Two", 2]]);
    // Event "One" only asks Wikipedia about Amina, for its own dates
    const one = new URL(calls.find(u => u.includes("ucstart=2026-03-10")));
    expect(one.searchParams.get("ucuser")).toBe("Amina");
    expect(one.searchParams.get("ucend")).toBe("2026-03-12T00:00:00Z");
  });

  test("a month without events gives everyone 0", async () => {
    const { stats, events: used } = await fetchEventMonthStats(["Amina"], events, "2026-05", "sw.wikipedia.org", { fetchImpl, delayMs: 0 });
    expect(stats.get("Amina")).toEqual({ articles: 0, edits: 0 });
    expect(used).toEqual([]);
  });
});

test("reportScope treats old reports as whole-wiki", () => {
  expect(reportScope({})).toBe("all");
  expect(reportScope({ scope: "events" })).toBe("events");
});

describe("finding events from the activities page", () => {
  const { parseWikiPageUrl, discoverEventPages, findCourseForEvent } = require("./eventContribs");

  test("parseWikiPageUrl", () => {
    expect(parseWikiPageUrl("https://sw.wikipedia.org/wiki/Wikipedia:Kilimanjaro_GSF_Activities"))
      .toEqual({ wiki: "sw.wikipedia.org", title: "Wikipedia:Kilimanjaro GSF Activities" });
    expect(parseWikiPageUrl("https://example.org/wiki/X")).toBe(null);
  });

  test("follows programs and their tabs down to every sub-event, skipping worklists", async () => {
    const fetchImpl = (url) => {
      const p = new URL(url).searchParams;
      if (p.get("action") === "parse" && p.get("prop") === "links") return ok({ parse: { links: [
        { title: "WCK Monthly Edit-thon", exists: true },
        { title: "Event:Let's Connect", exists: false },
      ] } });
      if (p.get("action") === "parse") return ok({ parse: { text:
        '<a href="/wiki/Maalum:MyLanguage/Event:WCK_Monthly_Edit-thon/July_2026_Onboarding">x</a>' +
        '<a href="/wiki/Maalum:MyLanguage/Event:WCK_Monthly_Edit-thon/June_2027_Wrap-up">y</a>' } });
      if (p.get("list") === "allpages") {
        const pages = {
          "WCK Monthly Edit-thon": ["Event:WCK Monthly Edit-thon", "Event:WCK Monthly Edit-thon/July 2026 Onboarding", "Event:WCK Monthly Edit-thon/July 2026 Onboarding/Worklist", "Event:WCK Monthly Edit-thon 2"],
        }[p.get("apprefix")] || [];
        return ok({ query: { allpages: pages.map(title => ({ title })) } });
      }
      // existence check for tab links / red links
      return ok({ query: { pages: p.get("titles").split("|").map(title => ({ title, missing: true })) } });
    };
    const events = await discoverEventPages("https://sw.wikipedia.org/wiki/Wikipedia:Activities", { fetchImpl, delayMs: 0 });
    expect(events).toEqual([
      { title: "Event:Let's Connect", name: "Let's Connect", program: "Let's Connect", isParent: false, exists: false },
      { title: "Event:WCK Monthly Edit-thon", name: "WCK Monthly Edit-thon", program: "WCK Monthly Edit-thon", isParent: true, exists: true },
      { title: "Event:WCK Monthly Edit-thon/July 2026 Onboarding", name: "July 2026 Onboarding", program: "WCK Monthly Edit-thon", isParent: false, exists: true },
      { title: "Event:WCK Monthly Edit-thon/June 2027 Wrap-up", name: "June 2027 Wrap-up", program: "WCK Monthly Edit-thon", isParent: false, exists: false },
    ]);
  });

  test("matches a dashboard course by name only when it is the same name", async () => {
    const fetchImpl = () => ok({ courses: [
      { slug: "WCK/July_2026_Onboarding_And_Orientation_Edit-a-thon", title: "July 2026 Onboarding And Orientation Edit-a-thon" },
      { slug: "WCK/Something_else", title: "Something else" },
    ] });
    expect(await findCourseForEvent("July 2026 Onboarding and Orientation Edit-a-thon", { fetchImpl })).toBe("WCK/July_2026_Onboarding_And_Orientation_Edit-a-thon");
    expect(await findCourseForEvent("July 2026 Onboarding", { fetchImpl })).toBe("");
  });
});
