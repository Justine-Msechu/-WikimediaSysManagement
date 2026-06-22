import * as XLSX from "xlsx";

const PROGRAM_COLORS = ["#2d7a4f", "#2563eb", "#9333ea", "#d97706", "#0891b2", "#c0392b", "#059669", "#7c3aed", "#db2777"];

// Keyword → category mapping for the standard WKK budget template's program names.
const CATEGORY_RULES = [
  { test: /edit-?a-?thon/i,           category: "Content Creation" },
  { test: /wikihealth/i,              category: "Health & Outreach" },
  { test: /malkia/i,                  category: "Gender Equity" },
  { test: /connect/i,                 category: "Capacity Building" },
  { test: /error.*fix/i,              category: "Content Quality" },
  { test: /kiwix/i,                   category: "Education" },
  { test: /community gathering/i,     category: "Community" },
  { test: /conference/i,              category: "Capacity Building" },
  { test: /feminism|folklore/i,       category: "Gender Equity" },
  { test: /leadership|recognition/i,  category: "Gender Equity" },
];

function guessCategory(name) {
  const rule = CATEGORY_RULES.find(r => r.test.test(name || ""));
  return rule ? rule.category : "Other";
}

function findHeaderRowIndex(rows, markerCell = "#") {
  return rows.findIndex(r => r[0] === markerCell);
}

// Reads a sheet's rows until the first row whose first cell isn't a number (stops at TOTAL rows / blank rows).
function readDataRows(rows, headerIdx) {
  const data = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (typeof r[0] !== "number") break;
    data.push(r);
  }
  return data;
}

function parseProgramsSheet(rows) {
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) return [];
  return readDataRows(rows, headerIdx).map(r => ({
    name:            String(r[1] || "").trim(),
    eventsPerYear:   Number(r[2]) || 1,
    costPerEventUSD: Number(r[3]) || 0,
    totalUSD:        Number(r[4]) || 0,
    originalUSD:     Number(r[6]) || 0,
    description:     String(r[7] || "").trim(),
  })).filter(p => p.name);
}

function parseOperationsSheet(rows) {
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) return [];
  return readDataRows(rows, headerIdx).map(r => ({
    item:        String(r[1] || "").trim(),
    category:    String(r[2] || "").trim(),
    unitCostUSD: Number(r[3]) || 0,
    units:       Number(r[4]) || 1,
    totalUSD:    Number(r[5]) || 0,
    notes:       String(r[7] || "").trim(),
  })).filter(o => o.item);
}

// Parses an ArrayBuffer (from a <input type="file">) into the structured preview the
// import modal renders. conversionRate is the active grant's own USD-per-TZS rate —
// all TZS figures are derived from it, never from whatever rate the spreadsheet used.
export function parseBudgetWorkbook(arrayBuffer, conversionRate) {
  const rate = Number(conversionRate) || 0.000413;
  const wb = XLSX.read(arrayBuffer, { type: "array" });

  const programsSheet    = wb.Sheets["Programs Budget"];
  const operationsSheet  = wb.Sheets["Operations Budget"];
  if (!programsSheet || !operationsSheet) {
    throw new Error('This file is missing the "Programs Budget" and/or "Operations Budget" sheet — it doesn\'t match the expected template.');
  }

  const programRows = XLSX.utils.sheet_to_json(programsSheet, { header: 1, defval: null });
  const opsRows      = XLSX.utils.sheet_to_json(operationsSheet, { header: 1, defval: null });

  const programs = parseProgramsSheet(programRows).map((p, i) => ({
    name:               p.name,
    category:           guessCategory(p.name),
    color:              PROGRAM_COLORS[i % PROGRAM_COLORS.length],
    plannedSessions:    p.eventsPerYear,
    description:        p.description,
    requestedBudgetUSD: p.totalUSD,
    requestedBudgetTZS: Math.round(p.totalUSD / rate),
    originalUSD:        p.originalUSD,
    include:            true,
  }));

  const opsRowsParsed = parseOperationsSheet(opsRows);

  const personnel = opsRowsParsed
    .filter(o => o.category === "Personnel related expenses" && o.unitCostUSD > 0)
    .map(o => ({
      name:           o.item,
      monthlySalaryUSD: o.unitCostUSD,
      monthlySalaryTZS: Math.round(o.unitCostUSD / rate),
      include:        true,
    }));

  const opsEntries = opsRowsParsed
    .filter(o => o.category !== "Personnel related expenses" && o.totalUSD > 0)
    .map(o => ({
      title:      o.item,
      notes:      o.notes,
      amountUSD:  o.totalUSD,
      amountTZS:  Math.round(o.totalUSD / rate),
      category:   /bank/i.test(o.item) ? "Bank fees" : "Other",
      include:    true,
    }));

  const skipped = opsRowsParsed.filter(o => o.totalUSD === 0).map(o => o.item);

  return { programs, personnel, opsEntries, skipped, rate };
}
