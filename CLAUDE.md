# CLAUDE.md — Wiki Kilimanjaro GSF Manager

## Project identity

**Wikimedia Community Kilimanjaro GSF Manager** — a React + Firebase web app the
Wikimedians of Kilimanjaro group (Open Knowledge Tanzania) uses to run their
Wikimedia Foundation grants end-to-end: planning, programs and sessions,
event registration, participants, volunteers, budget and invoices, metrics,
and the final learning report.

- Main grant: General Support Fund R-GS-2606-22863 (the app supports several grants)
- Location: Tanzania (Kilimanjaro, Arusha and surrounding regions)
- Currency: TZS, with USD amounts converted at each grant's own rate

---

## ⚠ The app is live — read before changing anything

- **Live site:** https://justine-msechu.github.io/-WikimediaSysManagement/
- **Every push to `main` deploys to production** (`.github/workflows/deploy.yml`,
  Node 20, builds with `CI=true` so ESLint warnings fail the build). Confirm with
  the user before pushing.
- **Local dev uses the live database.** `.env` points at the production Firebase
  project `wikikilimanjaro-gsf`; there is no staging project. Anything created or
  deleted in `npm start` is real team data. Don't create test records or run
  destructive actions locally without the user's OK.
- **Firestore rules are NOT deployed by CI.** After editing `firestore.rules`, the
  user runs `firebase deploy --only firestore:rules` — do this *before* pushing
  code that needs the new rules.

---

## Tech stack

- React 18 (Create React App, `react-scripts` 5), plain JS, no TypeScript
- Firebase: Firestore (all data), Auth (login + roles), Storage
- No UI library — global styles in `src/App.css`
- Libraries: `date-fns`, `lucide-react`, `xlsx` (Excel import/export),
  `react-quill-new` (rich text, via `components/RichTextEditor.js`)
- External APIs called from the browser: MediaWiki Action API (anonymous CORS,
  `origin=*`) on Swahili/English Wikipedia, Wikidata, Commons, Swahili
  Wiktionary and Meta (global accounts), Outreach Dashboard JSON, EmailJS (email), Africa's Talking (SMS),
  Google Drive (file uploads), QR code images (api.qrserver.com)

## How to run

```bash
nvm use            # .nvmrc pins Node 20 (Node 26 is not tested with CRA 5)
npm ci             # install exactly what package-lock.json says
npm start          # http://localhost:3000/-WikimediaSysManagement/  (LIVE data!)
npm test -- --watchAll=false        # Jest (react-scripts test)
CI=true npm run build               # same as the deploy workflow
```

### Docker (local development, safe test data)

```bash
docker compose up --watch        # app :3000 + Firebase emulators (UI :4000)
docker compose run --rm --build seed   # test accounts (one per role) + sample data (below)
docker compose down              # stop; emulator data stays in the emulator_data volume
docker compose down -v           # stop and wipe the local test data
```

- Files: `docker-compose.yml`, `docker/app.Dockerfile` (Node 20, `npm ci`,
  CRA dev server), `docker/emulators.Dockerfile` (Java 21 + Node 20 +
  firebase-tools 15.37.0, Auth + Firestore + UI), `docker/emulators-start.sh`,
  `scripts/seed-emulators.mjs`, `firebase.json` → `emulators`.
- In Docker the app runs with `REACT_APP_USE_EMULATORS=true`
  (`src/firebase/config.js`): a fixed **`demo-wikikilimanjaro`** project id
  (demo- projects can only use emulators), Auth + Firestore connected to the
  emulators (also the secondary app in `createAuthUser`), App Check off. It
  can't reach live data. Without that variable (`npm start`) nothing changes.
