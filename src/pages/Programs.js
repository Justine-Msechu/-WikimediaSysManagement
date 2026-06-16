import React, { useState, useEffect } from "react";
import { listenPrograms, addProgram, updateProgram, deleteProgram, DEFAULT_PROGRAMS, PROGRAM_CATEGORIES } from "../services/programService";
import { listenActivities } from "../services/activityService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

const PROGRAM_COLORS = ["#2d7a4f", "#2563eb", "#9333ea", "#d97706", "#0891b2", "#c0392b", "#059669", "#7c3aed", "#db2777"];

function emptyProgram() {
  return { name: "", category: "Content Creation", description: "", plannedSessions: 1, color: PROGRAM_COLORS[0] };
}

export default function Programs({ profile }) {
  const [programs,    setPrograms]    = useState([]);
  const [activities,  setActivities]  = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [form,        setForm]        = useState(emptyProgram());
  const [toast,       setToast]       = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenPrograms(setPrograms);
    const u2 = listenActivities(setActivities);
    return () => { u1(); u2(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyProgram()); setEditId(null); setShowForm(true); };
  const openEdit   = (p) => { setForm({ name: p.name, category: p.category, description: p.description || "", plannedSessions: p.plannedSessions || 1, color: p.color || PROGRAM_COLORS[0] }); setEditId(p.id); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) { alert("Program name is required."); return; }
    if (!editId) {
      const id = await addProgram(form);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "programs", { targetId: id, recordTitle: form.name });
      showToast("Program created.");
    } else {
      await updateProgram(editId, form);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "programs", { targetId: editId, recordTitle: form.name });
      showToast("Program updated.");
    }
    setShowForm(false);
  };

  const del = async (p) => {
    if (!window.confirm(`Delete program "${p.name}"? Activities linked to it will remain.`)) return;
    await deleteProgram(p.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "programs", { targetId: p.id, recordTitle: p.name });
    showToast("Program deleted.");
  };

  const statsFor = (pid) => {
    const acts = activities.filter(a => a.programId === pid);
    return {
      sessions:     acts.length,
      participants: acts.reduce((s, a) => s + (a.participants || 0), 0),
      women:        acts.reduce((s, a) => s + (a.women || 0), 0),
      newEditors:   acts.reduce((s, a) => s + (a.newEditors || 0), 0),
    };
  };

  const seedDefaults = async () => {
    if (!window.confirm("Add the 9 default program areas? Existing programs will not be affected.")) return;
    for (const p of DEFAULT_PROGRAMS) {
      await addProgram(p);
    }
    showToast("Default programs added.");
  };

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Programs</div>

      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16 }}>
          {programs.length === 0 && <button className="btn" onClick={seedDefaults}>Add default programs</button>}
          <button className="btn btn-primary" onClick={openCreate}>+ New program</button>
        </div>
      )}

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit program" : "New program"}</div>
          <div className="form-grid">
            <div className="field"><label>Program name <span className="req">★</span></label><input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="e.g. Wiki Women" /></div>
            <div className="field"><label>Category</label>
              <select value={form.category} onChange={e => setF("category", e.target.value)}>
                {PROGRAM_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Planned sessions</label><input type="number" min="1" value={form.plannedSessions} onChange={e => setF("plannedSessions", Number(e.target.value))} /></div>
            <div className="field"><label>Colour</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
                {PROGRAM_COLORS.map(c => (
                  <div key={c} onClick={() => setF("color", c)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: form.color === c ? "3px solid #1c2b1e" : "2px solid transparent" }} />
                ))}
              </div>
            </div>
          </div>
          <div className="field"><label>Description</label><textarea rows={3} value={form.description} onChange={e => setF("description", e.target.value)} placeholder="Describe the goals and approach of this program" /></div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {programs.length === 0 ? (
        <div className="panel"><div className="empty">No programs yet. Add the default program areas or create a custom one.</div></div>
      ) : (
        <div className="card-grid">
          {programs.map(p => {
            const s = statsFor(p.id);
            return (
              <div key={p.id} className="panel" style={{ borderTop: `4px solid ${p.color || "#4a9e6b"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: p.color || "#4a9e6b", fontWeight: 600, marginBottom: 6 }}>{p.category}</div>
                    {p.description && <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>{p.description}</div>}
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(p)}>✕</button>
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: "1px solid #f0f0ec", paddingTop: 10, marginTop: 4 }}>
                  {[
                    { label: "Sessions", value: `${s.sessions} / ${p.plannedSessions || "—"}` },
                    { label: "Participants", value: s.participants },
                    { label: "Women", value: s.women },
                    { label: "New editors", value: s.newEditors },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: p.color || "#2d7a4f" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ background: "#e8e8e4", borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${Math.min(100, Math.round((s.sessions / (p.plannedSessions || 1)) * 100))}%`, height: 6, borderRadius: 4, background: p.color || "#4a9e6b" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>{Math.round((s.sessions / (p.plannedSessions || 1)) * 100)}% of planned sessions complete</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
