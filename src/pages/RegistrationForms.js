import React, { useState, useEffect, useMemo } from "react";
import {
  listenForms, addForm, updateForm, deleteForm,
  listenRegistrations, updateAttendance,
} from "../services/registrationService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import logo from "../assets/logo.png";

const EXPENSE_TYPES = [
  "Transport", "Food & refreshments", "Stipend / allowance",
  "Venue hire", "Merchandise & prizes", "Other",
];

function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const STATUS_BADGE = {
  draft:  { label: "Draft",  cls: "badge-gray" },
  open:   { label: "Open",   cls: "badge-green" },
  closed: { label: "Closed", cls: "badge-red" },
};

const ATTENDANCE_OPTIONS = ["present", "absent", "excused"];
const ATTENDANCE_BADGE   = { present: "badge-green", absent: "badge-red", excused: "badge-gray" };

function emptyForm() {
  return {
    title: "", description: "", date: "", location: "",
    wikiEventUrl: "", status: "draft",
  };
}

export default function RegistrationForms({ profile }) {
  const [forms,        setForms]        = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [registrations,setRegistrations]= useState([]);
  const [showBuilder,  setShowBuilder]  = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [formData,     setFormData]     = useState(emptyForm());
  const [copiedLink,   setCopiedLink]   = useState(false);
  const [copiedUsernames, setCopiedUsernames] = useState(false);
  const [expenseType,  setExpenseType]  = useState(EXPENSE_TYPES[0]);
  const [toast,        setToast]        = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => { return listenForms(setForms); }, []);

  useEffect(() => {
    if (!selectedForm) { setRegistrations([]); return; }
    return listenRegistrations(selectedForm.id, setRegistrations);
  }, [selectedForm?.id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  const openCreate = () => { setFormData(emptyForm()); setEditId(null); setShowBuilder(true); };
  const openEdit   = (f) => { setFormData({ title: f.title, description: f.description || "", date: f.date || "", location: f.location || "", wikiEventUrl: f.wikiEventUrl || "", status: f.status }); setEditId(f.id); setShowBuilder(true); };

  const saveForm = async () => {
    if (!formData.title.trim()) { alert("Form title is required."); return; }
    if (!editId) {
      const id = await addForm(formData);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "registrationForms", { targetId: id, recordTitle: formData.title });
      showToast("Form created.");
    } else {
      await updateForm(editId, formData);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "registrationForms", { targetId: editId, recordTitle: formData.title });
      showToast("Form updated.");
    }
    setShowBuilder(false);
  };

  const delForm = async (f) => {
    if (!window.confirm(`Delete form "${f.title}"? Existing registrations will also be deleted.`)) return;
    await deleteForm(f.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "registrationForms", { targetId: f.id, recordTitle: f.title });
    if (selectedForm?.id === f.id) setSelectedForm(null);
    showToast("Form deleted.");
  };

  const toggleStatus = async (f, status) => {
    await updateForm(f.id, { status });
    await addAudit(profile, AUDIT_ACTIONS.UPDATE, "registrationForms", { targetId: f.id, recordTitle: f.title, details: `Status → ${status}` });
    showToast(`Form ${status}.`);
  };

  const markAttendance = async (regId, status) => {
    await updateAttendance(regId, status);
  };

  const publicUrl = (formId) => `${window.location.origin}${window.location.pathname}?form=${formId}`;

  const copyLink = (formId) => {
    navigator.clipboard.writeText(publicUrl(formId));
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  };

  const wikiUsernames = useMemo(() => registrations.filter(r => r.wikimediaUsername).map(r => r.wikimediaUsername), [registrations]);

  const copyUsernames = () => {
    navigator.clipboard.writeText(wikiUsernames.join("\n"));
    setCopiedUsernames(true); setTimeout(() => setCopiedUsernames(false), 2000);
  };

  const exportCSV = () => {
    const header = "Name,Wikipedia username,Email,Phone,Age,Skills,Registered at,Attendance";
    const rows   = registrations.map(r => [r.name, r.wikimediaUsername, r.email, r.phone, r.age, r.skills, r.createdAt?.toDate ? r.createdAt.toDate().toISOString() : "", r.attendance || ""].map(v => `"${(v || "").replace(/"/g, '""')}"`).join(","));
    const csv    = [header, ...rows].join("\n");
    const blob   = new Blob([csv], { type: "text/csv" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url; a.download = `registrations-${selectedForm.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const withWiki = registrations.filter(r => r.wikimediaUsername).length;

  const printSheet = () => {
    const MIN_ROWS = Math.max(30, registrations.length);
    const rows = [...registrations];
    while (rows.length < MIN_ROWS) rows.push(null);
    const logoUrl = window.location.origin + logo;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escHtml(selectedForm.title)} — Attendance Sheet</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1c2b1e;padding:24px}
.no-print{margin-bottom:18px}
.btn{padding:8px 22px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:700;margin-right:8px}
.bp{background:#2d7a4f;color:#fff}.bc{background:#888;color:#fff}
.hdr{display:flex;align-items:center;gap:16px;margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #1c2b1e}
.hdr img{width:60px;height:60px;object-fit:contain}
.hdr h1{font-size:17px;font-weight:700;margin-bottom:2px}
.hdr p{font-size:11px;color:#555}
.info{width:auto;margin-bottom:18px;border-collapse:collapse}
.info td{padding:4px 8px;font-size:12px;border-bottom:1px dotted #ddd}
.info td:first-child{font-weight:700;width:160px;color:#333}
table.att{width:100%;border-collapse:collapse}
table.att th{background:#1c2b1e;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.4px}
table.att th.c{text-align:center;width:36px}
table.att th.v{width:110px}
table.att th.s{width:140px}
table.att td{border:1px solid #bbb;padding:5px 10px;height:30px;font-size:12px}
table.att td.c{text-align:center;background:#f5f5f3;color:#777;font-weight:600;border:1px solid #bbb}
table.att tr:nth-child(even) td{background:#fafaf8}
table.att tr:nth-child(even) td.c{background:#f0f0ee}
.footer{margin-top:36px;display:flex;gap:80px}
.fl{display:flex;flex-direction:column;gap:6px}
.fl span{font-weight:700;font-size:12px}
.fl div{border-bottom:1px solid #444;width:220px;margin-top:18px}
@media print{.no-print{display:none!important}body{padding:12px}}
</style>
</head>
<body>
<div class="no-print">
  <button class="btn bp" onclick="window.print()">&#128424; Print</button>
  <button class="btn bc" onclick="window.close()">Close</button>
</div>

<div class="hdr">
  <img src="${logoUrl}" alt="Wikimedia Community Kilimanjaro logo"/>
  <div>
    <h1>Wikimedia Community Kilimanjaro</h1>
    <p>Participants Attendance Sheet</p>
  </div>
</div>

<table class="info">
  <tr><td>User Group</td><td>Wikimedia Community Kilimanjaro</td></tr>
  <tr><td>Event</td><td>${escHtml(selectedForm.title)}</td></tr>
  <tr><td>Date</td><td>${escHtml(selectedForm.date || "")}</td></tr>
  <tr><td>Location</td><td>${escHtml(selectedForm.location || "")}</td></tr>
  <tr><td>Currency</td><td>TZS</td></tr>
  <tr><td>Type of expense</td><td>${escHtml(expenseType)}</td></tr>
</table>

<table class="att">
  <thead>
    <tr>
      <th class="c">#</th>
      <th>Full Name</th>
      <th>Wikipedia Username</th>
      <th class="v">Value (TZS)</th>
      <th class="s">Signature</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((r, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${escHtml(r?.name || "")}</td>
      <td>${escHtml(r?.wikimediaUsername || "")}</td>
      <td class="v"></td>
      <td class="s"></td>
    </tr>`).join("")}
  </tbody>
</table>

<div class="footer">
  <div class="fl"><span>Organiser</span><div></div></div>
  <div class="fl"><span>Signature</span><div></div></div>
</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Event registration forms</div>

      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={openCreate}>+ New form</button>
        </div>
      )}

      {showBuilder && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit form" : "New registration form"}</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>Full name and Wikipedia username are always collected.</div>
          <div className="form-grid">
            <div className="field"><label>Form title <span className="req">★</span></label><input value={formData.title} onChange={e => setF("title", e.target.value)} placeholder="e.g. Wiki Women Workshop — July 2026" /></div>
            <div className="field"><label>Event date</label><input type="date" value={formData.date} onChange={e => setF("date", e.target.value)} /></div>
            <div className="field"><label>Location</label><input value={formData.location} onChange={e => setF("location", e.target.value)} placeholder="Town, venue" /></div>
            <div className="field"><label>Wikipedia Event Platform URL</label><input value={formData.wikiEventUrl} onChange={e => setF("wikiEventUrl", e.target.value)} placeholder="https://www.mediawiki.org/wiki/…" /></div>
          </div>
          <div className="field"><label>Description / instructions for participants</label><textarea rows={3} value={formData.description} onChange={e => setF("description", e.target.value)} placeholder="Tell participants what to expect at this event" /></div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={saveForm}>Save form</button>
            <button className="btn" onClick={() => setShowBuilder(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selectedForm ? "280px 1fr" : "1fr", gap: 20 }}>
        {/* Form list */}
        <div>
          {forms.length === 0 ? <div className="panel"><div className="empty">No forms yet.</div></div> : forms.map(f => {
            const badge = STATUS_BADGE[f.status] || STATUS_BADGE.draft;
            return (
              <div key={f.id} onClick={() => setSelectedForm(f)} className="panel" style={{ cursor: "pointer", borderLeft: selectedForm?.id === f.id ? "4px solid #4a9e6b" : "4px solid transparent", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.title}</div>
                    {f.date && <div style={{ fontSize: 11, color: "#888" }}>{f.date}</div>}
                  </div>
                  <span className={`badge ${badge.cls}`} style={{ fontSize: 10 }}>{badge.label}</span>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
                    {f.status === "draft"  && <button className="btn btn-sm" onClick={() => toggleStatus(f, "open")}>Publish</button>}
                    {f.status === "open"   && <button className="btn btn-sm" onClick={() => toggleStatus(f, "closed")}>Close</button>}
                    {f.status === "closed" && <button className="btn btn-sm" onClick={() => toggleStatus(f, "open")}>Reopen</button>}
                    <button className="btn btn-sm" onClick={() => openEdit(f)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => delForm(f)}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Form detail */}
        {selectedForm && (
          <div>
            <div className="panel" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div className="panel-title">{selectedForm.title}</div>
                  {selectedForm.description && <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>{selectedForm.description}</div>}
                </div>
                <button className="btn btn-sm" onClick={() => setSelectedForm(null)}>✕ Close</button>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                {[["Registrations", registrations.length], ["With Wikipedia username", withWiki], ["Attended", registrations.filter(r => r.attendance === "present").length]].map(([l, v]) => (
                  <div key={l} style={{ textAlign: "center", minWidth: 80 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#2d7a4f" }}>{v}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Share panel */}
              <div style={{ background: "#f0f8f3", border: "1px solid #b7e0c8", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Share with participants</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input readOnly value={publicUrl(selectedForm.id)} style={{ flex: 1, fontSize: 12, background: "#fff" }} onFocus={e => e.target.select()} />
                  <button className="btn btn-primary btn-sm" onClick={() => copyLink(selectedForm.id)}>{copiedLink ? "Copied!" : "Copy link"}</button>
                </div>
                {selectedForm.wikiEventUrl && (
                  <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>Wikipedia Event Platform: <a href={selectedForm.wikiEventUrl} target="_blank" rel="noreferrer" style={{ color: "#4a9e6b" }}>{selectedForm.wikiEventUrl}</a> — shown on confirmation screen after registering</div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn btn-sm" onClick={exportCSV}>Export CSV</button>
                {wikiUsernames.length > 0 && (
                  <button className="btn btn-sm" onClick={copyUsernames}>
                    {copiedUsernames ? "Copied!" : `Copy Wikipedia usernames (${wikiUsernames.length})`}
                  </button>
                )}
                <select value={expenseType} onChange={e => setExpenseType(e.target.value)} style={{ fontSize: 12 }}>
                  {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <button className="btn btn-sm btn-primary" onClick={printSheet}>🖨 Print attendance sheet</button>
              </div>
            </div>

            {/* Registrations table */}
            <div className="panel" style={{ padding: 0 }}>
              {registrations.length === 0 ? <div className="empty">No registrations yet. Share the link with participants.</div> : (
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead><tr><th>Name</th><th>Wikipedia username</th><th>Email</th><th>Phone</th><th>Age</th><th>Attendance</th></tr></thead>
                    <tbody>
                      {registrations.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 500 }}>{r.name}</td>
                          <td>{r.wikimediaUsername ? <a href={`https://en.wikipedia.org/wiki/User:${encodeURIComponent(r.wikimediaUsername)}`} target="_blank" rel="noreferrer" style={{ color: "#4a9e6b" }}>{r.wikimediaUsername}</a> : "—"}</td>
                          <td style={{ fontSize: 12 }}>{r.email || "—"}</td>
                          <td style={{ fontSize: 12 }}>{r.phone || "—"}</td>
                          <td style={{ fontSize: 12, textAlign: "center" }}>{r.age || "—"}</td>
                          <td>
                            {canEdit ? (
                              <select value={r.attendance || ""} onChange={e => markAttendance(r.id, e.target.value)} style={{ fontSize: 12 }}>
                                <option value="">Not marked</option>
                                {ATTENDANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              r.attendance ? <span className={`badge ${ATTENDANCE_BADGE[r.attendance] || "badge-gray"}`}>{r.attendance}</span> : "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
