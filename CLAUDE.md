# CLAUDE.md — Wiki Kilimanjaro GSF Manager
# ─────────────────────────────────────────────────────────────────────────────
# This file is the master prompt for Claude Code in VS Code.
# Drop this file in the project root and Claude will read it automatically.
# Run: claude (in terminal) or use the Claude Code extension.
# ─────────────────────────────────────────────────────────────────────────────

## Project identity

You are working on the **Wikimedia Community Kilimanjaro GSF Manager** — a
React web application that helps the Wikimedians of Kilimanjaro group
(Open Knowledge Tanzania) manage their Wikimedia Foundation General Support
Fund grant cycle end-to-end.

Grant ID: R-GS-2606-22863
Organisation: Wikimedians of Kilimanjaro group / Open Knowledge Tanzania
Location: Tanzania (Kilimanjaro, Arusha and surrounding regions)
Currency: TZS (Tanzanian Shilling)

---

## What this system does

1. **Application** — fills the Wikimedia GSF application form (Fluxx) with all
   required fields: proposal title, dates, programs, team, partners, categories,
   Movement Strategy 2030 selections, budget overview.

2. **Activities** — every event (edit-a-thon, Wiki Malkia session, school Kiwix
   outreach, mentorship, Let's Connect, campaigns) is logged with:
   - Participation data (total, women, new editors, youth, PWD)
   - Content contributions (Wikipedia articles created/improved, Commons, Wikidata)
   - Budget spend
   - Narrative: summary, challenges, lessons learned, impact stories, next steps

3. **Activity reports** — each logged activity generates a standalone report
   (downloadable .txt) that the responsible team member submits. These accumulate
   as evidence throughout the grant year.

4. **Metrics** — tracks all Wikimedia metrics (participants, editors, organizers,
   project contributions) with target vs result comparison.

5. **Budget** — tracks planned vs actual spend across three categories:
   Personnel costs, Operational costs, Programmatic costs.

6. **Final report** — compiles everything into a complete draft of the Wikimedia
   GSF Final Learning Report (Parts 1–4), ready to paste into Fluxx.

---

## Tech stack

- React 18 (Create React App)
- No backend — all state in localStorage (key: "wkgsf_v1")
- No UI library — custom CSS in App.css
- lucide-react for icons (if needed)
- date-fns for date helpers (if needed)

## File structure

```
src/
  App.js           ← Root component, navigation, state management
  App.css          ← All global styles (sidebar, cards, tables, forms, badges)
  index.js         ← ReactDOM entry
  data/
    store.js       ← defaultState, load(), save(), reset()
  utils/
    helpers.js     ← fmt(), pct(), buildActivityReport(), compileGrantReport()
                      ACTIVITY_TYPES, BUDGET_CATS, PROGRAM_CATS, MS_OPTIONS
  pages/
    Dashboard.js   ← Overview: stats cards, progress bars, recent activities
    Application.js ← Full GSF application form (re-exports from index.js)
    Activities.js  ← Log form + activity table + delete
    ActivityReport.js ← Per-activity report view with download
    Metrics.js     ← Editable metrics targets and results (re-exports)
    Budget.js      ← Budget categories + expense log (re-exports)
    FinalReport.js ← Auto-compiled grant report, copy/download (re-exports)
    Settings.js    ← Org details, grant config, data export/reset (re-exports)
    index.js       ← Houses Metrics, Budget, Application, FinalReport, Settings
```

---

## State shape (localStorage "wkgsf_v1")

```js
{
  org: { name, country, type, grantId, grantCycle, metaPage, website,
         governance, contactEmail },

  application: { title, startDate, endDate, location, programs, team,
                 partners, categories[], movementStrategy[],
                 hasPreviousGrant, coiDeclaration, additionalInfo },

  budget: { total, currency, planned: { personnel, operational, programmatic },
            spent: { personnel, operational, programmatic },
            expenses: [{ cat, amount, desc, date }],
            otherRevenue, otherRevenueDetails },

  metrics: { participants, allEditors, newEditors, retainedEditors,
             allOrganizers, newOrganizers,   // each: { target, result }
             projects: [{ name, tCreated, tImproved, rCreated, rImproved }] },

  activities: [{
    id, name, type, date, location, reportedBy,
    participants, women, newEditors, youth, pwd,
    created, improved, commons, wikidata,
    cost, budgetCat, link,
    summary, challenges, lessons, stories, nextSteps
  }],

  team: [{ id, name, role, username, email }]
}
```

---

## Key business rules

- Every activity must have a name, date, and at least participants count.
- Women count, new editors, youth, PWD are optional but important for diversity reporting (Affiliate Health Criterion 2.2).
- Summary, challenges, lessons, stories, nextSteps are the narrative fields that feed directly into the Wikimedia report Part 1.
- Budget: expenses automatically update `budget.spent[category]`. Deleting an expense reverses the amount.
- The final report (`compileGrantReport`) reads from `state.metrics` (not raw activities) for headline numbers, so team must update metrics manually or via activity accumulation.
- `buildActivityReport(activity)` returns plain text for individual activity .txt download.
- `compileGrantReport(state)` returns `{ part1q1, part1q2, part2metrics, part3skills, part4finance }` — all strings ready to paste into Fluxx.

---

## Design principles

- Sidebar navigation: dark green (#1c2b1e) with active state in brand green (#4a9e6b).
- Clean white panels on light gray background (#f5f4f0).
- No gradients, no shadows — flat, professional, functional.
- Tables for lists, stat cards for summary numbers, progress bars for targets.
- Sentence case everywhere. No ALL CAPS except table headers (uppercase, letter-spacing).
- All money values formatted with `fmt()` → toLocaleString().
- All percentages use `pct(result, target)` capped at 999%.

---

## How to run

```bash
# Install dependencies
npm install

# Start development server
npm start
# → Opens http://localhost:3000

# Build for production
npm run build
```

---

## Common tasks for Claude

### Add a new field to the activity log form
1. Add the field to the `empty()` function in Activities.js
2. Add the input in the JSX form section
3. Add it to `buildActivityReport()` in helpers.js
4. If it's a metric, add it to `compileGrantReport()` too

### Add a new Wikimedia project to metrics
In store.js `defaultState.metrics.projects`, add:
`{ name: "Wiktionary", tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 }`

### Change the grant total or currency
Update `defaultState.budget.total` and `defaultState.budget.currency` in store.js,
OR go to Settings page in the running app.

### Add a new team member role
Update `defaultState.team` in store.js.

### Add a new activity type
Add the string to `ACTIVITY_TYPES` array in helpers.js.

### Export all activity reports as one document
In FinalReport.js, add a function that maps `state.activities` through
`buildActivityReport()` and joins them, then downloads as a single .txt.

### Add a timeline/calendar view (Question 10 of application)
Create `src/pages/Timeline.js`. Map `state.activities` by month into a
calendar grid. Add a "Timeline" entry to NAV in App.js.

### Add photo/document upload to activities
Since there's no backend, use base64 in localStorage or add a Google Drive
link field to the activity form.

---

## Wikimedia GSF report structure (for reference)

```
Part 1: Your work and learning
  Q1: Programs, approaches, strategies vs challenges
  Q2: Plans to build on successes
  Q3: Links to reports (Meta-Wiki pages)
  Q4: Interest in sharing with wider community
  Q5: Feedback collected (impact stories, surveys)
  Q6: Diversity efforts (6.1 participants, 6.2 content, 6.3 retention)

Part 2: Metrics
  14.1 Participants, editors, organizers (target vs result)
  14.2 Wikimedia project contributions (target vs result)

Part 3: Skill Development / Capacity Building
  Q12: Skill development from grant
  Q13: One capacity area for next year

Part 4: Financial reporting
  Q15: Total amount spent (local currency)
  Q16: Breakdown by category (personnel, operational, programmatic)
  Q17: Other revenue sources
  Q18: Link to financial report document
  Q19: Unspent funds
  Q20: Compliance declarations (fund agreement, laws, IRS)
```

---

## Affiliate Health Criteria mapping

| Criterion | Covered in system |
|-----------|------------------|
| 1.1 Goal delivery | Dashboard progress bars, Final report Part 1 Q1 |
| 2.1 Health & resilience | Application team/partners, Final report Part 3 |
| 2.2 Diversity balance | Activity form (women, youth, PWD), Final report Q6 |
| 2.3 Governance | Application COI field, Settings org details |
| 3.1 Leadership | Application team field, Final report Part 3 |
| 3.2 Financial compliance | Budget panel, Final report Part 4 |
| 3.3 Universal Code of Conduct | Application additional info field |
| 4.1 Internal engagement | Activity type: Community gathering / Let's Connect |
| 4.2 Community connection | Activity summaries feed into Part 1 Q1 |
| 4.3 Partnerships | Application partners field, activity types |

---

*Last updated: June 2026*
*Maintained by: Wikimedians of Kilimanjaro / Open Knowledge Tanzania*
