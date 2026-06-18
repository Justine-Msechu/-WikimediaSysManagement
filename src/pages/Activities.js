import React, { useState, useEffect } from "react";
import { listenActivities, addActivity, updateActivity, deleteActivity, getActivity, ACTIVITY_TYPES, SESSION_TYPES } from "../services/activityService";
import { listenPrograms } from "../services/programService";
import { listenSettings } from "../services/settingsService";
import { listenUsers } from "../services/userService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { notifyAssignment } from "../services/notificationService";
import { listenTemplates, addTemplate, deleteTemplate } from "../services/activityTemplateService";

function today() { return new Date().toISOString().slice(0, 10); }

function emptyActivity(programs) {
  return {
    programId: programs[0]?.id || "",
    name: "", type: ACTIVITY_TYPES[0], date: today(), location: "", reportedBy: "",
    assignedTo: "",
    participants: "", women: "", newEditors: "", youth: "", pwd: "",
    created: "", improved: "", commons: "", wikidata: "",
    summary: "", challenges: "", lessons: "", stories: "", nextSteps: "",
    sessionType: SESSION_TYPES[0], link: "", wikiEventUrl: "",
  };
}

export default function Activities({ profile, goPage }) {
  const [activities,   setActivities]   = useState([]);
  const [programs,     setPrograms]     = useState([]);
  const [settings,     setSettings]     = useState(null);
  const [users,        setUsers]        = useState([]);
  const [templates,    setTemplates]    = useState([]);
  const [showForm,     setShowForm]     = useState(false);
  const [showTpls,     setShowTpls]     = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [editVersion,  setEditVersion]  = useState(null);
  const [form,         setForm]         = useState({});
  const [filter,       setFilter]       = useState("");
  const [myTasksOnly,  setMyTasksOnly]  = useState(false);
  const [toast,        setToast]        = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenActivities(setActivities);
    const u2 = listenPrograms(setPrograms);
    const u3 = listenSettings(setSettings);
    const u4 = listenUsers(setUsers);
    const u5 = listenTemplates(setTemplates);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const n = (v) => v === "" ? null : Number(v);

  const coordinators    = users.filter(u => ["admin", "coordinator"].includes(u.role) && u.isActive !== false);
  const approvedPrograms = programs.filter(p => p.status === "approved");
  const hasApproved      = approvedPrograms.length > 0;

  const openCreate = () => {
    setForm({ ...emptyActivity(approvedPrograms), reportedBy: profile?.name || "", assignedTo: profile?.name || "" });
    setEditId(null);
    setEditVersion(null);
    setShowForm(true);
  };

  const openEdit = (a) => {
    setForm({
      programId: a.programId || "", name: a.name, type: a.type, date: a.date,
      location: a.location || "", reportedBy: a.reportedBy || "",
      assignedTo: a.assignedTo || "",
      participants: a.participants ?? "", women: a.women ?? "", newEditors: a.newEditors ?? "",
      youth: a.youth ?? "", pwd: a.pwd ?? "", created: a.created ?? "", improved: a.improved ?? "",
      commons: a.commons ?? "", wikidata: a.wikidata ?? "", summary: a.summary || "",
      challenges: a.challenges || "", lessons: a.lessons || "", stories: a.stories || "",
      nextSteps: a.nextSteps || "", sessionType: a.sessionType || SESSION_TYPES[0],
      link: a.link || "", wikiEventUrl: a.wikiEventUrl || "",
    });
    setEditVersion(a.updatedAt);
    setEditId(a.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name?.trim()) { alert("Activity name is required."); return; }
    if (!form.date)         { alert("Date is required."); return; }

    // Conflict protection: check if someone else saved while we were editing
    if (editId && editVersion) {
      try {
        const current = await getActivity(editId);
        const savedMs  = current?.updatedAt?.toMillis?.() || 0;
        const loadedMs = editVersion?.toMillis?.()        || 0;
        if (savedMs > loadedMs) {
          const go = window.confirm(
            `This activity was modified by ${current.lastEditedBy || "another user"} while you were editing.\n\nSave anyway and overwrite their changes?`
          );
          if (!go) return;
        }
      } catch (_) { /* skip check if fetch fails */ }
    }

    const data = {
      ...form,
      participants: n(form.participants), women: n(form.women), newEditors: n(form.newEditors),
      youth: n(form.youth), pwd: n(form.pwd), created: n(form.created),
      improved: n(form.improved), commons: n(form.commons), wikidata: n(form.wikidata),
      lastEditedBy: profile?.name || "",
    };

    if (!editId) {
      const id = await addActivity(data);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "activities", { targetId: id, recordTitle: form.name });
      // Notify the assigned person if they are not the one creating the activity
      if (form.assignedTo && form.assignedTo !== profile?.name) {
        notifyAssignment({ assignedTo: form.assignedTo, activityName: form.name, assignedBy: profile?.name || "Admin" }).catch(() => {});
      }
      showToast("Activity logged.");
    } else {
      const prev = activities.find(a => a.id === editId);
      await updateActivity(editId, data);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "activities", { targetId: editId, recordTitle: form.name });
      // Notify if the assignee changed to someone other than the editor
      if (form.assignedTo && form.assignedTo !== prev?.assignedTo && form.assignedTo !== profile?.name) {
        notifyAssignment({ assignedTo: form.assignedTo, activityName: form.name, assignedBy: profile?.name || "Admin" }).catch(() => {});
      }
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

  const saveAsTemplate = async () => {
    const tplName = window.prompt("Template name:", form.name || "");
    if (!tplName?.trim()) return;
    await addTemplate({
      name: tplName.trim(),
      type: form.type, sessionType: form.sessionType,
      location: form.location || "",
      summary: form.summary || "", challenges: form.challenges || "",
      lessons: form.lessons || "", stories: form.stories || "",
      nextSteps: form.nextSteps || "",
    });
    showToast("Template saved.");
  };

  const applyTemplate = (tpl) => {
    setForm(f => ({
      ...f,
      type: tpl.type || f.type,
      sessionType: tpl.sessionType || f.sessionType,
      location: tpl.location || f.location,
      summary: tpl.summary || f.summary,
      challenges: tpl.challenges || f.challenges,
      lessons: tpl.lessons || f.lessons,
      stories: tpl.stories || f.stories,
      nextSteps: tpl.nextSteps || f.nextSteps,
    }));
    setShowTpls(false);
    setShowForm(true);
    showToast(`Template "${tpl.name}" applied.`);
  };

  const filtered = activities.filter(a => {
    const matchSearch = !filter ||
      a.name?.toLowerCase().includes(filter.toLowerCase()) ||
      a.type?.toLowerCase().includes(filter.toLowerCase());
    const matchTask = !myTasksOnly || a.assignedTo === profile?.name;
    return matchSearch && matchTask;
  });

  const myTaskCount = activities.filter(a => a.assignedTo === profile?.name).length;
  const programName = (id) => programs.find(p => p.id === id)?.name || "";

  const exportCSV = () => {
    const headers = ["Date", "Activity name", "Type", "Program", "Assigned to", "Location", "Participants", "Women", "New editors", "Youth", "PWD", "Articles created", "Articles improved", "Commons", "Wikidata"];
    const rows = filtered.map(a => [
      a.date, a.name, a.type, programName(a.programId), a.assignedTo || "",
      a.location || "", a.participants ?? "", a.women ?? "", a.newEditors ?? "",
      a.youth ?? "", a.pwd ?? "", a.created ?? "", a.improved ?? "", a.commons ?? "", a.wikidata ?? "",
    ].map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `activities-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>
          {toast}
        </div>
      )}
      <div className="page-title">Activities</div>

      {/* Warn if no approved programs exist yet */}
      {canEdit && !hasApproved && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          No approved programs yet. Activities must belong to an approved program. Go to <strong>Programs</strong>, add budget items, submit for review, and get it approved before logging activities.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search activities…" style={{ flex: 1, minWidth: 200, fontSize: 13 }} />
        <button className="btn btn-sm" onClick={exportCSV} title="Export visible activities to CSV">Export CSV</button>
        {canEdit && <button className="btn btn-sm" onClick={() => { setShowTpls(s => !s); setShowForm(false); }} title="Load or manage activity templates">Templates{templates.length > 0 ? ` (${templates.length})` : ""}</button>}
        <button
          className={`btn btn-sm ${myTasksOnly ? "btn-primary" : ""}`}
          onClick={() => setMyTasksOnly(v => !v)}
          title="Show only activities assigned to you"
        >
          My tasks {myTaskCount > 0 && <span style={{ marginLeft: 4, background: myTasksOnly ? "rgba(255,255,255,0.3)" : "#2d7a4f", color: "#fff", borderRadius: 10, padding: "0 6px", fontSize: 10 }}>{myTaskCount}</span>}
        </button>
        {canEdit && <button className="btn btn-primary" onClick={openCreate} disabled={!hasApproved} title={!hasApproved ? "No approved programs — approve a program first" : ""}>+ Log activity</button>}
      </div>

      {showTpls && (
        <div className="panel" style={{ border: "1px solid #e8e8e4", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Activity templates</div>
            <button className="btn btn-sm" onClick={() => setShowTpls(false)}>Close</button>
          </div>
          {templates.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 13 }}>No templates yet. Open the form, fill in the narrative or type/location fields, then click "Save as template".</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f9f9f7", borderRadius: 7, border: "1px solid #e8e8e4" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{[t.type, t.sessionType, t.location].filter(Boolean).join(" · ")}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => { openCreate(); applyTemplate(t); }}>Use</button>
                  <button className="btn btn-sm btn-danger" onClick={async () => { if (window.confirm(`Delete template "${t.name}"?`)) { await deleteTemplate(t.id); showToast("Template deleted."); } }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit activity" : "Log activity"}</div>

          <div className="section-label" style={{ marginBottom: 8 }}>Basic information</div>
          <div className="form-grid">
            <div className="field">
              <label>Activity name <span className="req">★</span></label>
              <input value={form.name || ""} onChange={e => setF("name", e.target.value)} placeholder="e.g. Edit-a-thon Women in Science" />
            </div>
            <div className="field">
              <label>Program</label>
              <select value={form.programId || ""} onChange={e => setF("programId", e.target.value)}>
                <option value="">(No program — general/admin task)</option>
                {approvedPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Assigned to</label>
              <select value={form.assignedTo || ""} onChange={e => setF("assignedTo", e.target.value)}>
                <option value="">(Unassigned)</option>
                {coordinators.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Type</label>
              <select value={form.type || ""} onChange={e => setF("type", e.target.value)}>
                {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Session type</label>
              <select value={form.sessionType || ""} onChange={e => setF("sessionType", e.target.value)}>
                {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date <span className="req">★</span></label>
              <input type="date" value={form.date || ""} onChange={e => setF("date", e.target.value)} />
            </div>
            <div className="field">
              <label>Location</label>
              <input value={form.location || ""} onChange={e => setF("location", e.target.value)} placeholder="Town, District" />
            </div>
            <div className="field">
              <label>Reported by</label>
              <input value={form.reportedBy || ""} onChange={e => setF("reportedBy", e.target.value)} placeholder="Team member name" />
            </div>
            <div className="field">
              <label>Report link</label>
              <input value={form.link || ""} onChange={e => setF("link", e.target.value)} placeholder="Meta-Wiki page URL" />
            </div>
            <div className="field">
              <label>WEP event URL</label>
              <input value={form.wikiEventUrl || ""} onChange={e => setF("wikiEventUrl", e.target.value)} placeholder="Wikipedia Event Platform URL" />
            </div>
          </div>

          <div className="section-label" style={{ margin: "16px 0 8px" }}>Participation</div>
          <div className="form-grid">
            {[["participants","Total participants"],["women","Women"],["newEditors","New editors"],["youth","Youth (≤25)"],["pwd","Persons with disabilities"]].map(([k, label]) => (
              <div key={k} className="field">
                <label>{label}</label>
                <input type="number" min="0" value={form[k] ?? ""} onChange={e => setF(k, e.target.value)} placeholder="0" />
              </div>
            ))}
          </div>

          <div className="section-label" style={{ margin: "16px 0 8px" }}>Content contributions</div>
          <div className="form-grid">
            {[["created","Articles created"],["improved","Articles improved"],["commons","Commons uploads"],["wikidata","Wikidata items"]].map(([k, label]) => (
              <div key={k} className="field">
                <label>{label}</label>
                <input type="number" min="0" value={form[k] ?? ""} onChange={e => setF(k, e.target.value)} placeholder="0" />
              </div>
            ))}
          </div>

          <div className="section-label" style={{ margin: "16px 0 8px" }}>Narrative</div>
          {[["summary","Activity summary"],["challenges","Challenges faced"],["lessons","Lessons learned"],["stories","Impact stories"],["nextSteps","Next steps"]].map(([k, label]) => (
            <div key={k} className="field">
              <label>{label}</label>
              <textarea rows={3} value={form[k] || ""} onChange={e => setF(k, e.target.value)} placeholder={label + "…"} />
            </div>
          ))}

          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={saveAsTemplate} title="Save current form values as a reusable template">Save as template</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty">
            {myTasksOnly ? "No activities assigned to you." : activities.length === 0 ? "No activities yet." : "No results for your search."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activity</th>
                  <th>Assigned to</th>
                  <th>Program</th>
                  <th>Type</th>
                  <th>Participants</th>
                  <th>Women</th>
                  <th>New editors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>{a.date}</td>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td style={{ fontSize: 12 }}>
                      {a.assignedTo
                        ? <span style={{ background: a.assignedTo === profile?.name ? "#e6f4ec" : "#f5f4f0", color: a.assignedTo === profile?.name ? "#2d7a4f" : "#555", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 500 }}>{a.assignedTo}</span>
                        : <span style={{ color: "#bbb", fontSize: 11 }}>Unassigned</span>}
                    </td>
                    <td style={{ fontSize: 12, color: "#666" }}>{programName(a.programId)}</td>
                    <td style={{ fontSize: 12 }}>{a.type}</td>
                    <td style={{ textAlign: "center" }}>{a.participants ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{a.women ?? ""}</td>
                    <td style={{ textAlign: "center" }}>{a.newEditors ?? ""}</td>
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
