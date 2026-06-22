import React, { useState, useEffect, useRef } from "react";
import { renderHtml } from "../components/RichTextEditor";
import { getActivity, updateActivity } from "../services/activityService";
import { listenEvidence } from "../services/activityService";
import { getProgramById } from "../services/programService";
import { addEvidenceLink, removeEvidenceLink, EVIDENCE_TYPES } from "../services/storageService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { addComment, listenComments, ROLE_COLOR } from "../services/commentService";
import { uploadToDrive, deleteFromDrive, fileIcon, preAuthorize } from "../services/driveService";
import { listenActivityFiles, addActivityFile, removeActivityFile } from "../services/activityFilesService";
import logo from "../assets/logo.png";

function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function stripHtml(html) {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .trim();
}

function buildReport(a, programName) {
  const lines = [
    "WIKIMEDIA COMMUNITY KILIMANJARO",
    "Youth Technology",
    "=".repeat(60),
    `ACTIVITY REPORT: ${(a.name || "").toUpperCase()}`,
    "=".repeat(60),
    `Date:        ${a.date || ""}`,
    `Location:    ${a.location || ""}`,
    `Type:        ${a.type || ""}`,
    `Program:     ${programName || ""}`,
    `Reported by: ${a.reportedBy || ""}`,
    `Assigned to: ${a.assignedTo || ""}`,
    "",
    "PARTICIPATION",
    "-".repeat(40),
    `Total participants:  ${a.participants ?? ""}`,
    `Women:               ${a.women ?? ""}`,
    `New editors:         ${a.newEditors ?? ""}`,
    `Youth (<=25):        ${a.youth ?? ""}`,
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
    `Summary:\n${stripHtml(a.summary)}`,
    "",
    `Challenges:\n${stripHtml(a.challenges)}`,
    "",
    `Lessons learned:\n${stripHtml(a.lessons)}`,
    "",
    `Impact stories:\n${stripHtml(a.stories)}`,
    "",
    `Next steps:\n${stripHtml(a.nextSteps)}`,
    "",
    `Report link: ${a.link || ""}`,
  ];
  return lines.join("\n");
}

const LINK_ICON = {
  "Photo / gallery link":    "🖼",
  "Video link":              "🎥",
  "Attendance sheet":        "📋",
  "Report document":         "📄",
  "Outreach Dashboard link": "📊",
  "Meta-Wiki page":          "🌐",
  "Other":                   "🔗",
};

const EMPTY_LINK = { url: "", title: "", evidenceType: EVIDENCE_TYPES[0], description: "" };