- The Firestore emulator enforces the real `firestore.rules` (synced on save).
- Seed data (`scripts/seed-emulators.mjs`, fixed ids, safe to re-run): a
  grant (2026-27), a program, 2 open registration forms, 5 participants (one
  person typed 3 ways across two events, one entered twice in the same event —
  for the People & returning tab), 4 community members (one entered twice with
  different capitals, one real public account `AlvinDulle`, one wrong username —
  for Check usernames), a volunteer and settings. The seed runs from the app
  image, so `--build` picks up edits to the script (it isn't synced by `--watch`).
- Test logins: see `TEST_USERS` / `LOCAL_PASSWORD` in `scripts/seed-emulators.mjs`
  (emulator only). Password-reset emails aren't sent — the link is in the
  emulator logs / Emulator UI.
- **No bind mounts:** Docker Desktop can't reliably read this iCloud-synced
  folder (EIO errors on many files), so source is copied into the image and
  kept in sync by `--watch` (`src/`, `public/`; `package-lock.json` rebuilds).
  Run with `--watch`, or edits won't reach the container.

Environment variables: copy `.env.example` → `.env` (Firebase config, Google
client/Drive folder, EmailJS, reCAPTCHA). CI reads them from GitHub secrets.

**Troubleshooting:** the project lives on an iCloud-synced Desktop. iCloud can
empty files in `node_modules` and create `"<name> 2"` duplicates (folders and
source files). Symptoms: odd crashes inside dependencies, e.g.
`codegen_1.Name is not a constructor`. Fix: `npm ci`. Delete stray `* 2.js`
copies in `src/` (check they're untracked duplicates first).

---

## File structure

```
src/
  App.js              Shell: auth gate, sidebar NAV_ITEMS / NAV_GROUPS, grant
                      selector, renderPage() switch, public ?form= route
  App.css             All global styles
  firebase/           config.js (init from env), firestore.js (generic helpers),
                      auth.js, storage.js
  contexts/AuthContext.js   currentUser + Firestore profile (role)
  services/           One file per collection — pages never call Firestore
                      directly. e.g. programService, budgetService,
                      registrationService, participantService, volunteerService,
                      contributorService, metricsService, grantService,
                      auditService, notificationService, smsService, …
  components/         RichTextEditor, EventSelection, Import*Modal,
                      OnboardingModal, BackToTop
  utils/              Pure helpers (no React/Firebase) — testable:
                      wikiContribs.js, eventContribs.js, eventSelection.js, yearSummary.js,
                      grantScope.js, monthlyNews.js, names.js, grantSpending.js, sanitizeHtml.js,
                      participantPeople.js,
                      contributorPrint.js, certificateArt.js, budgetImport.js,
                      timelineImport.js, wikiImport.js, spendingReport.js,
                      timelineReport.js
  pages/              One page per nav item (see below)
  data/plannedTimeline.js
public/
  certificate/        Wikimedia project logo SVGs for certificate watermarks
```

**Legacy files from the pre-Firebase localStorage version — not imported by the
app, don't build on them:** `data/store.js`, `utils/helpers.js`, `utils/audit.js`,
`utils/migration.js` (one-off localStorage → Firestore migration),
`pages/index.js`, `pages/Application.js`, `pages/ActivityReport.js`,
`pages/OutreachPanel.js`. The old `wikikilimanjaro/` folder in the repo root is
also a leftover copy.

---

## Pages (sidebar groups in App.js)

| Group | Page (file) | Notes |
|---|---|---|
| Overview | Dashboard, Announcements, Deadlines | |
| Grant & planning | Grant (admin), Programs, Timeline, Metrics, **Active contributors** | Programs have sub-programs (sessions) with their own budgets. Active contributors tabs: Report, History, Year summary, Events, Members |
| Activities | Activities (+ ActivityDetail), Participants, Volunteers, Reg. forms (RegistrationForms) | Public sign-up page: `PublicRegister.js` via `?form=<id>` |
| Finance | Budget, Invoices (admin/finance), Review | Review = approve programs, sessions, budget entries |
| Reports | Final report, Donor report, Risk register | |
| Admin | Audit log, Users, Settings | |
| Volunteer portal | My tasks (+ TaskComments) | Volunteers only see this group + Help |

`DATA_PAGES` in `App.js` need a selected grant (most pass `grantId` and filter
by it). Announcements, Deadlines, Settings work without one.

### Adding a page
1. Create `src/pages/MyPage.js` (default export, props at least `{ profile }`)
2. In `App.js`: import it, add to `NAV_ITEMS` (`roles: null` = all staff, or a
   list), add its id to a `NAV_GROUPS` group, add a `case` in `renderPage()`
3. Add to `DATA_PAGES` only if it needs a selected grant
4. Add Firestore rules for any new collection

---

## Roles & permissions

Roles (on `users/{uid}.role`): `admin`, `coordinator`, `finance_officer`,
`viewer`, `volunteer`.

- In pages: `canEdit = ["admin", "coordinator"].includes(profile?.role)` is the
  usual pattern; finance screens use admin/finance_officer.
- In `firestore.rules`: helpers `isAdmin()`, `isCoordinator()` (admin or
  coordinator), `isFinance()` (admin or finance_officer), `isAnyStaff()`
  (everyone except volunteers), `isVolunteer()`.
- Typical collection rule: read `isAnyStaff()`, create/update `isCoordinator()`,
  delete `isAdmin()`. Keep UI buttons consistent with the rules (e.g. only show
  delete to admins when only admins may delete).
- Public (not logged in) writes are allowed only for `registrations` and
  `participants` (fixed key lists, length limits, open form only), plus a +1
  on a form's `registrationCount` — see "Security rules" below.
- Deactivated users (`isActive == false`) are blocked by the rules too, not
  just by the app's "account inactive" screen.

## Security rules (keep these when changing code)

- **Rich text is always sanitized.** Show user/stored HTML only through
  `renderHtml()` (RichTextEditor), which runs `sanitizeHtml()`
  (`utils/sanitizeHtml.js`, allowlist of simple tags, only `href` on links,
  http/https/mailto/tel). Never put stored text into `dangerouslySetInnerHTML`
  or a print window without `renderHtml()` / `esc()` — public registrants
  control names, so unescaped text = XSS in a coordinator's session.
- **Firestore rules enforce roles, not just the UI:**
  - deactivated users (`isActive == false`) get no role (`myRole()` = "disabled").
  - users may change only `lastLogin`, `name`, `phone` on their own doc
    (never role, isActive, email, volunteerId).
  - only admin / finance approve or reject: coordinators can set budget
    entries and programs to draft / submitted only, can't edit approved
    entries except `grantId`; finance may change program approval fields and
    `subPrograms` (Review).
  - public `registrations` / `participants` creates: fixed key list, length
    limits, the form must exist and not be `status: "closed"` (`openForm()`).
    If you add a field to the public form, add it to these key lists.
  - the public page may only add 1 to a form's `registrationCount`.
  - volunteers update only `status`, `volunteerNotes`, `hoursSpent` on their
    own tasks; audit entries must carry the writer's own `userId`;
    notifications: staff may only mark `read`.
- The rules from the security review (commit 86b0a66) are **deployed**
  (released 2026-11-23) and were checked with Firebase's Rules test API
  (`projects/{id}:test` with a `testSuite` and mocked `get()`/`exists()` for
  user and form docs — no deploy, no emulator): 24 cases for coordinator /
  finance / volunteer / deactivated / public access all behave as intended;
  the old rules fail 12 of them. The screens look the same — the rules stop
  requests made around the UI. Finance officers can now approve on Review.
- Check rules compile without deploying: `firebase deploy --only firestore:rules --dry-run`.
  There's no emulator setup (needs Java).
- Firebase Storage isn't set up on the project (files go to Google Drive);
  `storage.rules` is ready (role-based) but not in firebase.json.
- Known gaps: the Africa's Talking SMS key lives in `settings` (readable by
  all staff, used from the browser) — a server function would be needed to
  hide it; `xlsx` 0.18.5 on npm has known issues with untrusted files (only
  staff import files); `react-quill-new` is an unused dependency.

## Main Firestore collections

`grants`, `settings`, `metrics` (doc id = grantId), `programs` (with
`subPrograms[]`), `activities`, `evidence`, `activityFiles`, `budgetEntries`,
`invoices`, `participants`, `registrationForms`, `registrations`, `volunteers`,
`volunteerTasks`, `taskComments`, `communityMembers`, `contributorReports`,
`contributorEvents`,
`risks`, `announcements`, `deadlines`, `notifications`, `comments`, `users`,
`pendingActivations`, `auditLogs`.

Use the helpers in `src/firebase/firestore.js` (`addDocument`, `updateDocument`,
`setDocument` (merge), `deleteDocument`, `listenCollection`, `batchWrite`,
`where`, `orderBy`). `where` + `orderBy` on different fields needs a composite
index — services usually skip `orderBy` and sort client-side instead.

---

## Key business rules

- **Grants keep their data separate — a new grant starts empty.** Every
  record on a grant page must be scoped to the selected grant
  (`utils/grantScope.js`):
  - activities, programs, budget entries, invoices, risks carry `grantId`;
    budget entries created by approvals (Review) take the program's `grantId`.
  - participants belong to a grant by `grantId`, through one of its
    programs, or (self-registered, no grant/program) through the grant's
    registration form (`participantsForGrant(…, { forms, firstGrantId })` —
    pass forms everywhere). Public registration now saves the form's
    `grantId` on the participant. Don't count the whole registry.
  - money (total, rate) comes from the selected grant only — no fallback to
    the legacy `settings.grant` when a grant is selected.
  - metrics are per grant (`metrics/{grantId}`); `DEFAULT_METRICS` targets are
    0, so a new grant isn't pre-filled.
  - final report answers are per grant (`settings.reportAnswersByGrant`);
    legacy `settings.reportAnswers` belongs to the first grant (`oldestGrantId()`).
  - Budget never offers another grant's entries: `budgetEntryFixes()` moves
    untagged/wrongly tagged entries to their program's grant; only entries with
    no grant and no program can be assigned to the current grant.
  - registration forms belong to the grant of their program; volunteer tasks
    likewise. **The program's grant wins over a stored `grantId`**
    (`belongsToGrant()`, `participantsForGrant()` via `programGrantOf()`), so a
    form or sign-up tagged with whichever grant was selected still counts in
    its program's grant. Creating/editing a form saves its program's grant;
    opening Reg. forms (coordinators) fixes forms with a missing or wrong
    `grantId` (`formGrantFixes()`, audited) so the public page tags new
    sign-ups correctly, and warns about forms whose program has no grant
    (those count only in the first grant — assign the program on Programs). Volunteers have `grantIds[]` —
    new ones join the current grant; the Registry offers "Bring volunteers from
    earlier grants" (adds the grant, never copies). `belongsToGrant()`:
    records with no grant at all (from before grants) belong to the first grant.
  - Metrics: Outreach Dashboard fetch uses only the grant's own
    `odCampaignUrl`; the Active contributors panel uses only reports for months
    inside the grant's start/end dates.
  - Volunteers and Reg. forms are in `DATA_PAGES` (need a selected grant).
  - Active contributors: **community members are one list for all grants**
    (tab "Community members", with a "Took part in" column). A grant's
    members are the community members who **took part in that grant** —
    on its participant list, a registration form of the grant (not absent), or
    an event inside its dates (dashboard participants or linked form) —
    `grantParticipation()`. Nothing is assigned by hand. **Returning** = took
    part in this grant and an earlier one (`returningPeople()`, grants ordered
    by `sortGrants()`) — the grant's retention; badges on Community members /
    Year summary / not-yet-members panels, count + "Retained editors =
    returning & editing" button on Metrics. Reports, History, Year summary,
    Events use only months inside the grant's dates; saved monthly reports
    (stored by wiki + month) are filtered to the grant's members
    (`reportForMembers()`), and saving keeps other people's rows. A member with
    no recorded activity in a grant doesn't appear in it.
  - "First grant" (`oldestGrantId()`) = earliest start date (or creation day
    when a grant has no dates). Records from before grants belong to it.
  Shared across grants on purpose: announcements, deadlines, settings.
- **People counts (Dashboard, Donor report, Metrics, Final report overview,
  Programs cards)** come from the Participants list (`participantsForGrant()`
  + `participantStats()`; Programs: participants with that `programId`), never
  the numbers typed on activities (often left empty). Final report Part 2
  (14.1 / 14.2) still shows the saved `metrics/{grantId}` results — filled on
  the Metrics page ("Apply counts to results", active contributors buttons). Dashboard
  "Participants per month" uses the month each participant was added
  (`participantMonth()`); "Activities logged" counts the grant's activities and
  notes program sessions and activities not linked to any grant (click → Activities).
  Donor report notes when activity-typed counts differ; articles
  created/improved still come from activities.
- **Participants → people** (`utils/participantPeople.js`, Participants page
  tab "People & returning", `components/ParticipantPeople.js`): the registry
  has one record per sign-up; records are one person when their Wikipedia
  username matches ignoring capitals, spaces/underscores and "User:"
  (`personKey()`; else email, else tidy name). A person in 2+ events (forms /
  programs) is **Returning**; new = new at their first record. "Fix" / "Fix all
  spellings" writes one name (`bestName()`, tidy full name) and username to all
  their records; "Remove duplicate" deletes extra records in the same event
  (confirm). Wikipedia usernames are case-sensitive after the first letter, so
  when spellings differ the page asks sw.wikipedia (`checkUsernames()`) and
  only rewrites the username if exactly one spelling exists. Metrics registry
  counts editors as people (`peopleCounts()`: editors, new, retained = edited
  before or came back, returning); `participantStats().newEditors` counts each
  person once.
- **Approval flow:** programs and sessions go `draft → submitted → approved /
  rejected`. Approved programs are locked (only admins edit; coordinators may
  still touch `subPrograms`). Approving creates approved `budgetEntries` for
  the line items — session items are created by their own approval, not the
  program's, to avoid double-counting.
- **Budget entries** are grouped into personnel / operational / programmatic
  (`BUDGET_GROUPS` in budgetService). Excel import via `ImportBudgetModal`.
- **Required on the public form:** name, "Have you edited Wikipedia before?"
  (→ `isNew`), **gender** (Female / Male / Non-binary / Prefer not to say —
  same list as Participants; saved on the registration and the participant),
  email, phone. The registrations rule allows `gender` only with one of those
  values (or empty, for old cached pages).
- **Username check on the public form** (`PublicRegister.js`,
  `utils/accountCheck.js` → `checkWikiAccount()`): on leaving the username
  field and on submit, asks sw.wikipedia (`list=users`), then the global
  account (`meta=globaluserinfo`). "Yes, I've edited before" requires a
  username; a username with no Wikimedia account at all blocks the sign-up
  with a message about spelling and capitals (for "first time" people it
  suggests leaving it empty). A global account without a Swahili one is fine
  (created on first visit). If Wikipedia can't be reached, registration is
  never blocked. The saved username is Wikipedia's exact spelling.
- **Full form:** the public page says registration is full and invites people to
  the next events — it never shows the number of places.
- **Registration:** `submitRegistration()` saves the registration, bumps
  `registrationCount` on the form (enforces `maxRegistrations` without auth) and
  auto-adds a participant. `isNew` = "never edited Wikipedia before".
- **Audit:** log create/update/delete/import/export with
  `addAudit(profile, AUDIT_ACTIONS.X, "<module>", { targetId, recordTitle, details })`.

### Active contributors (pages/ActiveContributors.js, utils/wikiContribs.js)
- A community member (`communityMembers`) is **active** in a month if they
  edited ≥ threshold **different** pages on the chosen project in that UTC
  month. Repeat edits to one page count once.
- **Projects** (`WIKIS` in wikiContribs.js — each with `namespaces`, words
  `unit`/`one`/`newUnit`, `kind` and its own default `threshold`; use
  `wikiInfo()` / `thresholdFor()`, never hard-code "articles" or 60):
  Swahili & English Wikipedia — articles, ns 0, **30**; Wikidata — items,
  ns 0|120|146 (items, properties, lexemes), **100**; Wikimedia Commons —
  files, ns 6, new = **uploads**, **20**; Swahili Wiktionary — entries, ns 0, 30.
  The threshold box follows the chosen project. `isArticleWiki()` (kind
  "article"; old reports without `wiki` count as Swahili Wikipedia) — event
  seat ranking and Year summary "All wikis" article totals use only these, so
  Wikidata items / Commons files don't inflate article counts (active / still
  editing and edits count on every project).
