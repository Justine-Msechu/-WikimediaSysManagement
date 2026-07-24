import React, { useState, useEffect } from "react";
import { listenDeadlines, addDeadline, updateDeadline, deleteDeadline, DEADLINE_TYPES } from "../services/deadlineService";
import RichTextEditor, { renderHtml } from "../components/RichTextEditor";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { listenSettings } from "../services/settingsService";
import { listenVolunteers } from "../services/volunteerService";
import { sendSMSBulk } from "../services/smsService";

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysUntil(date) {
  const diff = new Date(date).setHours(0,0,0,0) - new Date(todayStr()).setHours(0,0,0,0);
  return Math.round(diff / 86400000);
}

function urgencyStyle(date, done) {
  if (done) return { color: "#888", badge: "#e8e8e4", label: "Done" };
  const d = daysUntil(date);
  if (d < 0)  return { color: "#c0392b", badge: "#fde8e8", label: `${Math.abs(d)}d overdue` };
  if (d === 0)return { color: "#c0392b", badge: "#fde8e8", label: "Due today!" };
  if (d <= 7) return { color: "#d97706", badge: "#fff8e1", label: `${d}d left` };
  if (d <= 30)return { color: "#2563eb", badge: "#eff6ff", label: `${d}d left` };
  return       { color: "#2d7a4f", badge: "#e6f4ec", label: `${d}d left` };
}

function emptyDeadline() {
  return { title: "", date: "", type: DEADLINE_TYPES[0], description: "", done: false };
}

export default function Deadlines({ profile }) {
  const [deadlines,   setDeadlines]   = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [form,        setForm]        = useState(emptyDeadline());
  const [filter,      setFilter]      = useState("upcoming");
  const [toast,       setToast]       = useState("");
  const [settings,    setSettings]    = useState(null);
  const [volunteers,  setVolunteers]  = useState([]);
  const [smsSending,  setSmsSending]  = useState(null);

  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenDeadlines(setDeadlines);
    const u2 = listenSettings(setSettings);
    const u3 = listenVolunteers(setVolunteers);
    return () => { u1(); u2(); u3(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyDeadline()); setEditId(null); setShowForm(true); };
  const openEdit   = (d) => {
    setForm({ title: d.title, date: d.date, type: d.type, description: d.description || "", done: d.done || false });
    setEditId(d.id); setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) { alert("Title is required."); return; }
    if (!form.date)         { alert("Date is required."); return; }
    if (!editId) {
      const id = await addDeadline(form);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "deadlines", { targetId: id, recordTitle: form.title });
      showToast("Deadline added.");
    } else {
      await updateDeadline(editId, form);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "deadlines", { targetId: editId, recordTitle: form.title });
      showToast("Deadline updated.");
    }
    setShowForm(false);
  };

  const toggleDone = async (d) => {
    await updateDeadline(d.id, { done: !d.done });
    showToast(d.done ? "Marked as pending." : "Marked as done.");
  };

  const del = async (d) => {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    await deleteDeadline(d.id);
    showToast("Deleted.");
  };

  const sendReminder = async (d) => {
    if (!settings?.sms?.enabled) {
      alert("SMS is not configured. Go to Settings, SMS notifications to enable it.");
      return;
    }
    const phones = volunteers.filter(v => v.phone && v.isActive !== false).map(v => ({
      to: v.phone,
      message: `WikiKili reminder: "${d.title}" is due on ${d.date}. ${d.description ? d.description.slice(0, 60) : ""}`.trim(),
    }));
    if (!phones.length) { alert("No volunteers with phone numbers found."); return; }
    setSmsSending(d.id);
    try {
      await sendSMSBulk(settings.sms, phones);
      showToast(`Reminder SMS sent to ${phones.length} volunteer${phones.length > 1 ? "s" : ""}.`);
    } catch (err) {
      alert("SMS failed: " + (err.message || "Unknown error"));
    } finally {
      setSmsSending(null);
    }
  };

  const today = todayStr();
  const overdue  = deadlines.filter(d => !d.done && d.date < today);
  const upcoming = deadlines.filter(d => !d.done && d.date >= today);
  const done     = deadlines.filter(d => d.done);

  const visible = filter === "done" ? done : filter === "overdue" ? overdue : upcoming;

  const TAB_COUNTS = [
    { key: "upcoming", label: "Upcoming",   count: upcoming.length },
    { key: "overdue",  label: "Overdue",    count: overdue.length  },
    { key: "done",     label: "Done",        count: done.length    },
  ];

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Deadline tracker</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TAB_COUNTS.map(t => (
            <button key={t.key} className={`btn btn-sm ${filter === t.key ? "btn-primary" : ""}`} onClick={() => setFilter(t.key)}>
              {t.label}
              {t.count > 0 && (
                <span style={{ marginLeft: 5, background: filter === t.key ? "rgba(255,255,255,0.3)" : (t.key === "overdue" ? "#c0392b" : "#888"), color: "#fff", borderRadius: 10, padding: "0 6px", fontSize: 10 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {canEdit && <button className="btn btn-primary" onClick={openCreate}>+ Add deadline</button>}
      </div>

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit deadline" : "Add deadline"}</div>
          <div className="form-grid">
            <div className="field"><label>Title <span className="req">★</span></label>
              <input value={form.title} onChange={e => setF("title", e.target.value)} placeholder="e.g. Submit mid-term financial report" autoFocus />
            </div>
            <div className="field"><label>Date <span className="req">★</span></label>
              <input type="date" value={form.date} onChange={e => setF("date", e.target.value)} />
            </div>
            <div className="field"><label>Type</label>
              <select value={form.type} onChange={e => setF("type", e.target.value)}>
                {DEADLINE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Status</label>
              <select value={form.done ? "done" : "pending"} onChange={e => setF("done", e.target.value === "done")}>
                <option value="pending">Pending</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Notes</label>
            <RichTextEditor value={form.description} onChange={v => setF("description", v)} placeholder="Optional details or instructions..." rows={2} />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="panel"><div className="empty">
          {filter === "upcoming" ? "No upcoming deadlines. Add one above." : `No ${filter} deadlines.`}
        </div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(d => {
            const s = urgencyStyle(d.date, d.done);
            return (
              <div key={d.id} className="panel" style={{ borderLeft: `4px solid ${s.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ background: s.badge, color: s.color, fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 10px" }}>{s.label}</span>
                      <span style={{ background: "#f0f0ec", color: "#555", fontSize: 10, borderRadius: 10, padding: "2px 8px" }}>{d.type}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, textDecoration: d.done ? "line-through" : "none", color: d.done ? "#aaa" : "#1c2b1e" }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>Due: <strong>{d.date}</strong></div>
                    {d.description && <div style={{ fontSize: 12, color: "#666", marginTop: 6, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: renderHtml(d.description) }} />}
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                      {!d.done && (
                        <button
                          className="btn btn-sm"
                          disabled={smsSending === d.id}
                          title="Send SMS reminder to all active volunteers"
                          onClick={() => sendReminder(d)}
                        >
                          {smsSending === d.id ? "Sending…" : "SMS reminder"}
                        </button>
                      )}
                      <button className="btn btn-sm" onClick={() => toggleDone(d)}>{d.done ? "Reopen" : "Mark done"}</button>
                      <button className="btn btn-sm" onClick={() => openEdit(d)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(d)}>✕</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
