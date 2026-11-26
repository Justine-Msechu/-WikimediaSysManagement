// ── Responsive tables ─────────────────────────────────────────────────────────
// Every <table> in the app shows as cards (one card per row, each value with
// its column name) when it doesn't fit the space it has — on phones, and on
// laptops when a table has many columns. When it fits, it stays a table.
// Installed once in App.js; works on tables added later (MutationObserver)
// and on window resize. Styles: "Responsive tables" in App.css.
// Opt out with <table className="no-cards">.

// Column names from the header row, allowing for colSpan.
export function headerLabels(table) {
  const row = table.tHead?.rows?.[table.tHead.rows.length - 1];
  if (!row) return [];
  const labels = [];
  for (const th of row.cells) {
    const text = (th.textContent || "").trim();
    for (let i = 0; i < (th.colSpan || 1); i++) labels.push(text);
  }
  return labels;
}

// data-label on every body cell = its column's name (cells spanning several
// columns — e.g. group headings — get none).
export function labelCells(table) {
  const labels = headerLabels(table);
  if (!labels.length) return;
  for (const body of [...table.tBodies, ...(table.tFoot ? [table.tFoot] : [])]) {
    for (const tr of body.rows) {
      let col = 0;
      for (const td of tr.cells) {
        const span = td.colSpan || 1;
        const label = span === 1 ? labels[col] || "" : "";
        if (td.getAttribute("data-label") !== label) td.setAttribute("data-label", label);
        col += span;
      }
    }
  }
}

// Cards when the table is wider than its container.
export function fitTable(table) {
  const parent = table.parentElement;
  if (!parent) return;
  table.classList.remove("table-cards");
  const avail = parent.clientWidth;
  if (!avail || !table.offsetWidth) return;      // hidden
  if (table.offsetWidth > avail + 2) table.classList.add("table-cards");
}

export function installResponsiveTables(root = document.body) {
  if (typeof window === "undefined" || !root) return () => {};
  let frame = 0;
  const run = () => {
    frame = 0;
    root.querySelectorAll("table:not(.no-cards)").forEach(t => { labelCells(t); fitTable(t); });
  };
  const schedule = () => { if (!frame) frame = window.requestAnimationFrame(run); };
  // Our own attribute/class changes aren't observed, so this can't loop.
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  window.addEventListener("resize", schedule);
  schedule();
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", schedule);
    if (frame) window.cancelAnimationFrame(frame);
  };
}
