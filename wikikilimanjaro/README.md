# Wiki Kilimanjaro — GSF Manager

A web application for the **Wikimedians of Kilimanjaro group / Open Knowledge Tanzania** to manage their Wikimedia Foundation General Support Fund grant cycle.

## What it does

- **Fill the grant application** — all required Wikimedia GSF Fluxx fields in one place
- **Log every activity** — edit-a-thons, Wiki Malkia, Kiwix school outreach, campaigns, mentorship sessions
- **Generate per-activity reports** — each team member submits a report; download as .txt
- **Track metrics** — participants, editors, organizers, Wikipedia / Commons / Wikidata contributions
- **Manage budget** — planned vs actual spend across Personnel, Operational, Programmatic
- **Generate the final report** — auto-compiled from all logged data, paste directly into Fluxx

## Quick start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## For Claude Code (VS Code)

Open this folder in VS Code with the Claude Code extension.
Claude will read `CLAUDE.md` automatically for full project context.

```bash
# In VS Code terminal:
claude
```

Then ask Claude to:
- Add a new feature ("add a photo link field to the activity form")
- Fix a bug ("the budget totals aren't updating when I delete an expense")
- Generate a report ("show me all activities from this month")
- Add a new page ("build a timeline/calendar view for Question 10")

## Data

All data is saved in your browser's **localStorage** — no server, no account needed.
Go to **Settings → Export backup** to download a JSON backup anytime.

## Grant details

| Field | Value |
|-------|-------|
| Grant ID | R-GS-2606-22863 |
| Organisation | Wikimedians of Kilimanjaro / Open Knowledge Tanzania |
| Cycle | 2025–2026 |
| Currency | TZS |

## Team workflow

1. **Coordinator** fills the Application tab once at grant start
2. **Each team member** logs activities after every event in the Activities tab
3. **Each team member** downloads their activity's report from the Report button
4. **Coordinator** updates Metrics tab monthly
5. **Coordinator** logs expenses in Budget tab
6. **Coordinator** uses Final Report tab to generate the Fluxx submission draft
