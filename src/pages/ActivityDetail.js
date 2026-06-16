import React, { useState, useEffect } from "react";
import { getActivity } from "../services/activityService";
import { listenEvidence } from "../services/activityService";
import { getProgramById } from "../services/programService";
import { addEvidenceLink, removeEvidenceLink, EVIDENCE_TYPES } from "../services/storageService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import logo from "../assets/logo.png";

function buildReport(a, programName) {
  const lines = [
    `ACTIVITY REPORT: ${(a.name || "").toUpperCase()}`,
    "=".repeat(60),
    `Date:        ${a.date || ""}`,
    `Location:    ${a.location || ""}`,
    `Type:        ${a.type || ""}`,
    `Program:     ${programName || ""}`,
    `Reported by: ${a.reportedBy || ""}`,
    "",
    "PARTICIPATION",
    "-".repeat(40),
    `Total participants:  ${a.participants ?? ""}`,
    `Women:               ${a.women ?? ""}`,
    `New editors:         ${a.newEditors ?? ""}`,
    `Youth (≤25):         ${a.youth ?? ""}`,
    `Persons w/ disab.:   ${a.pwd ?? ""}`,
    "",
    "CONTENT CONTRIBUTIONS",
    "-".repeat(40),
    `Articles created:    ${a.created ?? ""}`,
    `Articles improved:   ${a.improved ?? ""}`,
    `Commons uploads:     ${a.commons ?? ""}`,
    `Wikidata items:      ${a.wikidata ?? ""}`,
    "",
    "NARRATIVE",
    "-".repeat(40),
    `Summary:\n${a.summary || ""}`,
    "",
    `Challenges:\n${a.challenges || ""}`,
    "",
    `Lessons learned:\n${a.lessons || ""}`,
    "",
    `Impact stories:\n${a.stories || ""}`,
    "",
    `Next steps:\n${a.nextSteps || ""}`,
    "",
    `Report link: ${a.link || ""}`,
  ];
  return lines.join("\n");
}

const ICON = {
  "Photo / gallery link":     "🖼",
  "Video link":               "🎥",
  "Attendance sheet":         "📋",
  "Report document":          "📄",
  "Outreach Dashboard link":  "📊",
  "Meta-Wiki page":           "🌐",
  "Other":                    "🔗",
};

const EMPTY_LINK = { url: "", title: "", evidenceType: EVIDENCE_TYPES[0], description: "" };