- **Projects column** on Community members ("🌍 Check projects"):
  `fetchUserProjects()` reads each member's global account
  (`meta=globaluserinfo&guiprop=merged` on meta.wikimedia.org) — every project
  they edited, all-time edit counts. Kept in the page only, not saved.
- Counts via `list=usercontribs`, 50 users per request, follows `continue`,
  excludes edits at exactly the end timestamp (ucend is inclusive).
- **Still editing** = ≥ `STILL_EDITING_MIN` (1) different article that month —
  the measure of retained members; can fill the Metrics "Retained editors" row.
  Old saved rows without `editing` are handled by `isEditing(row)`.
- Members come from manual/bulk entry, Volunteers, past event Participants, or
  new event registrants. **All community members are volunteers**: at the end of
  the grant they receive certificates, and the reports are the evidence of who
  stayed active/retained.
- **Capital letters don't split a person** (`userKey()` in wikiContribs =
  normalized + lower case, for matching only; Wikipedia requests always use
  the real spelling via `normalizeUsername()`): member lists / imports / bulk
  add (`addCommunityMembersBulk`, `notYetMembers`), "not members" panels
  (`joinedNotMembers`), grant participation (`grantParticipation({ members })`
  maps typed spellings to the member's), and event counts
  (`fetchEventMonthStats`: a form name matches the member; contributions are
  fetched with the dashboard's spelling when there is one).
- **Cleaning up real data** (after importing old lists): Participants → People &
  returning → "Only people to fix" → Fix / Fix all spellings / Remove
  duplicate; Active contributors → Community members → Check usernames →
  Keep this one / save the correct username; then fetch and save the monthly
  reports again and click "Apply counts to results" on Metrics.
- **Check usernames** (Community members, coordinators): lists members entered
  twice with different capitals (admins "Keep this one" — removes the others)
  and members whose username doesn't exist on Swahili Wikipedia
  (`checkUsernames()` — they'd show 0 in every report), with a box to save the
  correct username (audited).
- **Two ways to count** (page-level switch, applies to Report / History / Year
  summary; `SCOPES` + `reportScope()` in wikiContribs.js):
  - **Whole wiki** (`scope: "all"`) — every article edit that month, including
    other groups' events (e.g. Wikimedians of Arusha). Recognises work across
    all of Swahili Wikipedia.
  - **Kilimanjaro events only** (`scope: "events"`, `utils/eventContribs.js`) —
    an edit counts only if the member **joined the event on the Outreach
    (P&E) Dashboard** and made it **between the event's start and end**.
    Events are added on the **Events** tab as dashboard course links
    (`contributorEvents`, id = `eventDocId(slug)`); participants are
    re-fetched live from `courses/{slug}/users.json` when a report runs.
    **Joined** = enrolled on the dashboard course **or** registered on a
    registration form linked to the event (`formIds`; registrations with a
    username, not marked absent — `formJoiners()`), so walk-ins count; they're
    tagged "form only" in reports. Forms whose `wikiEventUrl` points at the
    event page / EventDetails id are suggested (`formMatchesEvent()`).
    People who joined an event but **aren't community members** are not in
    the report rows; they're listed separately ("Joined our events but not in
    the members list" on Report, with their counts; "People in our events who
    aren't members" on Events via `joinedNotMembers()`) with one-click add
    (source "events", real name taken from Participants when known).
    Overlapping events don't double count (page/revision sets are merged).
    **Find events** walks the GSF activities page (`DEFAULT_ACTIVITIES_PAGE`)
    → each program → its navigation-tab links and every `Event:<program>/…`
    sub-page (any depth, worklists skipped), then matches each event to the
    dashboard course with the **same name** (`courses/search.json`); unmatched
    rows take a pasted link. 429 responses are retried.
    Wikipedia's own event contributions list (Special:EventDetails) has no
    public read API, and the Campaign Events REST API rejects browser
    requests, so the dashboard's public JSON (CORS open) is the source.
- Reports are saved to `contributorReports` with id `{wiki}_{YYYY-MM}` (whole
  wiki) or `{wiki}_{YYYY-MM}_events`. Old reports without `scope` = whole wiki.
  Metrics defaults to events-only reports when they exist (selectable); event
  seat ranking always uses whole-wiki reports; certificates printed from
  events-only summaries say "in our community events".
- **Year summary** tab (`utils/yearSummary.js`): per person across the grant
  year (or a quarter / custom range) from saved reports only. Labels: Active
  contributor (reached the active level on any project in any month) > Retained (still editing in
  `RETAINED_MIN_MONTHS` = 3+ months) > Participated. Quarters count from the
  grant's start month; wikis are combined per month; missing months are flagged.
- **Best contributor of the month** (ties share it, nobody wins an empty month):
  - **Across our projects** (All projects panel, newsletter text, Year summary
    "All wikis", certificates' ★ wins) = most **points** over the four projects
    `POINTS_WIKIS` (Swahili Wikipedia, Wikidata, Commons, Swahili Wiktionary;
    not English Wikipedia). Reaching a project's standard active level
    (`thresholdFor()`) = `POINTS_PER_LEVEL` (100) points, so 30 articles =
    100 items = 20 files. `projectPoints()`, `bestAcrossProjects()` (ranking
    with per-project breakdown), `summary.bestByMonth[].byPoints/points`.
  - **On one project** (Report tab, History, Year summary with one wiki) = most
    different pages there — `bestContributors()`.
- **Monthly news** (`utils/monthlyNews.js`, panel on the Report tab): for the
  newsletter — volunteers who edited, different articles (each counted once
  across volunteers, via `pageIds` saved on each row), new articles started
  (`new` flag from usercontribs, titles in `newArticles`), edits, text added
  (`bytes` = sum of `sizediff`), best contributor, and a ready paragraph in
  English or Kiswahili (`newsText()`). Reports saved before these fields show
  "—" until fetched and saved again. History shows different/new articles per month.
  Wording follows the project (items / uploads…). **All projects** panel
  (`projectsNews()` / `projectsText()`): the month across every project's
  report (same month + scope; the one on screen even if unsaved), volunteers
  counted once; "Fetch & save all projects" fetches and saves each project in turn.
- **Printing** (`utils/contributorPrint.js`): monthly report and year/quarter
  summary. HTML opened in a new window with a Print / Save PDF button
  (`openPrintWindow`).

### Certificates
- Two kinds, sharing one footer and watermark:
  - **Community member certificates** — Active contributors → Year summary
    (all, filtered by search, or one row). `certificatesHtml()`. Title, badge and
    wording follow the recognition label (Active contributor → Certificate of
    Recognition; Retained → Certificate of Appreciation; Participated →
    Certificate of Participation); best-of-month wins are printed on it.
  - **Participant certificates** — Participants page → Cert (`printCertificate`
    in Participants.js).
- **Footer** (`certificateFooterHtml` + `CERT_FOOTER_CSS`): coordinator
  signature image with "Name, Title" under the line, and the **date the
  certificate is printed**. No official stamp (the group doesn't have one).
- **Signature** is uploaded by an admin in **Settings → Certificate signature**
  and stored in Firestore `settings/main.certificate`
  `{ signatureImage (PNG data URL, resized to ≤600px), signatoryName,
  signatoryTitle }`. **Never commit the signature image** — the repo and the
  site are public. Printing without one shows a plain "Coordinator signature"
  line (member certificates warn first).
- **Watermark** (`certificateArtHtml`, `certificateIconRowHtml`,
  `CERT_ART_CSS`; URLs from `utils/certificateArt.js`): faint Wikimedia logo in
  the centre, six faint project logos round the edges (sized in % so they fit
  both certificate sizes), and a small colour row under the footer. The SVGs
  are official Wikimedia Commons files (Foundation trademarks, used under the
  affiliate's rights) kept in `public/certificate/` — **not** imported through
  webpack, because CRA's SVG loader fails on one file's editor markup.
- **Names on certificates** come from the community member's `name`.
  Coordinators fix them on Community members (✎ next to the name: Save, "Tidy"
  = `tidyName()` fixes spaces and ALL CAPS / all small letters, or "Use" the
  name from the Participants list). `nameProblem()` (`utils/names.js`) flags
  names to check (missing, same as the username, numbers/symbols, one case,
  only one name) with a "names to check" filter. Saved reports keep the old
  name in their rows, so the Report tab and Year summary show the member's
  current name; renames are audited.
- Org name comes from Settings → Organisation; logo from `src/assets/logo.png`.
  If watermarks don't print, enable "Background graphics" in the print dialog.
- **Metrics** row `activeContributors` is filled from saved reports (latest
  finished month, or different people active at least once). It is the group's
  own metric — don't merge it into the Foundation's editor metrics.

### Event selection (utils/eventSelection.js, components/EventSelection.js)
- Shown in Reg. forms for each event. Registrants are **Member** (username in
  `communityMembers`) or **New**.
- Seats = form `seats`, else `maxRegistrations`, else everyone. `newMemberPct`
  (default 30%) of seats is kept for new members.
- Members are ranked by different articles in the latest saved, finished month
  **before the event's month** (Wikipedia-like wikis only — `isArticleWiki()`,
  so Wikidata items / Commons files don't count); new members go in registration order. Seats one
  group can't fill go to the other; the rest are "Waiting list".
- The panel opens with a summary (registrations = existing members + new, each
  with recommended / waiting, without a username, registered twice) and the
  table is split into the two groups (numbers restart per group). Usernames
  match members ignoring capitals; a later sign-up with the same username is
  listed in `plan.repeats` ("Registered twice", counted once). The
  registrations table below shows each person's Type and Seat (via `onPlan`).
- Coordinators can decide seats by hand in that panel: **Give seat** /
  **Move to waiting list** / **Undo** save `seat: "in" | "out" | ""` on the
  registration (`setSeatChoice()`, audited; coordinators may update
  registrations, so no rule change). Hand-picked people keep their status;
  the remaining seats are filled in rank order, so giving a seat bumps the
  lowest-ranked automatic person. More "in" than seats → `plan.overBooked`
  warning. `seat` isn't in the public create key list (only staff set it).
- The printed attendance sheet lists only people with a seat (status
  recommended / seat given) — not the waiting list or repeat sign-ups. Export
  CSV still has every registration.
- Coordinators add new registrants (with a username) to the community list —
  the public form never writes to `communityMembers`.

---

## Design principles

- Sidebar dark green `#1c2b1e`, active brand green `#4a9e6b`; light gray page
  background `#f5f4f0`, white panels. Accent colours used across pages:
  `#2d7a4f` (success), `#d97706` (warning), `#2563eb` (info), `#c0392b` (danger).
- Flat and functional: no gradients. Reuse existing classes — `page-title`,
  `page-sub`, `panel`, `panel-title`, `form-grid`, `field`, `btn btn-primary
  btn-sm btn-danger`, `btn-row`, `tab-bar`/`tab-btn`, `card-grid`/`stat-card`,
  `badge badge-green|amber|blue|red|gray`, `alert alert-info|warn|error|success`,
  `progress-bar`, `empty`, plain `<table>`.
- Toasts: fixed bottom-right green box (copy the pattern from RiskRegister.js).
- Sentence case everywhere; table headers are uppercase via CSS.
- **Large screens:** all sizes are fixed px, so `App.css` ("Large screens")
  scales `.app-layout` and `.auth-wrap` with `zoom: var(--ui-scale)` — 1.1 from
  1500px wide, 1.2 from 1800px, 1.35 from 2200px, 1.5 from 2800px — and widens
  `.page-wrap` (centred, 1320px / 1440px). Under zoom, `100vh` is scaled too,
  so heights use `calc(100vh / var(--ui-scale))`. Phones, laptops (<1500px)
  and print are unchanged. New full-height elements must follow the same rule.
- **Responsive on every screen.** Tables: `utils/responsiveTables.js`
  (installed in App.js) labels every body cell with its column name and adds
  `.table-cards` when a table is wider than its container — on phones and
  laptops it becomes one card per row (wide screens: first column as the card
  title, other fields side by side with the label above; ≤600px: one field per
  line, label on the left); when it fits it stays a table (opt out:
  `className="no-cards"`; printing keeps tables). List + detail pages use
  `.split-layout` (280px + `minmax(0, 1fr)`, stacked below 1000px) — never a
  plain `1fr` next to wide content. Below 1000px the list column
  (`.split-list`) hides while an item is open; its Close button goes back. `.page-wrap` max 1180px; links in panels wrap. On touch screens ≤1000px
  inputs/selects are 16px (`!important`) — smaller text makes iPhones zoom in on
  tap and stay zoomed, which looks like the page is cut off on the right.
  Check layout changes at 360–400px (phone), ~768px and ~1280px.
- **Timeline page** (`.tl-*` in App.css): summary tiles (planned months, done,
  overdue = planned month already past with nothing logged, not in the plan);
  Planned vs actual grid with a legend (done / planned this month / planned /
  planned-not-logged / not in the plan), this month highlighted, month headers
  jump the calendar, sticky program column, progress bar (`no-cards`, scrolls
  sideways on phones); calendar with its own ‹ › nav (activity names become
  colour bars on phones); dated list of the month's activities.
- **Program cards** (Programs page, `.program-*` in App.css): name + status badge
  (`PROGRAM_STATUS`: Draft / Pending approval / Approved / Returned), category
  and "Approved by … on …" underneath, actions on the right; descriptions over
  ~260 characters are shortened with "Show more"; notes as `alert`s; figures
  as small tiles (2 per row on phones).
- Pure logic goes in `src/utils/` with a Jest test next to it
  (`*.test.js`, fake `fetch` for API code).

---

## Wikimedia GSF report structure (for reference)

```
Part 1: Your work and learning
  Q1 programs vs challenges · Q2 building on successes · Q3 links to reports
  Q4 sharing interest · Q5 feedback collected · Q6 diversity (participants,
  content, retention)
Part 2: Metrics
  14.1 participants, editors, organizers (target vs result)
  14.2 Wikimedia project contributions (target vs result)
Part 3: Skill development — Q12 skills gained · Q13 one capacity area next year
Part 4: Financial — Q15 total spent · Q16 by category · Q17 other revenue
  Q18 financial report link · Q19 unspent funds · Q20 compliance declarations
```

Final report Part 2 (`FinalReport.js` METRIC_ROWS) mirrors the Foundation's
fixed metrics only — results saved on Metrics, so they read 0 until applied
there. The overview cards and Q6 women line count the Participants list. Part 4 Q15 (total spent, % of grant, remaining) and Q16
(by budget group) are filled from the grant's **approved** budget entries —
`spendingSummary()` in `utils/grantSpending.js`, same figure as Budget/Dashboard.

## Affiliate Health Criteria mapping

| Criterion | Covered in system |
|-----------|------------------|
| 1.1 Goal delivery | Dashboard, Metrics, Final report Part 1 Q1 |
| 2.1 Health & resilience | Volunteers, Active contributors, Final report Part 3 |
| 2.2 Diversity balance | Participants (gender, new editors), event seats for new members, Final report Q6 |
| 2.3 Governance | Users & roles, Audit log, Settings |
| 3.1 Leadership | Volunteers & tasks, Final report Part 3 |
| 3.2 Financial compliance | Budget, Review approvals, Invoices, Donor report, Final report Part 4 |
| 3.3 Universal Code of Conduct | Settings / application information |
| 4.1 Internal engagement | Announcements, Volunteers, Active contributors |
| 4.2 Community connection | Registration forms, Participants, activity summaries |
| 4.3 Partnerships | Programs, activity partners |

---

*Last updated: November 2026*
*Maintained by: Wikimedians of Kilimanjaro / Open Knowledge Tanzania*
