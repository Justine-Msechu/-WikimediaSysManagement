import { spendingSummary } from "./grantSpending";

test("spendingSummary counts approved entries only, by group, in TZS and USD", () => {
  const groupOf = (c) => ({ Salaries: "Personnel", "Venue rentals": "Activities" })[c] || "Other";
  const s = spendingSummary([
    { status: "approved", amount: 1000000, category: "Salaries" },
    { status: "approved", amount: 3000000, category: "Venue rentals" },
    { status: "submitted", amount: 9000000, category: "Venue rentals" },
  ], { rate: 0.0004, totalUSD: 4000, groupOf });
  expect(s.spentTZS).toBe(4000000);
  expect(s.spentUSD).toBeCloseTo(1600);
  expect(s.remainingUSD).toBeCloseTo(2400);
  expect(s.pctUsed).toBe(40);
  expect(s.groups.map(g => [g.group, g.tzs, g.pct])).toEqual([["Activities", 3000000, 75], ["Personnel", 1000000, 25]]);
  expect(spendingSummary([], {}).groups).toEqual([]);
});
