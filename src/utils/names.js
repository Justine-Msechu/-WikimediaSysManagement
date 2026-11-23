// ── Member names — neat names for certificates ────────────────────────────────
// Pure JS. Community members sometimes register with a username, a nickname or
// all capitals; coordinators fix the name before printing certificates.

import { normalizeUsername } from "./wikiContribs";

const titleWord = (w) => w.toLowerCase().replace(/(^|[-'’])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());

// "  amina   JUMA_" → "Amina Juma". Mixed-case names keep their capitals (e.g. "McDonald").
export function tidyName(raw) {
  const s = String(raw || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const letters = s.replace(/[^\p{L}]/gu, "");
  const oneCase = letters === letters.toLowerCase() || letters === letters.toUpperCase();
  return oneCase ? s.split(" ").map(titleWord).join(" ") : s;
}

/**
 * Why a name may not look right on a certificate, or "" when it looks fine.
 * Checks: missing, same as the Wikipedia username, digits or underscores,
 * all small / all capital letters, only one name.
 */
export function nameProblem(name, username = "") {
  const s = String(name || "").trim();
  if (!s) return "No name";
  if (/[0-9_@]/.test(s)) return "Has numbers or symbols";
  if (username && normalizeUsername(s) === normalizeUsername(username) && !/\s/.test(s)) return "Same as the username";
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (letters.length > 1 && letters === letters.toLowerCase()) return "All small letters";
  if (letters.length > 3 && letters === letters.toUpperCase()) return "All capital letters";
  if (!/\s/.test(s)) return "Only one name";
  return "";
}
