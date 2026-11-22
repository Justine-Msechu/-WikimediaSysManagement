import React, { useState, useEffect, useMemo } from "react";
import {
  listenCommunityMembers, addCommunityMember, updateCommunityMember, deleteCommunityMember,
  addCommunityMembersBulk, saveContributorReport, listenContributorReports, reportId,
  listenContributorEvents, saveContributorEvent, deleteContributorEvent,
} from "../services/contributorService";
import {
  fetchEventMonthStats, fetchCourse, parseCourseSlug, courseUrl, eventDocId, eventWindowsInMonth,
  discoverEventPages, findCourseForEvent, DEFAULT_ACTIVITIES_PAGE,
} from "../utils/eventContribs";
import { listenVolunteers } from "../services/volunteerService";
import { listenParticipants } from "../services/participantService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { listenSettings } from "../services/settingsService";
import { monthReportHtml, yearReportHtml, certificatesHtml, openPrintWindow } from "../utils/contributorPrint";
import logo from "../assets/logo.png";
import { certificateArt } from "../utils/certificateArt";
import {
  WIKIS, DEFAULT_WIKI, DEFAULT_THRESHOLD,
  normalizeUsername, currentMonth, lastFullMonth, isPartialMonth, previousMonths,
  fetchMonthStats, checkUsernames, buildReportRows, rowsToCsv, isEditing, bestContributors, STILL_EDITING_MIN,
  SCOPES, DEFAULT_SCOPE, reportScope, scopeLabel,
} from "../utils/wikiContribs";
import {
  RETAINED_MIN_MONTHS, LABELS as YEAR_LABELS, defaultPeriod, quarters, buildYearSummary, yearSummaryToCsv,
} from "../utils/yearSummary";

const TABS = ["Report", "History", "Year summary", "Events", "Members"];
const SCOPED_TABS = ["Report", "History", "Year summary"];

function dateRange(start, end) {
  const f = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Dar_es_Salaam" });
  return start && end ? `${f(start)} – ${f(end)}` : "";
}

const wikiLabel = (id) => WIKIS.find(w => w.id === id)?.label || id;

function contribsLink(wiki, username) {
  return `https://${wiki}/wiki/Special:Contributions/${encodeURIComponent(username.replace(/ /g, "_"))}`;
}

function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function pctText(part, whole) {
  return whole ? `${Math.round((part / whole) * 100)}%` : "0%";
}

function downloadCsv(filename, text) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Older saved reports have no stillEditingCount — derive it from their rows.
function reportEditing(r) {
  return r.stillEditingCount ?? (r.rows || []).filter(isEditing).length;
}

function WikiSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {WIKIS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
    </select>
  );
}

