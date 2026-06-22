import * as XLSX from "xlsx";

const MONTH_ABBR = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// Accepts headers like "Jul-26", "Jul 26", "July-2026".
function parseMonthHeader(label) {
  const m = String(label || "").trim().match(/^([A-Za-z]{3,})[\s-]?'?\s*(\d{2,4})$/);
  if (!m) return null;
  const mon = MONTH_ABBR[m[1].toLowerCase().slice(0, 3)];
  if (!mon) return null;
  let year = Number(m[2]);
  if (year < 100) year += 2000;
  return `${year}-${String(mon).padStart(2, "0")}`;
}

function normalizeName(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Suggests the best-matching existing Program for a parsed timeline row, by loose
// word overlap on normalized names — coordinators often type a program's name
// slightly differently in a spreadsheet than it's stored in the system.
export function suggestProgramMatch(rowName, programs) {
  const norm = normalizeName(rowName);
  if (!norm) return null;
  const exact = programs.find(p => normalizeName(p.name) === norm);
  if (exact) return exact;
  const words = norm.split(" ").filter(w => w.length > 2);
  let best = null, bestScore = 0;
  programs.forEach(p => {
    const pNorm = normalizeName(p.name);
    const score = words.filter(w => pNorm.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = p; }
  });
  return bestScore > 0 ? best : null;
}

// Parses an ArrayBuffer (from <input type="file">) into { rows, monthKeys }.
// Expects a "Timeline" sheet: column A = program name, remaining columns = months
// (header like "Jul-26"); any non-empty cell under a month column marks it as planned —
// matching the dot-grid layout of the original WMF timeline document.
export function parseTimelineWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = wb.Sheets["Timeline"];
  if (!sheet) {
    throw new Error('This file is missing the "Timeline" sheet — it doesn\'t match the expected template.');
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const headerRow = data[0] || [];
  const monthCols = headerRow
    .map((h, i) => ({ index: i, key: i === 0 ? null : parseMonthHeader(h) }))
    .filter(c => c.key);
  if (monthCols.length === 0) {
    throw new Error('No month columns recognised — headers should look like "Jul-26", "Aug-26", etc.');
  }

  const rows = data.slice(1)
    .filter(r => r && r[0])
    .map(r => ({
      programName: String(r[0]).trim(),
      months: monthCols.filter(c => r[c.index] !== null && r[c.index] !== "" && r[c.index] !== 0).map(c => c.key),
    }))
    .filter(r => r.programName);

  const monthKeys = [...new Set(monthCols.map(c => c.key))].sort();
  return { rows, monthKeys };
}
