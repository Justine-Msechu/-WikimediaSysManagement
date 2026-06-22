import React, { useState, useEffect } from "react";
import { listenMetrics, listenMetricsByGrant, updateMetrics, updateMetricsByGrant, DEFAULT_METRICS } from "../services/metricsService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { listenParticipants } from "../services/participantService";
import { listenSettings } from "../services/settingsService";
import { listenActivities } from "../services/activityService";
import { listenPrograms } from "../services/programService";

function fmt(n) { return (n || 0).toLocaleString(); }
function pct(r, t) { if (!t) return 0; return Math.min(999, Math.round((r / t) * 100)); }
function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

const METRIC_ROWS = [
  { key: "participants",    label: "All participants" },
  { key: "allEditors",      label: "All editors" },
  { key: "newEditors",      label: "New editors" },
  { key: "retainedEditors", label: "Retained editors" },
  { key: "allOrganizers",   label: "All organizers" },
  { key: "newOrganizers",   label: "New organizers" },
];

const PROJECT_FIELDS = ["Wikipedia", "Wikimedia Commons", "Wikidata", "Wiktionary", "Wikisource"];

export default function Metrics({ profile, grantId, currentGrant }) {
  const [metrics,      setMetrics]      = useState(DEFAULT_METRICS);
  const [participants, setParticipants] = useState([]);
  const [activities,   setActivities]   = useState([]);
  const [programs,     setPrograms]     = useState([]);
  const [settings,     setSettings]     = useState(null);
  const [wikiStats,    setWikiStats]    = useState({});
  const [fetchingAll,  setFetchingAll]  = useState(false);
  const [fetchingOD,   setFetchingOD]   = useState(false);
  const [suggestion,   setSuggestion]   = useState(null);
  const [saved,        setSaved]        = useState(false);
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = grantId
      ? listenMetricsByGrant(grantId, setMetrics)
      : listenMetrics(setMetrics);
    const u2 = listenParticipants(setParticipants);
    const u3 = listenSettings(setSettings);
    const u4 = listenActivities(setActivities);
    const u5 = listenPrograms(setPrograms);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [grantId]);

  const save = async (patch) => {
    const merged = { ...metrics, ...patch };
    if (grantId) {
      await updateMetricsByGrant(grantId, patch);
    } else {
      await updateMetrics(patch);
    }
    setMetrics(merged);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const setIndicator = (key, field, val) => {
    save({ [key]: { ...(metrics[key] || {}), [field]: Number(val) || 0 } });
  };

  const setProject = (name, field, val) => {
    const projects = (metrics.projects || PROJECT_FIELDS.map(p => ({ name: p, tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 })))
      .map(p => p.name === name ? { ...p, [field]: Number(val) || 0 } : p);
    save({ projects });
  };

  const projects = metrics.projects || PROJECT_FIELDS.map(p => ({ name: p, tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 }));

  // Scope to current grant
  const grantProgramIds = grantId
    ? new Set(programs.filter(p => p.grantId === grantId).map(p => p.id))
    : null;
  const grantActivities  = grantId ? activities.filter(a => a.grantId === grantId) : activities;
  const grantParticipants = grantId
    ? participants.filter(p => grantProgramIds.has(p.programId))
    : participants;

  const registryCounts = {
    participants:    grantParticipants.length,
    allEditors:      grantParticipants.filter(p => p.wikimediaUsername).length,
    newEditors:      grantParticipants.filter(p => p.isNew).length,
    retainedEditors: grantParticipants.filter(p => !p.isNew && p.wikimediaUsername).length,
  };

  const sum = (field) => grantActivities.reduce((acc, a) => acc + (Number(a[field]) || 0), 0);

  const activityRollup = grantActivities.length === 0 ? null : {
    participants:      sum("participants"),
    newEditors:        sum("newEditors"),
    retainedEditors:   sum("retainedEditors"),
    allEditors:        sum("newEditors") + sum("retainedEditors"),
    organizers:        sum("organizers"),
    newOrganizers:     sum("newOrganizers"),
    createdSwahili:    sum("created"),
    improvedSwahili:   sum("improved"),
    createdEnglish:    sum("createdEnglish"),
    improvedEnglish:   sum("improvedEnglish"),
    commons:           sum("commons"),
    wikidata:          sum("wikidata"),
  };

  const applyActivityRollup = async () => {
    if (!activityRollup) return;
    const updatedProjects = (metrics.projects || []).map(p => {
      const name = p.name.toLowerCase();
      if (name.includes("wikipedia") && name.includes("swahili"))
        return { ...p, rCreated: activityRollup.createdSwahili, rImproved: activityRollup.improvedSwahili };
      if (name.includes("wikipedia") && name.includes("english"))
        return { ...p, rCreated: activityRollup.createdEnglish, rImproved: activityRollup.improvedEnglish };
      if (name.includes("commons"))
        return { ...p, rCreated: activityRollup.commons };
      if (name.includes("wikidata"))
        return { ...p, rCreated: activityRollup.wikidata };
      return p;
    });
    await save({
      participants:    { ...(metrics.participants    || {}), result: activityRollup.participants },
      allEditors:      { ...(metrics.allEditors      || {}), result: activityRollup.allEditors },
      newEditors:      { ...(metrics.newEditors      || {}), result: activityRollup.newEditors },
      retainedEditors: { ...(metrics.retainedEditors || {}), result: activityRollup.retainedEditors },
      allOrganizers:   { ...(metrics.allOrganizers   || {}), result: activityRollup.organizers },
      newOrganizers:   { ...(metrics.newOrganizers   || {}), result: activityRollup.newOrganizers },
      projects: updatedProjects,
    });
  };

  const applyRegistryCounts = async () => {
    await save({
      participants:    { ...(metrics.participants    || {}), result: registryCounts.participants },
      allEditors:      { ...(metrics.allEditors      || {}), result: registryCounts.allEditors },
      newEditors:      { ...(metrics.newEditors      || {}), result: registryCounts.newEditors },
      retainedEditors: { ...(metrics.retainedEditors || {}), result: registryCounts.retainedEditors },
    });
  };

  const fetchAndSuggest = async () => {
    const withUsername = grantParticipants.filter(p => p.wikimediaUsername);
    if (!withUsername.length) {
      alert("No participants have a Wikipedia username. Add participants with usernames first.");
      return;
    }
    setFetchingAll(true);
    const stats = {};
    const BATCH = 50;
    try {
      for (let i = 0; i < withUsername.length; i += BATCH) {
        const batch = withUsername.slice(i, i + BATCH);
        const names = batch.map(p => p.wikimediaUsername).join("|");
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=users&ususers=${encodeURIComponent(names)}&usprop=editcount&format=json&origin=*`;
        const res  = await fetch(url);
        const json = await res.json();
        (json?.query?.users || []).forEach(u => {
          if (!u.missing && u.editcount != null) stats[u.name] = u.editcount;
        });
      }
    } catch (err) {
      alert("Wikimedia API error: " + (err.message || "Could not fetch data."));
      setFetchingAll(false);
      return;
    }
    setWikiStats(stats);

    const activeEditors   = Object.values(stats).filter(v => v > 0).length;
    const allEditors      = Object.keys(stats).length;
    const newEditorCount  = grantParticipants.filter(p => p.isNew && p.wikimediaUsername && stats[p.wikimediaUsername] != null).length;
    const totalParticipants = grantParticipants.length;

    setSuggestion({
      participants: totalParticipants,
      allEditors,
      newEditors: newEditorCount,
      activeEditors,
      fetchedCount: allEditors,
      totalUsernames: withUsername.length,
    });
    setFetchingAll(false);
  };

  const applySuggestion = async () => {
    if (!suggestion) return;
    const patch = {};
    if (suggestion.participants > 0)
      patch.participants = { ...(metrics.participants || {}), result: suggestion.participants };
    if (suggestion.allEditors > 0)
      patch.allEditors = { ...(metrics.allEditors || {}), result: suggestion.allEditors };
    if (suggestion.newEditors > 0)
      patch.newEditors = { ...(metrics.newEditors || {}), result: suggestion.newEditors };
    await save(patch);
    setSuggestion(null);
  };

  const fetchFromOD = async () => {
    const raw = (currentGrant?.odCampaignUrl || settings?.grant?.odCampaignUrl || "").trim();
    if (!raw) {
      alert("No Outreach Dashboard campaign URL set. Go to Settings → Grant configuration and paste your campaign URL.");
      return;
    }
    // Parse the URL and reconstruct just the campaign base:
    // https://outreachdashboard.wmflabs.org/campaigns/{slug}/anything → /campaigns/{slug}.json
    let fetchUrl;
    try {
      const u = new URL(raw);
      const parts = u.pathname.split("/").filter(Boolean); // ["campaigns", "slug", "overview"]
      if (parts.length < 2 || parts[0] !== "campaigns") throw new Error();
      fetchUrl = `${u.origin}/campaigns/${parts[1]}.json`;
    } catch {
      alert("Invalid Outreach Dashboard URL. Paste any page from your campaign, e.g. the /overview or /programs tab.");
      return;
    }
    setFetchingOD(true);
    try {
      const res  = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const c    = data.campaign || data;

      const parseHuman = (s) => {
        if (!s) return 0;
        const n = parseFloat(String(s).replace(/,/g, ""));
        if (String(s).toLowerCase().includes("k")) return Math.round(n * 1000);
        if (String(s).toLowerCase().includes("m")) return Math.round(n * 1000000);
        return Math.round(n) || 0;
      };

      setSuggestion({
        source:          "outreach-dashboard",
        programs:        c.courses_count          || 0,
        allEditors:      c.user_count             || 0,
        articlesCreated: parseHuman(c.new_article_count_human),
        articlesEdited:  parseHuman(c.article_count_human),
        wordsAdded:      parseHuman(c.word_count_human),
        refsAdded:       parseHuman(c.references_count_human),
        commonsUploads:  parseHuman(c.upload_count_human),
      });
    } catch (err) {
      alert("Could not fetch from Outreach Dashboard: " + err.message);
    } finally {
      setFetchingOD(false);
    }
  };

  const applyODSuggestion = async () => {
    if (!suggestion || suggestion.source !== "outreach-dashboard") return;
    const patch = {};
    if (suggestion.allEditors > 0)
      patch.allEditors = { ...(metrics.allEditors || {}), result: suggestion.allEditors };
    // Map article contributions to Wikipedia project row
    // OD gives campaign totals — apply articles to Swahili Wikipedia (primary project),
    // Commons uploads to Wikimedia Commons. English Wikipedia must be entered manually.
    let appliedWikipedia = false;
    const updatedProjects = (metrics.projects || []).map(p => {
      const name = p.name.toLowerCase();
      if (!appliedWikipedia && name.includes("wikipedia") && name.includes("swahili")) {
        appliedWikipedia = true;
        return { ...p, rCreated: suggestion.articlesCreated || p.rCreated, rImproved: suggestion.articlesEdited || p.rImproved };
      }
      if (name.includes("commons")) {
        return { ...p, rCreated: suggestion.commonsUploads || p.rCreated };
      }
      return p;
    });
    if (updatedProjects.length) patch.projects = updatedProjects;
    await save(patch);
    setSuggestion(null);
  };

  const exportCSV = () => {
    const rows = [
      ["Metric", "Target", "Result", "% Achieved"],
      ...METRIC_ROWS.map(({ key, label }) => {
        const v = metrics[key] || { target: 0, result: 0 };
        return [label, v.target, v.result, pct(v.result, v.target) + "%"];
      }),
      [],
      ["Project", "Target created", "Target improved", "Result created", "Result improved", "% Overall"],
      ...projects.map(p => [
        p.name, p.tCreated, p.tImproved, p.rCreated, p.rImproved,
        Math.round((pct(p.rCreated, p.tCreated) + pct(p.rImproved, p.tImproved)) / 2) + "%",
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `metrics-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printPDF = () => {
    const indicatorRows = METRIC_ROWS.map(({ key, label }) => {
      const v = metrics[key] || { target: 0, result: 0 };
      const p2 = pct(v.result, v.target);
      const color = p2 >= 100 ? "#2d7a4f" : p2 >= 60 ? "#d97706" : "#888";
      return `<tr>
        <td>${esc(label)}</td><td style="text-align:right">${fmt(v.target)}</td>
        <td style="text-align:right">${fmt(v.result)}</td>
        <td style="text-align:right;color:${color};font-weight:700">${p2}%</td>
      </tr>`;
    }).join("");
    const projectRows = projects.map(p => {
      const pc = pct(p.rCreated, p.tCreated);
      const pi = pct(p.rImproved, p.tImproved);
      const overall = Math.round((pc + pi) / 2);
      const color = overall >= 100 ? "#2d7a4f" : overall >= 60 ? "#d97706" : "#888";
      return `<tr>
        <td>${esc(p.name)}</td>
        <td style="text-align:right">${fmt(p.tCreated)}</td><td style="text-align:right">${fmt(p.tImproved)}</td>
        <td style="text-align:right">${fmt(p.rCreated)}</td><td style="text-align:right">${fmt(p.rImproved)}</td>
        <td style="text-align:right;color:${color};font-weight:700">${overall}%</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Metrics Report</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1c2b1e;padding:32px;max-width:860px;margin:0 auto}
      h1{font-size:20px;color:#1c2b1e;border-bottom:2px solid #2d7a4f;padding-bottom:10px;margin-bottom:20px}
      h2{font-size:14px;color:#2d7a4f;margin:24px 0 10px}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      th{background:#1c2b1e;color:#fff;padding:7px 10px;text-align:left;font-size:11px}
      td{padding:6px 10px;border-bottom:1px solid #e8e8e4}
      tr:nth-child(even)td{background:#f9f9f7}
      .no-print{text-align:center;margin-bottom:20px}
      .no-print button{padding:8px 24px;background:#2d7a4f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin:0 6px}
      @media print{.no-print{display:none}}
    </style></head><body>
    <div class="no-print">
      <button onclick="window.print()">Print / Save PDF</button>
      <button onclick="window.close()" style="background:#f5f4f0;color:#333;border:1px solid #ccc">Close</button>
    </div>
    <h1>Metrics Report — Wikimedians of Kilimanjaro</h1>
    <p style="font-size:12px;color:#888">Generated: ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}</p>
    <h2>Participants &amp; editors</h2>
    <table><thead><tr><th>Metric</th><th style="text-align:right">Target</th><th style="text-align:right">Result</th><th style="text-align:right">Achieved</th></tr></thead>
    <tbody>${indicatorRows}</tbody></table>
    <h2>Wikimedia project contributions</h2>
    <table><thead><tr><th>Project</th><th style="text-align:right">Target created</th><th style="text-align:right">Target improved</th><th style="text-align:right">Result created</th><th style="text-align:right">Result improved</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${projectRows}</tbody></table>
    </body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(html);
    w.document.close();
  };

  return (
    <div>
      <div className="page-title">Metrics</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Set targets when applying. Update results throughout the grant year.</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn btn-sm btn-primary" onClick={fetchAndSuggest} disabled={fetchingAll}>
          {fetchingAll ? "Fetching from Wikimedia…" : "Fetch from Wikimedia API"}
        </button>
        <button className="btn btn-sm" onClick={fetchFromOD} disabled={fetchingOD}>
          {fetchingOD ? "Fetching from OD…" : "Fetch from Outreach Dashboard"}
        </button>
        <button className="btn btn-sm" onClick={exportCSV}>Export CSV</button>
        <button className="btn btn-sm" onClick={printPDF}>Print / PDF report</button>
      </div>

      {suggestion && suggestion.source !== "outreach-dashboard" && (
        <div className="panel" style={{ marginBottom: 16, background: "#f0f8f3", border: "1px solid #b7e0c8" }}>
          <div className="panel-title" style={{ color: "#2d7a4f", marginBottom: 8 }}>Wikimedia API results — suggested updates</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
            <div><span style={{ color: "#888" }}>Total participants in registry:</span> <strong>{suggestion.participants}</strong></div>
            <div><span style={{ color: "#888" }}>All editors (have Wikipedia username):</span> <strong style={{ color: "#2d7a4f" }}>{suggestion.allEditors}</strong> / {suggestion.totalUsernames} checked</div>
            <div><span style={{ color: "#888" }}>New editors (marked as new):</span> <strong style={{ color: "#2563eb" }}>{suggestion.newEditors}</strong></div>
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
            Apply these counts as result values for Participants, All editors, and New editors metrics.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && <button className="btn btn-sm btn-primary" onClick={applySuggestion}>Apply to metrics results</button>}
            <button className="btn btn-sm" onClick={() => setSuggestion(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {activityRollup && (
        <div className="panel" style={{ marginBottom: 16, background: "#fff8f0", border: "1px solid #f0d5b0" }}>
          <div className="panel-title" style={{ color: "#b45309", marginBottom: 8 }}>Activity rollup — totals from {grantActivities.length} logged activities</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
            <div><span style={{ color: "#888" }}>Participants:</span> <strong>{fmt(activityRollup.participants)}</strong></div>
            <div><span style={{ color: "#888" }}>New editors:</span> <strong>{fmt(activityRollup.newEditors)}</strong></div>
            <div><span style={{ color: "#888" }}>Retained editors:</span> <strong>{fmt(activityRollup.retainedEditors)}</strong></div>
            <div><span style={{ color: "#888" }}>All organisers:</span> <strong>{fmt(activityRollup.organizers)}</strong></div>
            <div><span style={{ color: "#888" }}>New organisers:</span> <strong>{fmt(activityRollup.newOrganizers)}</strong></div>
            <div><span style={{ color: "#888" }}>Swahili Wikipedia created:</span> <strong>{fmt(activityRollup.createdSwahili)}</strong></div>
            <div><span style={{ color: "#888" }}>Swahili Wikipedia improved:</span> <strong>{fmt(activityRollup.improvedSwahili)}</strong></div>
            <div><span style={{ color: "#888" }}>English Wikipedia created:</span> <strong>{fmt(activityRollup.createdEnglish)}</strong></div>
            <div><span style={{ color: "#888" }}>English Wikipedia improved:</span> <strong>{fmt(activityRollup.improvedEnglish)}</strong></div>
            <div><span style={{ color: "#888" }}>Commons uploads:</span> <strong>{fmt(activityRollup.commons)}</strong></div>
            <div><span style={{ color: "#888" }}>Wikidata items:</span> <strong>{fmt(activityRollup.wikidata)}</strong></div>
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Note: these are activity-level sums — a participant in 3 events is counted 3 times. Use as a cross-check, not as unique counts.
          </div>
          {canEdit && <button className="btn btn-sm btn-primary" style={{ background: "#b45309" }} onClick={applyActivityRollup}>Apply all to metrics results</button>}
        </div>
      )}

      {grantParticipants.length > 0 && (
        <div className="panel" style={{ marginBottom: 16, background: "#f5f8ff", border: "1px solid #c5d5f0" }}>
          <div className="panel-title" style={{ color: "#2563eb", marginBottom: 8 }}>Registry summary — from your participants list</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
            <div><span style={{ color: "#888" }}>Total registered:</span> <strong>{registryCounts.participants}</strong></div>
            <div><span style={{ color: "#888" }}>Have Wikipedia username:</span> <strong>{registryCounts.allEditors}</strong></div>
            <div><span style={{ color: "#888" }}>New editors (first time):</span> <strong style={{ color: "#2563eb" }}>{registryCounts.newEditors}</strong></div>
            <div><span style={{ color: "#888" }}>Retained editors (edited before):</span> <strong style={{ color: "#7c3aed" }}>{registryCounts.retainedEditors}</strong></div>
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            New/retained counts come from the "Have you edited Wikipedia before?" answer on registration forms. Participants added manually use the "New editor" checkbox.
          </div>
          {canEdit && <button className="btn btn-sm btn-primary" style={{ background: "#2563eb" }} onClick={applyRegistryCounts}>Apply counts to results</button>}
        </div>
      )}

      {suggestion && suggestion.source === "outreach-dashboard" && (
        <div className="panel" style={{ marginBottom: 16, background: "#f0f8f3", border: "1px solid #b7e0c8" }}>
          <div className="panel-title" style={{ color: "#2d7a4f", marginBottom: 8 }}>Outreach Dashboard — live campaign stats</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, marginBottom: 12 }}>
            <div><span style={{ color: "#888" }}>Programs:</span> <strong>{suggestion.programs}</strong></div>
            <div><span style={{ color: "#888" }}>All editors:</span> <strong style={{ color: "#2d7a4f" }}>{fmt(suggestion.allEditors)}</strong></div>
            <div><span style={{ color: "#888" }}>Articles created:</span> <strong>{fmt(suggestion.articlesCreated)}</strong></div>
            <div><span style={{ color: "#888" }}>Articles edited:</span> <strong>{fmt(suggestion.articlesEdited)}</strong></div>
            <div><span style={{ color: "#888" }}>Words added:</span> <strong>{fmt(suggestion.wordsAdded)}</strong></div>
            <div><span style={{ color: "#888" }}>References added:</span> <strong>{fmt(suggestion.refsAdded)}</strong></div>
            <div><span style={{ color: "#888" }}>Commons uploads:</span> <strong>{fmt(suggestion.commonsUploads)}</strong></div>
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
            Applies: All editors to result. Articles to Swahili Wikipedia result columns. Commons uploads to Commons result. English Wikipedia must be entered manually.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && <button className="btn btn-sm btn-primary" onClick={applyODSuggestion}>Apply to metrics results</button>}
            <button className="btn btn-sm" onClick={() => setSuggestion(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {saved && <div style={{ background: "#e6f4ec", border: "1px solid #b7e0c8", borderRadius: 8, padding: "8px 14px", fontSize: 13, marginBottom: 16, color: "#2d7a4f" }}>✓ Metrics saved.</div>}

      <fieldset disabled={!canEdit} style={{ border: "none", padding: 0, margin: 0 }}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">Participants &amp; editors</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Metric</th><th>Target</th><th>Result</th><th>Achieved</th></tr></thead>
              <tbody>
                {METRIC_ROWS.map(({ key, label }) => {
                  const val = metrics[key] || { target: 0, result: 0 };
                  const p   = pct(val.result, val.target);
                  const cls = p >= 100 ? "badge-green" : p >= 60 ? "badge-amber" : "badge-gray";
                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 500 }}>{label}</td>
                      <td><input key={`${key}-t-${val.target}`} type="number" min="0" defaultValue={val.target} onBlur={e => setIndicator(key, "target", e.target.value)} style={{ width: 90 }} /></td>
                      <td><input key={`${key}-r-${val.result}`} type="number" min="0" defaultValue={val.result} onBlur={e => setIndicator(key, "result", e.target.value)} style={{ width: 90 }} /></td>
                      <td><span className={`badge ${cls}`}>{p}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Wikimedia project contributions</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Project</th><th>Target created</th><th>Target improved</th><th>Result created</th><th>Result improved</th><th>%</th></tr></thead>
              <tbody>
                {projects.map(p => {
                  const pc = pct(p.rCreated, p.tCreated);
                  const pi = pct(p.rImproved, p.tImproved);
                  const overall = Math.round((pc + pi) / 2);
                  const cls = overall >= 100 ? "badge-green" : overall >= 60 ? "badge-amber" : "badge-gray";
                  return (
                    <tr key={p.name}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td><input key={`${p.name}-tc-${p.tCreated}`}  type="number" min="0" defaultValue={p.tCreated}  onBlur={e => setProject(p.name, "tCreated",  e.target.value)} style={{ width: 80 }} /></td>
                      <td><input key={`${p.name}-ti-${p.tImproved}`} type="number" min="0" defaultValue={p.tImproved} onBlur={e => setProject(p.name, "tImproved", e.target.value)} style={{ width: 80 }} /></td>
                      <td><input key={`${p.name}-rc-${p.rCreated}`}  type="number" min="0" defaultValue={p.rCreated}  onBlur={e => setProject(p.name, "rCreated",  e.target.value)} style={{ width: 80 }} /></td>
                      <td><input key={`${p.name}-ri-${p.rImproved}`} type="number" min="0" defaultValue={p.rImproved} onBlur={e => setProject(p.name, "rImproved", e.target.value)} style={{ width: 80 }} /></td>
                      <td><span className={`badge ${cls}`}>{overall}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </fieldset>

      {!canEdit && <div style={{ fontSize: 12, color: "#aaa", marginTop: 12 }}>Metrics can be edited by Coordinator or Admin.</div>}
    </div>
  );
}