// ── Report tab ─────────────────────────────────────────────────────────────────
function Report({ members, reports, events, scope, profile, canEdit, showToast, org }) {
  const [month,     setMonth]     = useState(lastFullMonth());
  const [wiki,      setWiki]      = useState(DEFAULT_WIKI);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [fresh,     setFresh]     = useState(null);   // { wiki, month, members, stats }
  const [progress,  setProgress]  = useState(null);   // { done, total }
  const [error,     setError]     = useState("");
  const [saving,    setSaving]    = useState(false);

  const eligible = members.filter(m => m.isActive !== false && (m.wikimediaUsername || "").trim());
  const saved = reports.find(r => r.id === reportId(wiki, month, scope));
  const freshMatches = fresh && fresh.wiki === wiki && fresh.month === month && fresh.scope === scope;
  const eventsOnly = scope === "events";
  const scopeName = eventsOnly ? `${wikiLabel(wiki)} — Kilimanjaro events only` : wikiLabel(wiki);
  const monthEvents = eventsOnly ? eventWindowsInMonth(events, month) : [];

  // A fresh fetch wins over the saved copy; its rows follow the threshold live.
  const view = useMemo(() => {
    if (freshMatches) {
      const rows = buildReportRows(fresh.members, fresh.stats, threshold);
      return { rows, threshold: Number(threshold) || 0, partial: isPartialMonth(month), isSaved: false, events: fresh.events };
    }
    if (saved) {
      return { rows: saved.rows || [], threshold: saved.threshold, partial: saved.partial, isSaved: true, saved, events: saved.events || [] };
    }
    return null;
  }, [freshMatches, fresh, saved, threshold, month]);

  const activeCount = view ? view.rows.filter(r => r.active).length : 0;
  const editingCount = view ? view.rows.filter(isEditing).length : 0;
  const memberCount = view ? view.rows.length : 0;
  const busy = progress !== null;

  const runFetch = async () => {
    if (eligible.length === 0) { setError("No members with a Wikipedia username are marked \"In reports\". Add members on the Members tab first."); return; }
    if (eventsOnly && events.length === 0) { setError("No Kilimanjaro events added yet. Add them on the Events tab first."); return; }
    setError("");
    setProgress({ done: 0, total: eventsOnly ? 0 : eligible.length });
    const onProgress = (done, total) => setProgress({ done, total });
    const usernames = eligible.map(m => m.wikimediaUsername);
    try {
      if (eventsOnly) {
        const res = await fetchEventMonthStats(usernames, events, month, wiki, { onProgress });
        setFresh({ wiki, month, scope, members: eligible, stats: res.stats, events: res.events });
      } else {
        const stats = await fetchMonthStats(usernames, month, wiki, { onProgress });
        setFresh({ wiki, month, scope, members: eligible, stats, events: [] });
      }
    } catch (e) {
      setError(`Could not fetch ${eventsOnly ? "Kilimanjaro event contributions" : `from ${wikiLabel(wiki)}`}: ${e.message}`);
    } finally {
      setProgress(null);
    }
  };

  const save = async () => {
    if (!view || view.isSaved) return;
    setSaving(true);
    try {
      await saveContributorReport({
        wiki, month, scope,
        threshold:   view.threshold,
        memberCount,
        activeCount,
        stillEditingCount: editingCount,
        partial:     view.partial,
        rows:        view.rows,
        events:      view.events || [],
        generatedBy: profile?.name || "",
        generatedAt: new Date().toISOString(),
      });
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "contributors", {
        targetId: reportId(wiki, month, scope), recordTitle: `${scopeName} ${month}`,
        details: `Saved active contributors report (${scopeLabel(scope)}): ${activeCount} of ${memberCount} active (≥${view.threshold} articles), ${editingCount} still editing`,
      });
      setFresh(null);
      showToast("Report saved.");
    } catch (e) {
      setError(`Could not save the report: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const best = view ? bestContributors(view.rows) : [];

  const printReport = async () => {
    if (!view) return;
    openPrintWindow(monthReportHtml({
      rows: view.rows, month, wikiLabel: scopeName, threshold: view.threshold, partial: view.partial, ...org,
    }));
    await addAudit(profile, AUDIT_ACTIONS.EXPORT, "contributors", {
      recordTitle: `${scopeName} ${month}`, details: "Printed active contributors report",
    });
  };

  const exportCsv = async () => {
    if (!view) return;
    const host = wiki.split(".")[0];
    downloadCsv(`active-contributors-${host}-${month}${eventsOnly ? "-kilimanjaro-events" : ""}.csv`, rowsToCsv(view.rows, { month, wiki, threshold: view.threshold }));
    await addAudit(profile, AUDIT_ACTIONS.EXPORT, "contributors", {
      recordTitle: `${scopeName} ${month}`, details: `Exported active contributors CSV (${memberCount} rows)`,
    });
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="form-grid">
          <div className="field"><label>Month</label>
            <input type="month" value={month} max={currentMonth()} onChange={e => e.target.value && setMonth(e.target.value)} />
          </div>
          <div className="field"><label>Wiki</label><WikiSelect value={wiki} onChange={setWiki} /></div>
          <div className="field"><label>Active if different articles ≥</label>
            <input type="number" min="1" value={threshold} disabled={!canEdit}
              onChange={e => setThreshold(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={runFetch} disabled={busy}>{busy ? "Fetching…" : "Fetch from Wikipedia"}</button>
          {view && <button className="btn" onClick={exportCsv} disabled={busy}>Export CSV</button>}
          {view && <button className="btn" onClick={printReport} disabled={busy}>🖨 Print report</button>}
          {view && !view.isSaved && canEdit && (
            <button className="btn" onClick={save} disabled={saving || busy}>{saving ? "Saving…" : saved ? "Save report (replace saved copy)" : "Save report"}</button>
          )}
        </div>
        {busy && <div style={{ fontSize: 13, color: "#2563eb", marginTop: 10 }}>Checked {progress.done} of {progress.total} members…</div>}
        <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
          {eligible.length} member{eligible.length === 1 ? "" : "s"} will be checked. Counts articles only (main namespace), using UTC calendar months.
          Edits to pages that were later deleted are not counted.
          {eventsOnly && <> <strong>Kilimanjaro events only:</strong> a member's edit counts only if they joined the event on the Outreach Dashboard and made it between the event's start and end.
            {" "}{monthEvents.length === 0 ? `No Kilimanjaro events in ${monthLabel(month)} — everyone will have 0.` : `${monthEvents.length} event${monthEvents.length === 1 ? "" : "s"} in ${monthLabel(month)}: ${monthEvents.map(w => w.event.title).join(", ")}.`}</>}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {view?.partial && (
        <div className="alert alert-warn">{monthLabel(month)} isn't finished yet. These are the counts so far.</div>
      )}

      {!view ? (
        <div className="panel"><div className="empty">No report for {scopeName}, {monthLabel(month)} yet. Click "Fetch from Wikipedia" to count contributions.</div></div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, flexWrap: "wrap" }}>
            {view.isSaved ? (
              <span className="badge badge-green">Saved{view.saved.generatedBy ? ` by ${view.saved.generatedBy}` : ""}{view.saved.generatedAt ? ` on ${view.saved.generatedAt.slice(0, 10)}` : ""}</span>
            ) : (
              <span className="badge badge-amber">Not saved yet</span>
            )}
            <span className={`badge ${eventsOnly ? "badge-blue" : "badge-gray"}`}>{scopeLabel(scope)}</span>
            <span style={{ color: "#666" }}>Rule: active if ≥ {view.threshold} different articles in {monthLabel(month)}{eventsOnly ? " (in Kilimanjaro events)" : ""}; still editing if ≥ {STILL_EDITING_MIN}</span>
          </div>

          {eventsOnly && (
            <div className="panel" style={{ marginBottom: 16, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 6 }}>Events counted in {monthLabel(month)}</div>
              {(view.events || []).length === 0 ? <div style={{ fontSize: 13, color: "#888" }}>No Kilimanjaro events this month.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                  {view.events.map(ev => (
                    <div key={ev.slug}>
                      <a href={courseUrl(ev.slug)} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontWeight: 500 }}>{ev.title}</a>
                      <span style={{ color: "#888" }}> · {dateRange(ev.start, ev.end)} · {ev.members} member{ev.members === 1 ? "" : "s"} joined</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {best.length > 0 && (
            <div className="panel" style={{ border: "2px solid #d97706", background: "#fffaf0", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", letterSpacing: 1, textTransform: "uppercase" }}>★ Best contributor of the month{best.length > 1 ? " (shared)" : ""}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#1c2b1e", marginTop: 4 }}>{best.map(b => b.name).join(" & ")}</div>
              <div style={{ fontSize: 13, color: "#666" }}>{best[0].articles} different articles in {monthLabel(month)}{view.partial ? " so far" : ""} · {best.map(b => b.username).join(", ")}</div>
            </div>
          )}

          <div className="card-grid">
            {[
              ["Members checked",            memberCount,               "#1c2b1e"],
              [`Active (≥${view.threshold})`, activeCount,               "#2d7a4f"],
              [`Still editing (≥${STILL_EDITING_MIN})`, editingCount,      "#2563eb"],
              ["Not editing",                memberCount - editingCount, "#d97706"],
              ["Active rate",                pctText(activeCount, memberCount), "#1c2b1e"],
            ].map(([label, value, color]) => (
              <div key={label} className="stat-card">
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="panel" style={{ padding: 0 }}>
            {view.rows.length === 0 ? <div className="empty">No members in this report.</div> : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Different articles</th><th>Total edits</th><th>Progress to {view.threshold}</th><th>Status</th></tr></thead>
                  <tbody>
                    {view.rows.map((r, i) => (
                      <tr key={r.memberId || r.username}>
                        <td style={{ fontSize: 12, color: "#888" }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{r.name}{best.includes(r) && <span title="Best contributor of the month" style={{ color: "#d97706", marginLeft: 4 }}>★</span>}</td>
                        <td style={{ fontSize: 12 }}><a href={contribsLink(wiki, r.username)} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{r.username}</a></td>
                        <td style={{ fontWeight: 600 }}>{r.articles}</td>
                        <td style={{ fontSize: 12 }}>{r.edits}</td>
                        <td style={{ minWidth: 120 }}>
                          <div className="progress-bar">
                            <div style={{ height: "100%", width: `${Math.min(100, (r.articles / (view.threshold || 1)) * 100)}%`, background: r.active ? "#4a9e6b" : "#d97706" }} />
                          </div>
                        </td>
                        <td>{r.active ? <span className="badge badge-green">Active</span>
                          : isEditing(r) ? <span className="badge badge-blue">Still editing</span>
                          : <span className="badge badge-amber">Not editing</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────────────────────
function History({ reports }) {
  const [wiki, setWiki] = useState(DEFAULT_WIKI);
  const forWiki = reports.filter(r => r.wiki === wiki);
  const byMonth = Object.fromEntries(forWiki.map(r => [r.month, r]));
  const months  = previousMonths(currentMonth(), 12);
  const maxMembers = Math.max(1, ...months.map(m => byMonth[m]?.memberCount || 0));
  const CHART_H = 140;
  const sorted = [...forWiki].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div className="panel-title" style={{ margin: 0 }}>Last 12 months</div>
          <div className="field" style={{ margin: 0, minWidth: 200 }}><WikiSelect value={wiki} onChange={setWiki} /></div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#666", marginBottom: 10 }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#c9d8cd", borderRadius: 2, marginRight: 4 }} />Members checked</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2563eb", borderRadius: 2, marginRight: 4 }} />Still editing</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2d7a4f", borderRadius: 2, marginRight: 4 }} />Active</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: 560, height: CHART_H + 36 }}>
            {months.map(m => {
              const r = byMonth[m];
              const mh = r ? (r.memberCount / maxMembers) * CHART_H : 0;
              const ah = r ? (r.activeCount / maxMembers) * CHART_H : 0;
              const eh = r ? (reportEditing(r) / maxMembers) * CHART_H : 0;
              return (
                <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                  title={r ? `${monthLabel(m)}: ${r.activeCount} active, ${reportEditing(r)} still editing, of ${r.memberCount}` : `${monthLabel(m)}: no saved report`}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#2d7a4f", height: 14 }}>{r ? r.activeCount : ""}</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: CHART_H }}>
                    <div style={{ width: 10, height: mh, background: "#c9d8cd", borderRadius: "2px 2px 0 0" }} />
                    <div style={{ width: 10, height: eh, background: "#2563eb", borderRadius: "2px 2px 0 0" }} />
                    <div style={{ width: 10, height: ah, background: "#2d7a4f", borderRadius: "2px 2px 0 0" }} />
                  </div>
                  <div style={{ fontSize: 10, color: r ? "#666" : "#bbb", whiteSpace: "nowrap" }}>{monthLabel(m)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {sorted.length === 0 ? <div className="empty">No saved reports for {wikiLabel(wiki)} yet. Save one from the Report tab.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Month</th><th>Members</th><th>Still editing</th><th>Active</th><th>Rate</th><th>Best contributor</th><th>Rule</th><th>Saved by</th></tr></thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{monthLabel(r.month)}{r.partial && <span className="badge badge-amber" style={{ marginLeft: 6 }}>so far</span>}</td>
                    <td>{r.memberCount}</td>
                    <td style={{ color: "#2563eb" }}>{reportEditing(r)}</td>
                    <td style={{ fontWeight: 600, color: "#2d7a4f" }}>{r.activeCount}</td>
                    <td>{pctText(r.activeCount, r.memberCount)}</td>
                    <td style={{ fontSize: 12 }}>{(() => { const b = bestContributors(r.rows || []); return b.length ? <>★ {b.map(x => x.name).join(" & ")} <span style={{ color: "#888" }}>({b[0].articles})</span></> : ""; })()}</td>
                    <td style={{ fontSize: 12 }}>≥ {r.threshold} articles</td>
                    <td style={{ fontSize: 12 }}>{r.generatedBy || ""}{r.generatedAt ? `, ${r.generatedAt.slice(0, 10)}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// People from another list (volunteers / event participants) whose Wikipedia
// username isn't in the community list yet — one entry per username.
function notYetMembers(list, existing, source) {
  const seen = new Set(existing);
  const out = [];
  for (const v of list) {
    const u = normalizeUsername(v.wikimediaUsername);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push({ name: (v.name || "").trim() || u, wikimediaUsername: u, isActive: true, source });
  }
  return out;
}

// ── Year summary tab ───────────────────────────────────────────────────────────
const LABEL_BADGE = { active: "badge-green", retained: "badge-blue", participated: "badge-gray" };

function MonthStrip({ months, byMonth, covered }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {months.map(m => {
        const c = byMonth[m];
        const has = covered.has(m);
        const bg = c?.active ? "#2d7a4f" : c?.editing ? "#2563eb" : has ? "#e5e5e0" : "transparent";
        const tip = !has ? `${monthLabel(m)}: no saved report`
          : `${monthLabel(m)}: ${c ? c.articles : 0} article${c?.articles === 1 ? "" : "s"}${c?.active ? " (active)" : c?.editing ? " (still editing)" : ""}`;
        return <div key={m} title={tip} style={{ width: 10, height: 14, borderRadius: 2, background: bg, border: has ? "none" : "1px dashed #ccc", boxSizing: "border-box" }} />;
      })}
    </div>
  );
}

function YearSummary({ members, reports, scope, currentGrant, profile, org, signature }) {
  const base = useMemo(() => defaultPeriod(currentGrant), [currentGrant]);
  const qs   = useMemo(() => quarters(base.start, base.end), [base]);
  const [mode,   setMode]   = useState("year");      // "year" | "Q1".. | "custom"
  const [custom, setCustom] = useState(base);
  const [wiki,   setWiki]   = useState("all");
  const [search, setSearch] = useState("");

  const period = mode === "year" ? base
    : mode === "custom" ? custom
    : (qs.find(q => q.label === mode) || base);

  // Members left out of reports ("In reports" unticked) only appear if they have history.
  const inReports = useMemo(() => members.filter(m => m.isActive !== false), [members]);
  const summary = useMemo(
    () => buildYearSummary(reports, inReports, { start: period.start, end: period.end, wiki }),
    [reports, inReports, period.start, period.end, wiki],
  );
  const quarterRows = useMemo(
    () => qs.map(q => ({ q, s: buildYearSummary(reports, inReports, { start: q.start, end: q.end, wiki }) })),
    [qs, reports, inReports, wiki],
  );
  const covered = new Set(summary.covered);
  const t = summary.totals;
  const range = (s, e) => s === e ? monthLabel(s) : `${monthLabel(s)} – ${monthLabel(e)}`;

  const q = search.toLowerCase();
  const rows = summary.rows.filter(r => !q || r.name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q));

  const eventsOnly = scope === "events";
  const wikiName = `${wiki === "all" ? "All wikis" : wikiLabel(wiki)}${eventsOnly ? " — Kilimanjaro events only" : ""}`;

  const printSummary = async () => {
    openPrintWindow(yearReportHtml({ summary, start: period.start, end: period.end, wikiLabel: wikiName, quarterRows: mode === "year" ? quarterRows : [], ...org }));
    await addAudit(profile, AUDIT_ACTIONS.EXPORT, "contributors", {
      recordTitle: `Summary ${period.start} to ${period.end}`, details: "Printed contributor summary",
    });
  };

  const printCertificates = async (list) => {
    if (summary.missing.length > 0 && !window.confirm(`${summary.missing.length} month${summary.missing.length === 1 ? " has" : "s have"} no saved report in this period, so some certificates may show lower numbers. Print anyway?`)) return;
    if (!signature.signatureImage && !window.confirm("No coordinator signature has been uploaded yet (Settings → Certificate signature), so the signature line will be blank. Print anyway?")) return;
    openPrintWindow(certificatesHtml(list, { ...org, start: period.start, end: period.end, signature, art: certificateArt(), eventsOnly }));
    await addAudit(profile, AUDIT_ACTIONS.EXPORT, "contributors", {
      recordTitle: list.length === 1 ? list[0].name : `${list.length} certificates`,
      details: `Printed ${list.length} community member certificate${list.length === 1 ? "" : "s"} (${period.start} to ${period.end}, ${scopeLabel(scope)})`,
    });
  };

  const exportCsv = async () => {
    const tag = mode === "year" ? "year" : mode === "custom" ? "custom" : mode;
    downloadCsv(`contributors-${tag}-${period.start}-to-${period.end}${eventsOnly ? "-kilimanjaro-events" : ""}.csv`, yearSummaryToCsv(summary));
    await addAudit(profile, AUDIT_ACTIONS.EXPORT, "contributors", {
      recordTitle: `Summary ${period.start} to ${period.end}`, details: `Exported contributor summary (${summary.rows.length} people)`,
    });
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="form-grid">
          <div className="field"><label>Period</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="year">Full year ({range(base.start, base.end)})</option>
              {qs.map(x => <option key={x.label} value={x.label}>{x.label} ({range(x.start, x.end)})</option>)}
              <option value="custom">Custom…</option>
            </select>
          </div>
          {mode === "custom" && (
            <>
              <div className="field"><label>From</label><input type="month" value={custom.start} onChange={e => e.target.value && setCustom(c => ({ ...c, start: e.target.value }))} /></div>
              <div className="field"><label>To</label><input type="month" value={custom.end} onChange={e => e.target.value && setCustom(c => ({ ...c, end: e.target.value }))} /></div>
            </>
          )}
          <div className="field"><label>Wiki</label>
            <select value={wiki} onChange={e => setWiki(e.target.value)}>
              <option value="all">All wikis</option>
              {WIKIS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
          {currentGrant?.startDate && currentGrant?.endDate
            ? `Full year follows the selected grant (${currentGrant.startDate} to ${currentGrant.endDate}). Quarters count from its first month.`
            : "No grant dates set, so the full year is the last 12 finished months."}
          {" "}Built from saved monthly reports counted as <strong>{scopeLabel(scope).toLowerCase()}</strong>. Unfinished months are left out.
        </div>
      </div>

      {/* Quarter by quarter */}
      {qs.length > 1 && (
        <div className="panel" style={{ padding: 0, marginBottom: 20 }}>
          <div className="panel-title" style={{ padding: "14px 16px 0" }}>Quarter by quarter</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Quarter</th><th>Months saved</th><th>Still editing (1+ month)</th><th>Active contributors</th><th>Edited every month</th><th>Articles</th><th></th></tr></thead>
              <tbody>
                {quarterRows.map(({ q: x, s }) => (
                  <tr key={x.label} style={mode === x.label ? { background: "#f0f8f3" } : undefined}>
                    <td style={{ fontWeight: 600 }}>{x.label} <span style={{ fontWeight: 400, fontSize: 12, color: "#888" }}>{range(x.start, x.end)}</span></td>
                    <td style={{ fontSize: 12 }}>
                      {s.covered.length} of {x.months.length}
                      {s.missing.length > 0 && <span className="badge badge-amber" style={{ marginLeft: 6 }}>{s.missing.length} missing</span>}
                      {s.future.length > 0 && s.missing.length === 0 && s.covered.length < x.months.length && <span style={{ marginLeft: 6, color: "#aaa" }}>not finished</span>}
                    </td>
                    <td style={{ color: "#2563eb", fontWeight: 600 }}>{s.totals.editedOnce}</td>
                    <td style={{ color: "#2d7a4f", fontWeight: 600 }}>{s.totals.active}</td>
                    <td>{s.rows.filter(r => r.monthsEditing >= x.months.length && x.months.length > 0).length}</td>
                    <td>{s.totals.articles.toLocaleString()}</td>
                    <td><button className="btn btn-sm" onClick={() => setMode(x.label)}>View</button></td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #e8e8e4", background: mode === "year" ? "#f0f8f3" : undefined }}>
                  <td style={{ fontWeight: 700 }}>Full year</td>
                  {(() => { const s = buildYearSummary(reports, inReports, { start: base.start, end: base.end, wiki }); return (<>
                    <td style={{ fontSize: 12 }}>{s.covered.length} of {s.months.length}</td>
                    <td style={{ color: "#2563eb", fontWeight: 700 }}>{s.totals.editedOnce}</td>
                    <td style={{ color: "#2d7a4f", fontWeight: 700 }}>{s.totals.active}</td>
                    <td style={{ fontSize: 12, color: "#666" }}>Retained (3+ months): <strong>{s.totals.retained}</strong></td>
                    <td style={{ fontWeight: 700 }}>{s.totals.articles.toLocaleString()}</td>
                  </>); })()}
                  <td><button className="btn btn-sm" onClick={() => setMode("year")}>View</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary.bestByMonth.some(b => b.people.length) && (
        <div className="panel" style={{ border: "1px solid #f0d5b0", background: "#fffaf0", marginBottom: 20 }}>
          <div className="panel-title" style={{ color: "#b45309" }}>★ Best contributor of each month</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {summary.bestByMonth.map(b => (
              <div key={b.month} style={{ fontSize: 13 }}>
                <div style={{ fontSize: 11, color: "#888" }}>{monthLabel(b.month)}</div>
                <div style={{ fontWeight: 600 }}>{b.people.length ? b.people.map(p => p.name).join(" & ") : "No edits"}</div>
                {b.articles > 0 && <div style={{ fontSize: 12, color: "#b45309" }}>{b.articles} articles</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.missing.length > 0 && (
        <div className="alert alert-warn">
          No saved report for {summary.missing.map(monthLabel).join(", ")}. Fetch and save {summary.missing.length === 1 ? "that month" : "those months"} on the Report tab, or this summary will undercount.
        </div>
      )}

      <div className="card-grid">
        {[
          ["People",                         t.people,       "#1c2b1e"],
          ["Active contributors",            t.active,       "#2d7a4f"],
          [`Retained (${RETAINED_MIN_MONTHS}+ months editing)`, t.retained, "#2563eb"],
          ["Still editing (at least 1 month)", t.editedOnce, "#2563eb"],
          ["Participated only",              t.participated, "#d97706"],
          ["Months saved",                   `${summary.covered.length} of ${summary.months.length}`, "#1c2b1e"],
        ].map(([label, value, color]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or username..." style={{ flex: 1, minWidth: 200, fontSize: 13 }} />
        <button className="btn" onClick={exportCsv} disabled={summary.rows.length === 0}>Export CSV</button>
        <button className="btn" onClick={printSummary} disabled={summary.rows.length === 0}>🖨 Print summary</button>
        <button className="btn btn-primary" onClick={() => printCertificates(rows)} disabled={rows.length === 0}>
          Print {rows.length} certificate{rows.length === 1 ? "" : "s"}{search ? " (filtered)" : ""}
        </button>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="empty">{summary.rows.length === 0 ? "No members or saved reports for this period yet." : "No one matches your search."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Username</th><th>Recognition</th><th>Months active</th><th>Months still editing</th><th>Total articles</th><th>Best month</th><th>Month by month</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.username}>
                    <td style={{ fontSize: 12, color: "#888" }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{r.name}{r.bestOfMonth.length > 0 && <span title={`Best contributor: ${r.bestOfMonth.map(m => monthLabel(m)).join(", ")}`} style={{ color: "#d97706", marginLeft: 4 }}>★</span>}</td>
                    <td style={{ fontSize: 12 }}>{r.username}</td>
                    <td><span className={`badge ${LABEL_BADGE[r.label]}`}>{YEAR_LABELS[r.label]}</span></td>
                    <td>{r.monthsActive}</td>
                    <td>{r.monthsEditing}</td>
                    <td style={{ fontWeight: 600 }}>{r.totalArticles.toLocaleString()}</td>
                    <td style={{ fontSize: 12 }}>{r.bestMonth.month ? `${monthLabel(r.bestMonth.month)} (${r.bestMonth.articles})` : ""}</td>
                    <td><MonthStrip months={summary.months} byMonth={r.byMonth} covered={covered} /></td>
                    <td><button className="btn btn-sm" onClick={() => printCertificates([r])}>Certificate</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
        <strong>Active contributor</strong>: {DEFAULT_THRESHOLD}+ different articles in at least one month (the threshold saved with each report).
        {" "}<strong>Retained</strong>: still editing (1+ article) in {RETAINED_MIN_MONTHS} or more months.
        {" "}Total articles adds the monthly counts, so an article edited in two different months counts twice.
        {" "}Strip: <span style={{ color: "#2d7a4f" }}>■</span> active, <span style={{ color: "#2563eb" }}>■</span> still editing, <span style={{ color: "#bbb" }}>■</span> no edits, dashed = no saved report.
      </div>
    </div>
  );
}

// ── Events tab — Kilimanjaro events (Outreach Dashboard courses) ───────────────
function Events({ events, members, profile, canEdit, isAdmin, showToast }) {
  const [links,   setLinks]   = useState("");
  const [busy,    setBusy]    = useState(false);
  const [errors,  setErrors]  = useState([]);
  const [rootUrl, setRootUrl] = useState(DEFAULT_ACTIVITIES_PAGE);
  const [found,   setFound]   = useState(null);   // discovered event pages
  const [finding, setFinding] = useState("");     // progress text
  const [picked,  setPicked]  = useState({});     // title → true
  const [pasted,  setPasted]  = useState({});     // title → dashboard link typed by hand

  const addedIds = useMemo(() => new Set(events.map(e => e.id)), [events]);

  const memberSet = useMemo(
    () => new Set(members.map(m => normalizeUsername(m.wikimediaUsername)).filter(Boolean)),
    [members],
  );

  // Fetch from the dashboard and save. Returns an error line or "".
  const saveOne = async (slug, extra = {}) => {
    try {
      const c = await fetchCourse(slug);
      await saveContributorEvent(eventDocId(slug), { ...c, ...extra, refreshedAt: new Date().toISOString() });
      return "";
    } catch (e) {
      return `${slug}: ${e.message}`;
    }
  };

  const addEvents = async () => {
    const lines = links.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const slugs = [...new Set(lines.map(parseCourseSlug).filter(Boolean))];
    const bad = lines.filter(l => !parseCourseSlug(l)).map(l => `${l}: not an Outreach Dashboard event link`);
    if (slugs.length === 0) { setErrors(bad.length ? bad : ["Paste at least one link."]); return; }
    setBusy(true);
    const failed = [...bad];
    let added = 0;
    for (const slug of slugs) {
      const err = await saveOne(slug);
      if (err) failed.push(err); else added++;
    }
    setBusy(false);
    setErrors(failed);
    if (added) {
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "contributors", { details: `Added ${added} Kilimanjaro event${added === 1 ? "" : "s"} for contribution counting` });
      setLinks(failed.length ? links : "");
      showToast(`Added ${added} event${added === 1 ? "" : "s"}.`);
    }
  };

  const refreshAll = async () => {
    setBusy(true);
    const failed = [];
    for (const ev of events) {
      const err = await saveOne(ev.slug, { wikiPage: ev.wikiPage || "", program: ev.program || "" });
      if (err) failed.push(err);
    }
    setBusy(false);
    setErrors(failed);
    if (failed.length < events.length) showToast("Events refreshed from the Outreach Dashboard.");
  };

  // Follow the activities page → programs → sub-events, then match each event
  // to the dashboard course with the same name.
  const findEvents = async () => {
    setErrors([]);
    setFound(null);
    setFinding("Reading the activities page and every program's sub-events…");
    try {
      const pages = await discoverEventPages(rootUrl);
      const list = [];
      for (let i = 0; i < pages.length; i++) {
        setFinding(`Matching dashboard courses… ${i + 1} of ${pages.length}`);
        let slug = "";
        try { slug = await findCourseForEvent(pages[i].name); } catch { /* leave unmatched */ }
        list.push({ ...pages[i], slug });
      }
      const shown = list.filter(e => !e.isParent || e.slug);
      setFound(shown);
      setPicked(Object.fromEntries(shown.filter(e => e.slug && !addedIds.has(eventDocId(e.slug))).map(e => [e.title, true])));
      setPasted({});
    } catch (e) {
      setErrors([`Could not read ${rootUrl}: ${e.message}`]);
    } finally {
      setFinding("");
    }
  };

  const slugFor = (ev) => ev.slug || parseCourseSlug(pasted[ev.title]);

  const addPicked = async () => {
    const list = (found || []).filter(ev => picked[ev.title] && slugFor(ev));
    if (list.length === 0) return;
    setBusy(true);
    const failed = [];
    let added = 0;
    for (const ev of list) {
      const err = await saveOne(slugFor(ev), { wikiPage: ev.title, program: ev.program });
      if (err) failed.push(err); else added++;
    }
    setBusy(false);
    setErrors(failed);
    if (added) {
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "contributors", { details: `Added ${added} Kilimanjaro event${added === 1 ? "" : "s"} from ${rootUrl}` });
      setPicked({});
      showToast(`Added ${added} event${added === 1 ? "" : "s"}.`);
    }
  };

  const pickedCount = (found || []).filter(ev => picked[ev.title] && slugFor(ev)).length;

  const del = async (ev) => {
    if (!window.confirm(`Remove "${ev.title}" from Kilimanjaro events? Saved reports keep their numbers; new reports won't count this event.`)) return;
    await deleteContributorEvent(ev.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "contributors", { targetId: ev.id, recordTitle: ev.title, details: `Removed Kilimanjaro event ${ev.slug}` });
    showToast("Event removed.");
  };

  const sorted = [...events].sort((a, b) => String(b.start).localeCompare(String(a.start)));

  return (
    <div>
      <div className="alert alert-info">
        These are the events used when counting <strong>Kilimanjaro events only</strong>. A member's edit counts if they joined the event on the
        Outreach Dashboard and made it between the event's start and end. Edits in other groups' events, or outside our event dates, are not counted.
        {" "}<strong>Whole wiki</strong> reports ignore this list.
      </div>

      {canEdit && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">Find events from our activities page</div>
          <div className="field">
            <label>Activities page on Wikipedia</label>
            <input value={rootUrl} onChange={e => setRootUrl(e.target.value)} spellCheck={false} />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={findEvents} disabled={!!finding || busy || !rootUrl.trim()}>{finding ? "Finding…" : "Find events"}</button>
            {found && <button className="btn" onClick={addPicked} disabled={busy || pickedCount === 0}>{busy ? "Adding…" : `Add ${pickedCount} selected`}</button>}
          </div>
          {finding && <div style={{ fontSize: 13, color: "#2563eb", marginTop: 10 }}>{finding}</div>}
          <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
            Follows every program on the page down to its last sub-event (including the program's navigation tabs), then looks for the
            Outreach Dashboard course with the same name. If an event's course has a different name, paste its dashboard link in the row.
          </div>

          {found && (found.length === 0 ? <div className="empty">No event pages found under this page.</div> : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table>
                <thead><tr><th></th><th>Program</th><th>Event</th><th>Dashboard course</th></tr></thead>
                <tbody>
                  {found.map(ev => {
                    const slug = slugFor(ev);
                    const added = slug && addedIds.has(eventDocId(slug));
                    return (
                      <tr key={ev.title} style={added ? { color: "#999" } : undefined}>
                        <td><input type="checkbox" checked={!!picked[ev.title] && !!slug} disabled={!slug || added}
                          onChange={e => setPicked(p => ({ ...p, [ev.title]: e.target.checked }))} /></td>
                        <td style={{ fontSize: 12 }}>{ev.program}</td>
                        <td style={{ fontSize: 13 }}>
                          <a href={`https://sw.wikipedia.org/wiki/${encodeURIComponent(ev.title.replace(/ /g, "_"))}`} target="_blank" rel="noopener noreferrer" style={{ color: ev.exists ? "#2563eb" : "#c0392b" }}>{ev.name}</a>
                          {!ev.exists && <span className="badge badge-gray" style={{ marginLeft: 6 }}>page not created yet</span>}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {added ? <span className="badge badge-green">Already added</span>
                            : ev.slug ? <a href={courseUrl(ev.slug)} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{ev.slug.split("/")[1].replace(/_/g, " ")}</a>
                            : <input value={pasted[ev.title] || ""} placeholder="No course with this name — paste dashboard link" spellCheck={false}
                                style={{ fontSize: 12, minWidth: 260, borderColor: pasted[ev.title] && !parseCourseSlug(pasted[ev.title]) ? "#c0392b" : undefined }}
                                onChange={e => { const v = e.target.value; setPasted(p => ({ ...p, [ev.title]: v })); setPicked(p => ({ ...p, [ev.title]: !!parseCourseSlug(v) })); }} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">Add events by dashboard link</div>
          <div className="field">
            <label>Outreach Dashboard event links, one per line</label>
            <textarea rows={4} value={links} onChange={e => setLinks(e.target.value)} spellCheck={false}
              placeholder={"https://outreachdashboard.wmflabs.org/courses/Wikimedia_Community_Kilimanjaro/January_2026_Training"} />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={addEvents} disabled={busy || !links.trim()}>{busy ? "Working…" : "Add events"}</button>
            {events.length > 0 && <button className="btn" onClick={refreshAll} disabled={busy}>Refresh all from dashboard</button>}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
            Where to find the link: on the Wikipedia event page open the event details (Maelezo ya tukio), check that contribution tracking is on,
            and follow its Programs &amp; Events Dashboard link. Each event needs its own dashboard course.
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="alert alert-warn" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>Could not add or refresh: {errors.map((e, i) => <div key={i}>{e}</div>)}</span>
          <button className="btn btn-sm" onClick={() => setErrors([])}>Dismiss</button>
        </div>
      )}

      <div className="panel" style={{ padding: 0 }}>
        {sorted.length === 0 ? <div className="empty">No Kilimanjaro events yet. Paste their Outreach Dashboard links above.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Event</th><th>Program</th><th>Dates</th><th>Joined</th><th>Community members</th><th>Wikipedia event</th><th>Updated</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {sorted.map(ev => {
                  const people = ev.participants || [];
                  return (
                    <tr key={ev.id}>
                      <td style={{ fontWeight: 500 }}><a href={courseUrl(ev.slug)} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{ev.title}</a></td>
                      <td style={{ fontSize: 12, color: "#666" }}>{ev.program || ""}</td>
                      <td style={{ fontSize: 12 }}>{dateRange(ev.start, ev.end)}</td>
                      <td>{people.length}</td>
                      <td>{people.filter(u => memberSet.has(u)).length}</td>
                      <td style={{ fontSize: 12 }}>{ev.wikiEventId
                        ? <a href={`https://sw.wikipedia.org/wiki/Special:EventDetails/${ev.wikiEventId}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>EventDetails/{ev.wikiEventId}</a>
                        : <span style={{ color: "#aaa" }}>not linked</span>}</td>
                      <td style={{ fontSize: 12, color: "#888" }}>{(ev.refreshedAt || "").slice(0, 10)}</td>
                      {isAdmin && <td><button className="btn btn-sm btn-danger" onClick={() => del(ev)}>✕</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
        "Joined" is from the last refresh. Reports always re-check who joined, so late sign-ups still count. Dates are shown in Tanzania time.
      </div>
    </div>
  );
}

// ── Members tab ────────────────────────────────────────────────────────────────
function Members({ members, volunteers, participants, profile, canEdit, isAdmin, showToast }) {
  const [name,     setName]     = useState("");
  const [username, setUsername] = useState("");
  const [bulk,     setBulk]     = useState("");
  const [search,   setSearch]   = useState("");
  const [busy,     setBusy]     = useState(false);
  const [missing,  setMissing]  = useState([]);

  const existing = useMemo(
    () => new Set(members.map(m => normalizeUsername(m.wikimediaUsername)).filter(Boolean)),
    [members],
  );

  const importable = useMemo(() => notYetMembers(volunteers, existing, "volunteers"), [volunteers, existing]);
  const importableParticipants = useMemo(() => notYetMembers(participants, existing, "participants"), [participants, existing]);
  const participantsNoUsername = participants.filter(p => !normalizeUsername(p.wikimediaUsername)).length;

  // Warn about usernames that don't exist on Swahili Wikipedia (likely typos)
  const verify = async (usernames) => {
    try {
      const res = await checkUsernames(usernames, WIKIS[0].id);
      setMissing(res.missing);
    } catch {
      setMissing([]);
    }
  };

  const addOne = async () => {
    const u = normalizeUsername(username);
    if (!u) { alert("Wikipedia username is required."); return; }
    if (existing.has(u)) { alert(`${u} is already in the list.`); return; }
    setBusy(true);
    try {
      const fullName = name.trim() || u;
      const id = await addCommunityMember({ name: fullName, wikimediaUsername: u, isActive: true, source: "manual" });
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "contributors", { targetId: id, recordTitle: fullName, details: `Added community member ${u}` });
      setName(""); setUsername("");
      showToast("Member added.");
      await verify([u]);
    } catch (e) {
      alert(`Could not add the member: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const addMany = async (list, label, source) => {
    if (list.length === 0) return;
    setBusy(true);
    try {
      await addCommunityMembersBulk(list);
      await addAudit(profile, AUDIT_ACTIONS.IMPORT, "contributors", { details: `${label}: added ${list.length} community member${list.length === 1 ? "" : "s"} (${source})` });
      await verify(list.map(m => m.wikimediaUsername));
      return true;
    } catch (e) {
      alert(`Could not add members: ${e.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addBulk = async () => {
    const seen = new Set(existing);
    const list = [];
    let skipped = 0;
    for (const line of bulk.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = line.split("|");
      const rawUser = parts.length > 1 ? parts.slice(1).join("|") : parts[0];
      const u = normalizeUsername(rawUser);
      if (!u || seen.has(u)) { skipped++; continue; }
      seen.add(u);
      const fullName = parts.length > 1 ? parts[0].trim() : "";
      list.push({ name: fullName || u, wikimediaUsername: u, isActive: true, source: "bulk" });
    }
    if (list.length === 0) { alert(skipped ? "All of these are already in the list." : "Paste at least one username."); return; }
    if (!(await addMany(list, "Bulk add", "bulk"))) return;
    setBulk("");
    showToast(`Added ${list.length} member${list.length === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}` : ""}.`);
  };

  const importVolunteers = async () => {
    const n = importable.length;
    if (!(await addMany(importable, "Import from Volunteers", "volunteers"))) return;
    showToast(`Imported ${n} from Volunteers.`);
  };

  const importParticipants = async () => {
    const n = importableParticipants.length;
    if (!window.confirm(`Add ${n} past event participant${n === 1 ? "" : "s"} to the community list? They will be included in monthly reports.`)) return;
    if (!(await addMany(importableParticipants, "Import from Participants", "participants"))) return;
    showToast(`Imported ${n} from Participants.`);
  };

  const toggleActive = async (m) => {
    await updateCommunityMember(m.id, { isActive: m.isActive === false });
  };

  const del = async (m) => {
    if (!window.confirm(`Remove ${m.name} (${m.wikimediaUsername}) from the community list?`)) return;
    await deleteCommunityMember(m.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "contributors", { targetId: m.id, recordTitle: m.name, details: `Removed community member ${m.wikimediaUsername}` });
    showToast("Member removed.");
  };

  const q = search.toLowerCase();
  const filtered = members.filter(m =>
    !q || m.name?.toLowerCase().includes(q) || m.wikimediaUsername?.toLowerCase().includes(q)
  );

  return (
    <div>
      {canEdit && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-title">Add one member</div>
            <div className="field"><label>Full name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amina Juma" />
            </div>
            <div className="field"><label>Wikipedia username <span className="req">★</span></label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. Amina Juma"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} />
            </div>
            <div className="btn-row"><button className="btn btn-primary" onClick={addOne} disabled={busy}>+ Add member</button></div>
          </div>

          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-title">Bulk add</div>
            <div className="field"><label>One per line: <code>username</code> or <code>Full name | username</code></label>
              <textarea rows={5} value={bulk} onChange={e => setBulk(e.target.value)} spellCheck={false}
                placeholder={"Amina Juma | Amina_Juma\nBaraka2024"} />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={addBulk} disabled={busy || !bulk.trim()}>Add all</button>
              <button className="btn" onClick={importVolunteers} disabled={busy || importable.length === 0}
                title={importable.length === 0 ? "Every volunteer with a Wikipedia username is already in the list" : ""}>
                Import {importable.length} from Volunteers
              </button>
              <button className="btn" onClick={importParticipants} disabled={busy || importableParticipants.length === 0}
                title={importableParticipants.length === 0 ? "Every event participant with a Wikipedia username is already in the list" : ""}>
                Import {importableParticipants.length} from Participants
              </button>
            </div>
            {participantsNoUsername > 0 && (
              <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                {participantsNoUsername} participant{participantsNoUsername === 1 ? " has" : "s have"} no Wikipedia username and can't be checked. Add their username on the Participants page first.
              </div>
            )}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="alert alert-warn" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>These usernames were not found on Swahili Wikipedia. Check the spelling: <strong>{missing.join(", ")}</strong></span>
          <button className="btn btn-sm" onClick={() => setMissing([])}>Dismiss</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or username..." style={{ flex: 1, minWidth: 200, fontSize: 13 }} />
        <span style={{ fontSize: 12, color: "#888" }}>{members.length} member{members.length === 1 ? "" : "s"}, {members.filter(m => m.isActive !== false).length} in reports</span>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">{members.length === 0 ? "No community members yet. Add them above, or import from Volunteers or Participants." : "No members match your search."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Source</th><th>In reports</th>{isAdmin && <th>Actions</th>}</tr></thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td style={{ fontSize: 12 }}>
                      <a href={contribsLink(WIKIS[0].id, m.wikimediaUsername || "")} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{m.wikimediaUsername}</a>
                    </td>
                    <td style={{ fontSize: 12, color: "#666" }}>{m.source || "manual"}</td>
                    <td><input type="checkbox" checked={m.isActive !== false} disabled={!canEdit} onChange={() => toggleActive(m)} /></td>
                    {isAdmin && <td><button className="btn btn-sm btn-danger" onClick={() => del(m)}>✕</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ActiveContributors({ profile, currentGrant }) {
  const [tab,        setTab]        = useState("Report");
  const [members,    setMembers]    = useState([]);
  const [reports,    setReports]    = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [settings,   setSettings]   = useState(null);
  const [events,     setEvents]     = useState([]);
  const [scope,      setScope]      = useState(DEFAULT_SCOPE);
  const [toast,      setToast]      = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);
  // Matches the Firestore rules: only admins may delete (same as volunteers).
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const u1 = listenCommunityMembers(setMembers);
    const u2 = listenContributorReports(setReports);
    const u3 = listenVolunteers(setVolunteers);
    const u4 = listenParticipants(setParticipants);
    const u5 = listenSettings(setSettings);
    const u6 = listenContributorEvents(setEvents);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  // Name and logo for printed reports and certificates (same as Participants certificates)
  const org = { orgName: settings?.org?.name || "Wikimedians of Kilimanjaro", logoUrl: window.location.origin + logo };
  const signature = settings?.certificate || {};
  // Report, History and Year summary only see reports counted the chosen way.
  const scopedReports = useMemo(() => reports.filter(r => reportScope(r) === scope), [reports, scope]);

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Active contributors</div>
      <div className="page-sub">Community members who edited at least the set number of different Wikipedia articles in a month.</div>

      {SCOPED_TABS.includes(tab) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "4px 0 16px", fontSize: 13 }}>
          <span style={{ color: "#666" }}>Count contributions from:</span>
          {SCOPES.map(sc => (
            <button key={sc.id} className={`btn btn-sm ${scope === sc.id ? "btn-primary" : ""}`} onClick={() => setScope(sc.id)} title={sc.long}>{sc.label}</button>
          ))}
          <span style={{ fontSize: 12, color: "#888" }}>
            {scope === "events"
              ? "Only edits made in Kilimanjaro events (Events tab) — what our programs produced."
              : "Every edit on the wiki, including other groups' events — recognises work across the whole wiki."}
          </span>
        </div>
      )}

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t === "Members" && members.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: "#888" }}>{members.length}</span>}
            {t === "Events" && events.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: "#888" }}>{events.length}</span>}
          </button>
        ))}
      </div>

      {tab === "Report"  && <Report  members={members} reports={scopedReports} events={events} scope={scope} profile={profile} canEdit={canEdit} showToast={showToast} org={org} />}
      {tab === "History" && <History reports={scopedReports} />}
      {tab === "Year summary" && <YearSummary members={members} reports={scopedReports} scope={scope} currentGrant={currentGrant} profile={profile} org={org} signature={signature} />}
      {tab === "Events"  && <Events events={events} members={members} profile={profile} canEdit={canEdit} isAdmin={isAdmin} showToast={showToast} />}
      {tab === "Members" && <Members members={members} volunteers={volunteers} participants={participants} profile={profile} canEdit={canEdit} isAdmin={isAdmin} showToast={showToast} />}
    </div>
  );
}