function CommentsPanel({ docType, docId, profile }) {
  const [comments,    setComments]    = useState([]);
  const [text,        setText]        = useState("");
  const [busy,        setBusy]        = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    return listenComments(docType, docId, setComments);
  }, [docType, docId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addComment(docType, docId, { text, author: profile?.name || "Unknown", authorRole: profile?.role || "viewer" });
      setText("");
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso) => {
    if (!iso) return "";
    try {
      const d = iso?.toDate ? iso.toDate() : new Date(iso);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div className="panel-title">Comments ({comments.length})</div>
      <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
        {comments.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13, padding: "8px 0" }}>No comments yet. Be the first to add one.</div>
        )}
        {comments.map(c => (
          <div key={c.id} style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: ROLE_COLOR[c.authorRole] || "#888", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {(c.author || "?")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: ROLE_COLOR[c.authorRole] || "#333" }}>{c.author}</span>
                <span style={{ color: "#aaa", marginLeft: 8 }}>{fmt(c.createdAt)}</span>
              </div>
              <div style={{ fontSize: 13, color: "#333", background: "#f5f4f0", borderRadius: 8, padding: "8px 12px", lineHeight: 1.5 }}>{c.text}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Write a comment… (Enter to send, Shift+Enter for new line)"
          rows={2}
          style={{ flex: 1, resize: "none", fontSize: 13 }}
        />
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy || !text.trim()} style={{ alignSelf: "flex-end" }}>
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

function FileUploadPanel({ activityId, canEdit, profile }) {
  const [uploads,  setUploads]  = useState([]);
  const [progress, setProgress] = useState(null);
  const [busy,     setBusy]     = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    return listenActivityFiles(activityId, setUploads);
  }, [activityId]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setProgress(0);
    try {
      const result = await uploadToDrive(file, setProgress);
      await addActivityFile(activityId, { ...result, uploadedBy: profile?.name || "" });
    } catch (err) {
      alert(err.message || "Upload failed.");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (rec) => {
    if (!window.confirm(`Remove "${rec.name}"?`)) return;
    await deleteFromDrive(rec.fileId);   // best-effort — works only for the uploader
    await removeActivityFile(rec.id);    // always removes from the shared list
  };

  const fmtSize = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#555" }}>Uploaded files (Google Drive)</div>
        {canEdit && (
          <>
            <button
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={async () => {
                try {
                  await preAuthorize();       // opens Google popup directly from click
                  inputRef.current?.click();  // only opens file picker after auth succeeds
                } catch (err) {
                  alert(err.message || "Could not connect to Google Drive.");
                }
              }}
            >
              {busy ? `Uploading ${progress ?? 0}%…` : "+ Upload to Drive"}
            </button>
            <input ref={inputRef} type="file" style={{ display: "none" }} onChange={handleFile} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" />
          </>
        )}
      </div>
      {progress !== null && (
        <div style={{ background: "#e8e8e4", borderRadius: 4, height: 6, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: 6, background: "#4a9e6b", transition: "width 0.2s" }} />
        </div>
      )}
      {uploads.length === 0 ? (
        <div style={{ color: "#aaa", fontSize: 12 }}>No files uploaded yet.{canEdit ? " Files go to Google Drive. Max 10 MB." : ""}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {uploads.map(u => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f5f4f0", borderRadius: 7, border: "1px solid #e8e8e4" }}>
              <span style={{ fontSize: 18 }}>{fileIcon(u.mimeType)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{u.size ? fmtSize(u.size) : ""}{u.uploadedBy ? ` · Uploaded by ${u.uploadedBy}` : ""}</div>
              </div>
              <a href={u.url} target="_blank" rel="noreferrer" className="btn btn-sm">Open in Drive</a>
              {canEdit && <button className="btn btn-sm btn-danger" onClick={() => remove(u)}>Remove</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistPanel({ activity, canEdit }) {
  const [items,    setItems]    = useState(activity.checklist || []);
  const [newText,  setNewText]  = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { setItems(activity.checklist || []); }, [activity.checklist]);

  const persist = async (updated) => {
    setSaving(true);
    try { await updateActivity(activity.id, { checklist: updated }); }
    finally { setSaving(false); }
  };

  const toggle = (i) => {
    const updated = items.map((it, idx) => idx === i ? { ...it, done: !it.done } : it);
    setItems(updated);
    persist(updated);
  };

  const add = async () => {
    if (!newText.trim()) return;
    const updated = [...items, { text: newText.trim(), done: false }];
    setItems(updated);
    setNewText("");
    await persist(updated);
  };

  const remove = async (i) => {
    const updated = items.filter((_, idx) => idx !== i);
    setItems(updated);
    await persist(updated);
  };

  const done  = items.filter(it => it.done).length;
  const total = items.length;

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="panel-title" style={{ marginBottom: 0 }}>Checklist {total > 0 && <span style={{ color: "#888", fontWeight: 400 }}>({done}/{total})</span>}</div>
        {total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: "#e8e8e4", borderRadius: 4, height: 6, width: 100, overflow: "hidden" }}>
              <div style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`, height: 6, background: "#4a9e6b", borderRadius: 4, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 11, color: "#888" }}>{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
          </div>
        )}
      </div>
      {items.length === 0 && !canEdit && <div style={{ color: "#aaa", fontSize: 13 }}>No checklist items.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canEdit ? 12 : 0 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: it.done ? "#f0f7f3" : "#f9f9f7", borderRadius: 6, border: `1px solid ${it.done ? "#b7e0c8" : "#e8e8e4"}` }}>
            <input type="checkbox" checked={it.done} onChange={() => toggle(i)} disabled={saving} style={{ cursor: "pointer", width: 16, height: 16, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: it.done ? "#888" : "#1c2b1e", textDecoration: it.done ? "line-through" : "none" }}>{it.text}</span>
            {canEdit && <button onClick={() => remove(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 14, padding: 0 }} disabled={saving}>✕</button>}
          </div>
        ))}
      </div>
      {canEdit && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            placeholder="Add checklist item… (Enter to add)"
            style={{ flex: 1, fontSize: 13 }}
            disabled={saving}
          />
          <button className="btn btn-sm btn-primary" onClick={add} disabled={saving || !newText.trim()}>Add</button>
        </div>
      )}
    </div>
  );
}

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
        <button className="btn" onClick={() => goPage("activities")}>Back to activities</button>
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
            <div style={{ fontSize: 12, color: "#888", marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
              {activity.reportedBy && <span>Reported by: <strong>{activity.reportedBy}</strong></span>}
              {activity.assignedTo && <span>Assigned to: <strong style={{ color: "#2d7a4f" }}>{activity.assignedTo}</strong></span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          {activity.link         && <a href={activity.link}         target="_blank" rel="noreferrer" className="btn btn-sm">Open Meta-Wiki report</a>}
          {activity.wikiEventUrl && <a href={activity.wikiEventUrl} target="_blank" rel="noreferrer" className="btn btn-sm">Open WEP event</a>}
        </div>
      </div>

      {/* QR code attendance — shown only when a registration form is linked */}
      {activity.linkedFormId && (() => {
        const qrUrl = `${window.location.origin}${window.location.pathname}?form=${activity.linkedFormId}`;
        return (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div className="panel-title" style={{ marginBottom: 4 }}>QR code attendance</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                  Print or display this QR code at the venue. Participants scan it to self-register without a coordinator present.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input readOnly value={qrUrl} style={{ fontSize: 11, background: "#f9f9f7", border: "1px solid #e8e8e4", borderRadius: 5, padding: "5px 8px", width: 320 }} onFocus={e => e.target.select()} />
                  <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(qrUrl); }}>Copy link</button>
                  <button className="btn btn-sm btn-primary" onClick={() => {
                    const w = window.open("", "_blank", "width=500,height=600");
                    w.document.write(`<!DOCTYPE html><html><head><title>QR — ${esc(activity.name)}</title>
                    <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#fff}
                    h2{font-size:18px;color:#1c2b1e;margin-bottom:4px}
                    p{font-size:13px;color:#666;margin:0 0 24px}
                    .no-print{margin-bottom:20px}
                    .no-print button{padding:8px 20px;background:#2d7a4f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px}
                    @media print{.no-print{display:none}}</style></head><body>
                    <div class="no-print"><button onclick="window.print()">Print QR code</button></div>
                    <h2>${esc(activity.name)}</h2>
                    <p>${esc(activity.date)}${activity.location ? " · " + esc(activity.location) : ""}</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrUrl)}" alt="QR code" style="width:280px;height:280px" />
                    <p style="margin-top:16px;font-size:12px;color:#aaa">Scan to register your attendance</p>
                    </body></html>`);
                    w.document.close();
                  }}>Print QR sheet</button>
                </div>
              </div>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}`}
                alt="Activity QR code"
                style={{ width: 120, height: 120, borderRadius: 8, border: "1px solid #e8e8e4" }}
              />
            </div>
          </div>
        );
      })()}

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
          ].filter(([, v]) => v && stripHtml(v)).map(([title, val]) => (
            <div key={title} className="panel">
              <div className="panel-title" style={{ marginBottom: 6 }}>{title}</div>
              <div
                style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: renderHtml(val) }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <ChecklistPanel activity={activity} canEdit={canEdit} />

      {/* Evidence links + File uploads */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>Evidence &amp; files</div>
          {canEdit && <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(s => !s)}>+ Add link</button>}
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

        {evidence.length === 0 && !showAdd ? (
          <div className="empty" style={{ marginBottom: 16 }}>No evidence links yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {evidence.map(ev => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f9f9f7", borderRadius: 8, border: "1px solid #e8e8e4" }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{LINK_ICON[ev.evidenceType] || "🔗"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{ev.title || ev.url}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {ev.evidenceType}
                    {ev.description ? `: ${ev.description}` : ""}
                    {ev.addedBy ? ` · Added by ${ev.addedBy}` : ""}
                  </div>
                </div>
                <a href={ev.url} target="_blank" rel="noreferrer" className="btn btn-sm">Open</a>
                {canEdit && <button className="btn btn-sm btn-danger" onClick={() => removeLink(ev)}>Remove</button>}
              </div>
            ))}
          </div>
        )}

        <FileUploadPanel activityId={activityId} canEdit={canEdit} profile={profile} />
      </div>

      {/* Comments — open to all roles including viewer */}
      <CommentsPanel docType="activity" docId={activityId} profile={profile} />
    </div>
  );
}
