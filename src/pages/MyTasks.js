import React, { useState, useEffect } from "react";
import { listenTasksForVolunteer, updateTask, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "../services/volunteerService";
import { listenPrograms } from "../services/programService";

function today() { return new Date().toISOString().slice(0, 10); }

export default function MyTasks({ profile }) {
  const [tasks,    setTasks]    = useState([]);
  const [programs, setPrograms] = useState([]);
  const [notes,    setNotes]    = useState({});   // taskId -> draft note text
  const [saving,   setSaving]   = useState({});   // taskId -> bool
  const [toast,    setToast]    = useState("");

  const volunteerId = profile?.volunteerId;

  useEffect(() => {
    if (!volunteerId) return;
    const u1 = listenTasksForVolunteer(volunteerId, setTasks);
    const u2 = listenPrograms(setPrograms);
    return () => { u1(); u2(); };
  }, [volunteerId]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const programName = (id) => programs.find(p => p.id === id)?.name || "";

  const updateStatus = async (task, status) => {
    setSaving(s => ({ ...s, [task.id]: true }));
    try {
      await updateTask(task.id, { status });
      showToast(`Task marked as ${TASK_STATUS_LABELS[status]}.`);
    } finally {
      setSaving(s => ({ ...s, [task.id]: false }));
    }
  };

  const saveNote = async (task) => {
    const note = notes[task.id]?.trim();
    if (!note) return;
    setSaving(s => ({ ...s, [task.id]: true }));
    try {
      await updateTask(task.id, { volunteerNotes: note });
      setNotes(n => ({ ...n, [task.id]: "" }));
      showToast("Progress note saved.");
    } finally {
      setSaving(s => ({ ...s, [task.id]: false }));
    }
  };

  if (!volunteerId) {
    return (
      <div className="panel">
        <div className="empty">Your account is not linked to a volunteer record yet. Ask your coordinator to link your account in User Management.</div>
      </div>
    );
  }

  const active    = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled");
  const completed = tasks.filter(t => t.status === "completed");

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>
          {toast}
        </div>
      )}

      <div className="page-title">My tasks</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
        Welcome, <strong>{profile?.name}</strong>. Here are the tasks assigned to you by your coordinator.
      </div>

      {tasks.length === 0 && (
        <div className="panel"><div className="empty">No tasks assigned to you yet.</div></div>
      )}

      {active.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#555", marginBottom: 10 }}>Active tasks ({active.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {active.map(t => {
              const isOverdue = t.dueDate && t.dueDate < today();
              return (
                <div key={t.id} className="panel" style={{ borderLeft: `4px solid ${TASK_STATUS_COLORS[t.status] || "#ccc"}` }}>
                  {/* Task header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: "#666", display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {t.programId  && <span>Program: <strong>{programName(t.programId)}</strong></span>}
                        {t.assignedBy && <span>Assigned by: <strong>{t.assignedBy}</strong></span>}
                        {t.dueDate    && (
                          <span style={{ color: isOverdue ? "#c0392b" : "#555", fontWeight: isOverdue ? 600 : 400 }}>
                            Due: <strong>{t.dueDate}</strong>{isOverdue ? " — overdue" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ background: TASK_STATUS_COLORS[t.status], color: "#fff", borderRadius: 10, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                      {TASK_STATUS_LABELS[t.status]}
                    </span>
                  </div>

                  {/* Description */}
                  {t.description && (
                    <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 12, background: "#f9f9f7", borderRadius: 6, padding: "10px 12px" }}>
                      {t.description}
                    </div>
                  )}

                  {/* Coordinator notes */}
                  {t.reportNotes && (
                    <div style={{ fontSize: 12, background: "#f0f8f3", border: "1px solid #b7e0c8", borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
                      <strong style={{ color: "#2d7a4f" }}>Coordinator notes:</strong> {t.reportNotes}
                    </div>
                  )}

                  {/* Existing volunteer notes */}
                  {t.volunteerNotes && (
                    <div style={{ fontSize: 12, background: "#f3f0ff", border: "1px solid #c4b5fd", borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
                      <strong style={{ color: "#7c3aed" }}>Your last update:</strong> {t.volunteerNotes}
                    </div>
                  )}

                  {/* Status buttons */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {t.status === "pending"     && <button className="btn btn-sm btn-primary" disabled={saving[t.id]} onClick={() => updateStatus(t, "in_progress")}>Start task</button>}
                    {t.status === "in_progress" && <button className="btn btn-sm btn-primary" disabled={saving[t.id]} onClick={() => updateStatus(t, "completed")}>Mark as completed</button>}
                    {t.status === "in_progress" && <button className="btn btn-sm" disabled={saving[t.id]} onClick={() => updateStatus(t, "pending")}>Put on hold</button>}
                  </div>

                  {/* Progress note */}
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea
                      rows={2}
                      value={notes[t.id] || ""}
                      onChange={e => setNotes(n => ({ ...n, [t.id]: e.target.value }))}
                      placeholder="Add a progress update or note for your coordinator…"
                      style={{ flex: 1, fontSize: 13, resize: "none" }}
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={saving[t.id] || !notes[t.id]?.trim()}
                      onClick={() => saveNote(t)}
                      style={{ alignSelf: "flex-end" }}
                    >
                      Save note
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {completed.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#555", marginBottom: 10 }}>Completed tasks ({completed.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {completed.map(t => (
              <div key={t.id} className="panel" style={{ borderLeft: "4px solid #2d7a4f", opacity: 0.75 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {t.programId && programName(t.programId)}
                      {t.assignedBy && ` · Assigned by ${t.assignedBy}`}
                    </div>
                    {t.volunteerNotes && <div style={{ fontSize: 12, color: "#7c3aed", marginTop: 4 }}>Your note: {t.volunteerNotes}</div>}
                  </div>
                  <span style={{ background: TASK_STATUS_COLORS.completed, color: "#fff", borderRadius: 10, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>Completed</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
