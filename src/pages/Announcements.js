import React, { useState, useEffect } from "react";
import { listenAnnouncements, addAnnouncement, deleteAnnouncement, updateAnnouncement } from "../services/announcementService";

const PRIORITY_COLORS = { urgent: "#c0392b", normal: "#2d7a4f" };

export default function Announcements({ profile }) {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", priority: "normal" });
  const [toast, setToast] = useState("");

  const canPost   = ["admin", "coordinator"].includes(profile?.role);
  const canDelete = profile?.role === "admin";

  useEffect(() => listenAnnouncements(setAnnouncements), []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const post = async () => {
    if (!form.title.trim()) { alert("Title is required."); return; }
    await addAnnouncement({ ...form, createdBy: profile.name, createdByRole: profile.role, pinned: false });
    setForm({ title: "", body: "", priority: "normal" });
    setShowForm(false);
    showToast("Announcement posted.");
  };

  const pin = async (a) => { await updateAnnouncement(a.id, { pinned: !a.pinned }); };

  const del = async (a) => {
    if (!window.confirm("Delete this announcement?")) return;
    await deleteAnnouncement(a.id);
    showToast("Deleted.");
  };

  // Pinned items float to the top, the orderBy("createdAt","desc") ordering is preserved otherwise
  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Announcements</div>

      {canPost && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>+ Post announcement</button>
        </div>
      )}

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">New announcement</div>
          <div className="form-grid">
            <div className="field"><label>Title <span className="req">★</span></label>
              <input value={form.title} onChange={e => setF("title", e.target.value)} placeholder="What would you like to announce?" autoFocus />
            </div>
            <div className="field"><label>Priority</label>
              <select value={form.priority} onChange={e => setF("priority", e.target.value)}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Message</label>
            <textarea rows={4} value={form.body} onChange={e => setF("body", e.target.value)} placeholder="Details of the announcement..." />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={post}>Post</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="panel"><div className="empty">No announcements yet. {canPost ? "Post one above." : ""}</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map(a => {
            const color = PRIORITY_COLORS[a.priority] || "#4a9e6b";
            return (
              <div key={a.id} className="panel" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      {a.priority === "urgent" && (
                        <span style={{ background: "#c0392b", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 8px", letterSpacing: ".5px" }}>URGENT</span>
                      )}
                      {a.pinned && (
                        <span style={{ fontSize: 11, color: "#888" }}>📌 Pinned</span>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1c2b1e" }}>{a.title}</div>
                    </div>
                    {a.body && (
                      <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 8 }}>{a.body}</div>
                    )}
                    <div style={{ fontSize: 11, color: "#aaa" }}>
                      Posted by <strong style={{ color: "#888" }}>{a.createdBy}</strong>
                      {a.createdAt?.toDate && ` · ${a.createdAt.toDate().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
                    </div>
                  </div>
                  {canPost && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-sm" onClick={() => pin(a)}>{a.pinned ? "Unpin" : "Pin"}</button>
                      {canDelete && <button className="btn btn-sm btn-danger" onClick={() => del(a)}>✕</button>}
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