export default function ActivityDetail({ activityId, profile, goPage }) {
  const [activity, setActivity] = useState(null);
  const [program,  setProgram]  = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [showAdd,  setShowAdd]  = useState(false);
  const [linkForm, setLinkForm] = useState(EMPTY_LINK);
  const [busy,     setBusy]     = useState(false);
  const [toast,    setToast]    = useState("");

  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    if (!activityId) return;
    getActivity(activityId).then(a => {
      setActivity(a);
      if (a?.programId) getProgramById(a.programId).then(setProgram);
    });
    return listenEvidence(activityId, setEvidence);
  }, [activityId]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setLinkForm(f => ({ ...f, [k]: v }));

  const addLink = async () => {
    if (!linkForm.url.trim()) { alert("URL is required."); return; }
    setBusy(true);
    try {
      await addEvidenceLink(activityId, linkForm, profile);
      showToast("Evidence link added.");
      setLinkForm(EMPTY_LINK);
      setShowAdd(false);
    } catch (err) {
      alert(err.message || "Failed to add link.");
    } finally {
      setBusy(false);
    }
  };

  const removeLink = async (ev) => {
    if (!window.confirm(`Remove "${ev.title || ev.url}"?`)) return;
    await removeEvidenceLink(ev, profile);
    showToast("Evidence removed.");
  };

  const downloadReport = () => {
    const text = buildReport(activity, program?.name);
    const blob  = new Blob([text], { type: "text/plain" });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement("a");
    a.href = url; a.download = `activity-report-${activityId}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!activity) return <div className="empty">Loading activity…</div>;

  const STAT_ROWS = [
    ["Total participants", activity.participants],
    ["Women",              activity.women],
    ["New editors",        activity.newEditors],
    ["Youth (≤25)",        activity.youth],
    ["Persons w/ disab.",  activity.pwd],
    ["Articles created",   activity.created],
    ["Articles improved",  activity.improved],
    ["Commons uploads",    activity.commons],
    ["Wikidata items",     activity.wikidata],
  ];

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" onClick={() => goPage("activities")}>← Back to activities</button>
        <button className="btn btn-primary" onClick={downloadReport}>Download report (.txt)</button>
      </div>

      {/* Header */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <img src={logo} alt="logo" style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{activity.name}</div>
            <div style={{ fontSize: 13, color: "#555" }}>
              {activity.date} · {activity.type} · {activity.location || "Location not set"}
              {program && <span> · <span style={{ color: "#4a9e6b" }}>{program.name}</span></span>}
            </div>
            {activity.reportedBy && <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Reported by: {activity.reportedBy}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          {activity.link        && <a href={activity.link}        target="_blank" rel="noreferrer" className="btn btn-sm">Open Meta-Wiki report →</a>}
          {activity.wikiEventUrl && <a href={activity.wikiEventUrl} target="_blank" rel="noreferrer" className="btn btn-sm">Open WEP event →</a>}
        </div>
      </div>

      {/* Stats + Narrative */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-title">Participation &amp; content</div>
          {STAT_ROWS.map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f5f4f0", fontSize: 13 }}>
              <span style={{ color: "#555" }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{val ?? ""}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            ["Activity summary", activity.summary],
            ["Challenges faced", activity.challenges],
            ["Lessons learned",  activity.lessons],
            ["Impact stories",   activity.stories],
            ["Next steps",       activity.nextSteps],
          ].filter(([, v]) => v).map(([title, val]) => (
            <div key={title} className="panel">
              <div className="panel-title" style={{ marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Evidence links */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>Evidence &amp; links</div>
          {canEdit && <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(s => !s)}>+ Add link</button>}
        </div>

        <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
          Paste links to photos, reports, or spreadsheets stored on Google Drive, Dropbox, Meta-Wiki, or any public URL.
        </div>

        {showAdd && (
          <div style={{ background: "#f5f4f0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div className="form-grid">
              <div className="field"><label>URL <span className="req">★</span></label>
                <input value={linkForm.url} onChange={e => setF("url", e.target.value)} placeholder="https://drive.google.com/…" autoFocus />
              </div>
              <div className="field"><label>Title</label>
                <input value={linkForm.title} onChange={e => setF("title", e.target.value)} placeholder="e.g. Event photos: July 2026" />
              </div>
              <div className="field"><label>Evidence type</label>
                <select value={linkForm.evidenceType} onChange={e => setF("evidenceType", e.target.value)}>
                  {EVIDENCE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>Description</label>
                <input value={linkForm.description} onChange={e => setF("description", e.target.value)} placeholder="Optional note" />
              </div>
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={addLink} disabled={busy}>{busy ? "Saving…" : "Add link"}</button>
              <button className="btn" onClick={() => { setShowAdd(false); setLinkForm(EMPTY_LINK); }}>Cancel</button>
            </div>
          </div>
        )}

        {evidence.length === 0 ? (
          <div className="empty">No evidence links yet.{canEdit ? " Click '+ Add link' to attach a Google Drive folder, report, or photo gallery." : ""}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {evidence.map(ev => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f9f9f7", borderRadius: 8, border: "1px solid #e8e8e4" }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{ICON[ev.evidenceType] || "🔗"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{ev.title || ev.url}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {ev.evidenceType}
                    {ev.description ? `: ${ev.description}` : ""}
                    {ev.addedBy ? ` · Added by ${ev.addedBy}` : ""}
                  </div>
                </div>
                <a href={ev.url} target="_blank" rel="noreferrer" className="btn btn-sm">Open →</a>
                {canEdit && <button className="btn btn-sm btn-danger" onClick={() => removeLink(ev)}>Remove</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
