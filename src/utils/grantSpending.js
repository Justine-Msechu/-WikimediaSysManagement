// ── Grant spending for the final report (Q15 / Q16) ───────────────────────────
// Pure JS. Spent = the grant's APPROVED budget entries (amounts in TZS), the
// same figure Budget and Dashboard show. conversionRate = USD per TZS.

/**
 * entries: budget entries (already this grant's)
 * opts:    { rate (USD per TZS), totalUSD, groupOf(category) → group name }
 * Returns { spentTZS, spentUSD, totalUSD, remainingUSD, pctUsed,
 *           groups: [{ group, tzs, usd, pct }] (largest first) }
 */
export function spendingSummary(entries, { rate = 0, totalUSD = 0, groupOf = () => "Other" } = {}) {
  const approved = (entries || []).filter(e => e.status === "approved");
  const byGroup = new Map();
  let spentTZS = 0;
  for (const e of approved) {
    const amt = Number(e.amount) || 0;
    spentTZS += amt;
    const g = groupOf(e.category) || "Other";
    byGroup.set(g, (byGroup.get(g) || 0) + amt);
  }
  const usd = (tzs) => (rate ? tzs * rate : 0);
  const spentUSD = usd(spentTZS);
  const total = Number(totalUSD) || 0;
  const groups = [...byGroup.entries()]
    .map(([group, tzs]) => ({ group, tzs, usd: usd(tzs), pct: spentTZS ? Math.round((tzs / spentTZS) * 100) : 0 }))
    .sort((a, b) => b.tzs - a.tzs);
  return {
    spentTZS, spentUSD, totalUSD: total,
    remainingUSD: total ? total - spentUSD : 0,
    pctUsed: total && rate ? Math.round((spentUSD / total) * 100) : 0,
    groups,
  };
}
