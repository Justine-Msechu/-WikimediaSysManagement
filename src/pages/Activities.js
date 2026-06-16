import React, { useState, useEffect } from "react";
import { listenActivities, addActivity, updateActivity, deleteActivity, ACTIVITY_TYPES, SESSION_TYPES } from "../services/activityService";
import { listenPrograms } from "../services/programService";
import { listenSettings } from "../services/settingsService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

function today() { return new Date().toISOString().slice(0, 10); }

function emptyActivity(programs) {
  return {
    programId: programs[0]?.id || "",
    name: "", type: ACTIVITY_TYPES[0], date: today(), location: "", reportedBy: "",
    participants: "", women: "", newEditors: "", youth: "", pwd: "",
    created: "", improved: "", commons: "", wikidata: "",
    summary: "", challenges: "", lessons: "", stories: "", nextSteps: "",
    sessionType: SESSION_TYPES[0], link: "", wikiEventUrl: "",
  };
}

export default function Activities({ profile, goPage }) {
  const [activities, setActivities] = useState([]);
  const [programs,   setPrograms]   = useState([]);
  const [settings,   setSettings]   = useState(null);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState({});
  const [filter,     setFilter]     = useState("");
  const [toast,      setToast]      = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenActivities(setActivities);
    const u2 = listenPrograms(setPrograms);
    const u3 = listenSettings(setSettings);
    return () => { u1(); u2(); u3(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const n = (v) => v === "" ? null : Number(v);

  const openCreate = () => { setForm(emptyActivity(programs)); setEditId(null); setShowForm(true); };
  const openEdit   = (a) => {
    setForm({
      programId: a.programId || "", name: a.name, type: a.type, date: a.date,
      location: a.location || "", reportedBy: a.reportedBy || "",
      participants: a.participants ?? "", women: a.women ?? "", newEditors: a.newEditors ?? "",
      youth: a.youth ?? "", pwd: a.pwd ?? "", created: a.created ?? "", improved: a.improved ?? "",
      commons: a.commons ?? "", wikidata: a.wikidata ?? "", summary: a.summary || "",
      challenges: a.challenges || "", lessons: a.lessons || "", stories: a.stories || "",
      nextSteps: a.nextSteps || "", sessionType: a.sessionType || SESSION_TYPES[0],
      link: a.link || "", wikiEventUrl: a.wikiEventUrl || "",
    });
    setEditId(a.id); setShowForm(true);
  };

  const save = async () => {
    if (!form.name?.trim()) { alert("Activity name is required."); return; }
    if (!form.date)         { alert("Date is required."); return; }
    const data = {
      ...form,
      participants: n(form.participants), women: n(form.women), newEditors: n(form.newEditors),
      youth: n(form.youth), pwd: n(form.pwd), created: n(form.created),
      improved: n(form.improved), commons: n(form.commons), wikidata: n(form.wikidata),
    };
    if (!editId) {
      const id = await addActivity(data);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "activities", { targetId: id, recordTitle: form.name });
      showToast("Activity logged.");
    } else {
      await updateActivity(editId, data);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "activities", { targetId: editId, recordTitle: form.name });
      showToast("Activity updated.");
    }
    setShowForm(false);
  };

  const del = async (a) => {
    if (!window.confirm(`Delete "${a.name}"?`)) return;
    await deleteActivity(a.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "activities", { targetId: a.id, recordTitle: a.name });
    showToast("Activity deleted.");
  };

  const filtered = activities.filter(a => !filter || a.name?.toLowerCase().includes(filter.toLowerCase()) || a.type?.toLowerCase().includes(filter.toLowerCase()));

  const programName = (id) => programs.find(p => p.id === id)?.name || "—";

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Activities</div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search activities…" style={{ flex: 1, minWidth: 200, fontSize: 13 }} />
        {canEdit && <button className="btn btn-primary" onClick={openCreate}>+ Log activity</button>}
      </div>

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit activity" : "Log activity"}</div>

          <div className="section-label" style={{ marginBottom: 8 }}>Basic information</div>
          <div className="form-grid">
            <div className="field"><label>Activity name <span className="req">★</span></label><input value={form.name || ""} onChange={e => setF("name", e.target.value)} placeholder="e.g. Edit-a-thon – Women in Science" /></div>
            <div className="field"><label>Program</label>
              <select value={form.programId || ""} onChange={e => setF("programId", e.target.value)}>
                <option value="">— No program —</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Type</label>
              <select value={form.type || ""} onChange={e => setF("type", e.target.value)}>
                {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Session type</label>
              <select value={form.sessionType || ""} onChange={e => setF("sessionType", e.target.value)}>
                {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Date <span className="req">★</span></label><input type="date" value={form.date || ""} onChange={e => setF("date", e.target.value)} /></div>
            <div className="field"><label>Location</label><input value={form.location || ""} onChange={e => setF("location", e.target.value)} placeholder="Town, District" /></div>
            <div className="field"><label>Reported by</label><input value={form.reportedBy || ""} onChange={e => setF("reportedBy", e.target.value)} placeholder="Team member name" /></div>
            <div className="field"><label>Report link</label><input value={form.link || ""} onChange={e => setF("link", e.target.value)} placeholder="Meta-Wiki page URL" /></div>
            <div className="field"><label>WEP event URL</label><input value={form.wikiEventUrl || ""} onChange={e => setF("wikiEventUrl", e.target.value)} placeholder="Wikipedia Event Platform URL" /></div>
          </div>

          <div className="section-label" style={{ margin: "16px 0 8px" }}>Participation</div>
          <div className="form-grid">
            {[["participants","Total participants"],["women","Women"],["newEditors","New editors"],["youth","Youth (≤25)"],["pwd","Persons with disabilities"]].map(([k, label]) => (
              <div key={k} className="field"><label>{label}</label><input type="number" min="0" value={form[k] ?? ""} onChange={e => setF(k, e.target.value)} placeholder="0" /></div>
            ))}
          </div>

          <div className="section-label" style={{ margin: "16px 0 8px" }}>Content contributions</div>
          <div className="form-grid">
            {[["created","Articles created"],["improved","Articles improved"],["commons","Commons uploads"],["wikidata","Wikidata items"]].map(([k, label]) => (
              <div key={k} className="field"><label>{label}</label><input type="number" min="0" value={form[k] ?? ""} onChange={e => setF(k, e.target.value)} placeholder="0" /></div>
            ))}
          </div>

          <div className="section-label" style={{ margin: "16px 0 8px" }}>Narrative</div>
          {[["summary","Activity summary"],["challenges","Challenges faced"],["lessons","Lessons learned"],["stories","Impact stories"],["nextSteps","Next steps"]].map(([k, label]) => (
            <div key={k} className="field"><label>{label}</label><textarea rows={3} value={form[k] || ""} onChange={e => setF(k, e.target.value)} placeholder={label + "…"} /></div>
          ))}

          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: 0 }}>
        {filtered.length === 0 ? <div className="empty">{activities.length === 0 ? "No activities yet." : "No results for your search."}</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Date</th><th>Activity</th><th>Program</th><th>Type</th><th>Participants</th><th>Women</th><th>New editors</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>{a.date}</td>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td style={{ fontSize: 12, color: "#666" }}>{programName(a.programId)}</td>
                    <td style={{ fontSize: 12 }}>{a.type}</td>
                    <td style={{ textAlign: "center" }}>{a.participants ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>{a.women ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>{a.newEditors ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => goPage("activity-detail", a.id)}>View</button>
                        {canEdit && <button className="btn btn-sm" onClick={() => openEdit(a)}>Edit</button>}
                        {canEdit && <button className="btn btn-sm btn-danger" onClick={() => del(a)}>✕</button>}
                      </div>
                    </td>
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
