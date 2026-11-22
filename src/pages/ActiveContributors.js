import React, { useState, useEffect, useMemo } from "react";
import {
  listenCommunityMembers, addCommunityMember, updateCommunityMember, deleteCommunityMember,
  addCommunityMembersBulk, saveContributorReport, listenContributorReports, reportId,
} from "../services/contributorService";
import { listenVolunteers } from "../services/volunteerService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import {
  WIKIS, DEFAULT_WIKI, DEFAULT_THRESHOLD,
  normalizeUsername, currentMonth, lastFullMonth, isPartialMonth, previousMonths,
  fetchMonthStats, checkUsernames, buildReportRows, rowsToCsv,
} from "../utils/wikiContribs";

const TABS = ["Report", "History", "Members"];

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

function WikiSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {WIKIS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
    </select>
  );
}

// ── Report tab ─────────────────────────────────────────────────────────────────
function Report({ members, reports, profile, canEdit, showToast }) {
  const [month,     setMonth]     = useState(lastFullMonth());
  const [wiki,      setWiki]      = useState(DEFAULT_WIKI);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [fresh,     setFresh]     = useState(null);   // { wiki, month, members, stats }
  const [progress,  setProgress]  = useState(null);   // { done, total }
  const [error,     setError]     = useState("");
  const [saving,    setSaving]    = useState(false);

  const eligible = members.filter(m => m.isActive !== false && (m.wikimediaUsername || "").trim());
  const saved = reports.find(r => r.id === reportId(wiki, month));
  const freshMatches = fresh && fresh.wiki === wiki && fresh.month === month;

  // A fresh fetch wins over the saved copy; its rows follow the threshold live.
  const view = useMemo(() => {
    if (freshMatches) {
      const rows = buildReportRows(fresh.members, fresh.stats, threshold);
      return { rows, threshold: Number(threshold) || 0, partial: isPartialMonth(month), isSaved: false };
    }
    if (saved) {
      return { rows: saved.rows || [], threshold: saved.threshold, partial: saved.partial, isSaved: true, saved };
    }
    return null;
  }, [freshMatches, fresh, saved, threshold, month]);

  const activeCount = view ? view.rows.filter(r => r.active).length : 0;
  const memberCount = view ? view.rows.length : 0;
  const busy = progress !== null;

  const runFetch = async () => {
    if (eligible.length === 0) { setError("No members with a Wikipedia username are marked \"In reports\". Add members on the Members tab first."); return; }
    setError("");
    setProgress({ done: 0, total: eligible.length });
    try {
      const stats = await fetchMonthStats(
        eligible.map(m => m.wikimediaUsername), month, wiki,
        { onProgress: (done, total) => setProgress({ done, total }) },
      );
      setFresh({ wiki, month, members: eligible, stats });
    } catch (e) {
      setError(`Could not fetch from ${wikiLabel(wiki)}: ${e.message}`);
    } finally {
      setProgress(null);
    }
  };

  const save = async () => {
    if (!view || view.isSaved) return;
    setSaving(true);
    try {
      await saveContributorReport({
        wiki, month,
        threshold:   view.threshold,
        memberCount,
        activeCount,
        partial:     view.partial,
        rows:        view.rows,
        generatedBy: profile?.name || "",
        generatedAt: new Date().toISOString(),
      });
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "contributors", {
        targetId: reportId(wiki, month), recordTitle: `${wikiLabel(wiki)} ${month}`,
        details: `Saved active contributors report: ${activeCount} of ${memberCount} active (≥${view.threshold} articles)`,
      });
      setFresh(null);
      showToast("Report saved.");
    } catch (e) {
      setError(`Could not save the report: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    if (!view) return;
    const host = wiki.split(".")[0];
    downloadCsv(`active-contributors-${host}-${month}.csv`, rowsToCsv(view.rows, { month, wiki, threshold: view.threshold }));
    await addAudit(profile, AUDIT_ACTIONS.EXPORT, "contributors", {
      recordTitle: `${wikiLabel(wiki)} ${month}`, details: `Exported active contributors CSV (${memberCount} rows)`,
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
          {view && !view.isSaved && canEdit && (
            <button className="btn" onClick={save} disabled={saving || busy}>{saving ? "Saving…" : saved ? "Save report (replace saved copy)" : "Save report"}</button>
          )}
        </div>
        {busy && <div style={{ fontSize: 13, color: "#2563eb", marginTop: 10 }}>Checked {progress.done} of {progress.total} members…</div>}
        <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
          {eligible.length} member{eligible.length === 1 ? "" : "s"} will be checked. Counts articles only (main namespace), using UTC calendar months.
          Edits to pages that were later deleted are not counted.
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {view?.partial && (
        <div className="alert alert-warn">{monthLabel(month)} isn't finished yet. These are the counts so far.</div>
      )}

      {!view ? (
        <div className="panel"><div className="empty">No report for {wikiLabel(wiki)}, {monthLabel(month)} yet. Click "Fetch from Wikipedia" to count contributions.</div></div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13, flexWrap: "wrap" }}>
            {view.isSaved ? (
              <span className="badge badge-green">Saved{view.saved.generatedBy ? ` by ${view.saved.generatedBy}` : ""}{view.saved.generatedAt ? ` on ${view.saved.generatedAt.slice(0, 10)}` : ""}</span>
            ) : (
              <span className="badge badge-amber">Not saved yet</span>
            )}
            <span style={{ color: "#666" }}>Rule: active if ≥ {view.threshold} different articles in {monthLabel(month)}</span>
          </div>

          <div className="card-grid">
            {[
              ["Members checked",            memberCount,               "#1c2b1e"],
              [`Active (≥${view.threshold})`, activeCount,               "#2d7a4f"],
              ["Not yet active",             memberCount - activeCount, "#d97706"],
              ["Active rate",                pctText(activeCount, memberCount), "#2563eb"],
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
                        <td style={{ fontWeight: 500 }}>{r.name}</td>
                        <td style={{ fontSize: 12 }}><a href={contribsLink(wiki, r.username)} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{r.username}</a></td>
                        <td style={{ fontWeight: 600 }}>{r.articles}</td>
                        <td style={{ fontSize: 12 }}>{r.edits}</td>
                        <td style={{ minWidth: 120 }}>
                          <div className="progress-bar">
                            <div style={{ height: "100%", width: `${Math.min(100, (r.articles / (view.threshold || 1)) * 100)}%`, background: r.active ? "#4a9e6b" : "#d97706" }} />
                          </div>
                        </td>
                        <td>{r.active ? <span className="badge badge-green">Active</span> : <span className="badge badge-amber">Not yet</span>}</td>
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
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2d7a4f", borderRadius: 2, marginRight: 4 }} />Active</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minWidth: 560, height: CHART_H + 36 }}>
            {months.map(m => {
              const r = byMonth[m];
              const mh = r ? (r.memberCount / maxMembers) * CHART_H : 0;
              const ah = r ? (r.activeCount / maxMembers) * CHART_H : 0;
              return (
                <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                  title={r ? `${monthLabel(m)}: ${r.activeCount} of ${r.memberCount} active` : `${monthLabel(m)}: no saved report`}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#2d7a4f", height: 14 }}>{r ? r.activeCount : ""}</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: CHART_H }}>
                    <div style={{ width: 12, height: mh, background: "#c9d8cd", borderRadius: "2px 2px 0 0" }} />
                    <div style={{ width: 12, height: ah, background: "#2d7a4f", borderRadius: "2px 2px 0 0" }} />
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
              <thead><tr><th>Month</th><th>Members</th><th>Active</th><th>Rate</th><th>Rule</th><th>Saved by</th></tr></thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{monthLabel(r.month)}{r.partial && <span className="badge badge-amber" style={{ marginLeft: 6 }}>so far</span>}</td>
                    <td>{r.memberCount}</td>
                    <td style={{ fontWeight: 600, color: "#2d7a4f" }}>{r.activeCount}</td>
                    <td>{pctText(r.activeCount, r.memberCount)}</td>
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

// ── Members tab ────────────────────────────────────────────────────────────────
function Members({ members, volunteers, profile, canEdit, isAdmin, showToast }) {
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

  const importable = useMemo(() => {
    const seen = new Set(existing);
    const out = [];
    for (const v of volunteers) {
      const u = normalizeUsername(v.wikimediaUsername);
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push({ name: (v.name || "").trim() || u, wikimediaUsername: u, isActive: true, source: "volunteers" });
    }
    return out;
  }, [volunteers, existing]);

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
            </div>
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
          <div className="empty">{members.length === 0 ? "No community members yet. Add them above or import from Volunteers." : "No members match your search."}</div>
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
export default function ActiveContributors({ profile }) {
  const [tab,        setTab]        = useState("Report");
  const [members,    setMembers]    = useState([]);
  const [reports,    setReports]    = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [toast,      setToast]      = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);
  // Matches the Firestore rules: only admins may delete (same as volunteers).
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    const u1 = listenCommunityMembers(setMembers);
    const u2 = listenContributorReports(setReports);
    const u3 = listenVolunteers(setVolunteers);
    return () => { u1(); u2(); u3(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Active contributors</div>
      <div className="page-sub">Community members who edited at least the set number of different Wikipedia articles in a month.</div>

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t === "Members" && members.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: "#888" }}>{members.length}</span>}
          </button>
        ))}
      </div>

      {tab === "Report"  && <Report  members={members} reports={reports} profile={profile} canEdit={canEdit} showToast={showToast} />}
      {tab === "History" && <History reports={reports} />}
      {tab === "Members" && <Members members={members} volunteers={volunteers} profile={profile} canEdit={canEdit} isAdmin={isAdmin} showToast={showToast} />}
    </div>
  );
}
