// ── Does this Wikipedia account exist? (public registration form) ─────────────
// Pure JS with an injectable fetch. Anonymous, CORS-open MediaWiki API calls.
//
//   "sw"      — the account exists on Swahili Wikipedia (canonical spelling returned)
//   "global"  — no Swahili account yet, but the global Wikimedia account exists
//               (it is created on Swahili Wikipedia the first time they visit)
//   "missing" — no Wikimedia account with this name: a typo or wrong capitals
//   "error"   — couldn't check (offline, API down) — never block on this

import { normalizeUsername } from "./wikiContribs";

const api = (host, params) =>
  `https://${host}/w/api.php?${new URLSearchParams({ ...params, format: "json", formatversion: "2", origin: "*" })}`;

export async function checkWikiAccount(raw, { fetchImpl = fetch, wiki = "sw.wikipedia.org" } = {}) {
  const username = normalizeUsername(raw);
  if (!username) return { status: "missing", username: "" };
  try {
    const local = await (await fetchImpl(api(wiki, { action: "query", list: "users", ususers: username }))).json();
    const u = local?.query?.users?.[0];
    if (u && !u.missing && !u.invalid) return { status: "sw", username: u.name || username };
    if (u?.invalid !== undefined && u.invalid !== false) return { status: "missing", username, invalid: true };
    const global = await (await fetchImpl(api("meta.wikimedia.org", { action: "query", meta: "globaluserinfo", guiuser: username }))).json();
    const g = global?.query?.globaluserinfo;
    if (g && g.missing === undefined && g.name) return { status: "global", username: g.name };
    return { status: "missing", username };
  } catch {
    return { status: "error", username };
  }
}
