import React, { useState, useEffect } from "react";
import {
  listenVolunteers, addVolunteer, updateVolunteer, deleteVolunteer,
  listenTasks, addTask, updateTask, deleteTask,
  SKILL_OPTIONS, AVAILABILITY_OPTIONS,
  TASK_STATUS, TASK_STATUS_LABELS, TASK_STATUS_COLORS,
} from "../services/volunteerService";
import { listenPrograms } from "../services/programService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { sendEmailNotification } from "../services/notificationService";
import { listenSettings } from "../services/settingsService";
import { sendSMSBulk } from "../services/smsService";
import TaskComments from "./TaskComments";

function today() { return new Date().toISOString().slice(0, 10); }

function whatsappLink(phone, name) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hello ${name || ""},`)}`;
}

const TABS = ["Registry", "Tasks", "Report"];

function emptyVolunteer() {
  return { name: "", phone: "", email: "", skills: [], availability: "", programs: [], notes: "", isActive: true };
}

function emptyTask(programs) {
  return {
    title: "", description: "", volunteerIds: [],
    programId: programs[0]?.id || "", dueDate: "", status: "pending",
    assignedBy: "", reportNotes: "",
  };
}

// Returns the volunteer IDs on a task, handling both old (volunteerId) and new (volunteerIds) format
function taskVolunteerIds(t) {
  if (Array.isArray(t.volunteerIds) && t.volunteerIds.length > 0) return t.volunteerIds;
  if (t.volunteerId) return [t.volunteerId];
  return [];
}

// ── Volunteer Registry ─────────────────────────────────────────────────────────
function Registry({ volunteers, programs, profile, showToast }) {
  const [showForm, setShowForm]   = useState(false);
  const [editId,   setEditId]     = useState(null);
  const [form,     setForm]       = useState(emptyVolunteer());
  const [search,   setSearch]     = useState("");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleSkill = (skill) =>
    setForm(f => ({ ...f, skills: f.skills.includes(skill) ? f.skills.filter(s => s !== skill) : [...f.skills, skill] }));

  const openCreate = () => { setForm(emptyVolunteer()); setEditId(null); setShowForm(true); };
  const openEdit   = (v) => {
    setForm({
      name: v.name, phone: v.phone || "", email: v.email || "",
      skills: v.skills || [], availability: v.availability || "",
      programs: v.programs || [], notes: v.notes || "", isActive: v.isActive !== false,
    });
    setEditId(v.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) { alert("Volunteer name is required."); return; }
    if (!editId) {
      const id = await addVolunteer(form);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "volunteers", { targetId: id, recordTitle: form.name });
      showToast("Volunteer added.");
    } else {
      await updateVolunteer(editId, form);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "volunteers", { targetId: editId, recordTitle: form.name });
      showToast("Volunteer updated.");
    }
    setShowForm(false);
  };

  const del = async (v) => {
    if (!window.confirm(`Remove ${v.name} from the registry?`)) return;
    await deleteVolunteer(v.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "volunteers", { targetId: v.id, recordTitle: v.name });
    showToast("Volunteer removed.");
  };

  const filtered = volunteers.filter(v =>
    !search || v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.skills?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search volunteers or skills..." style={{ flex: 1, minWidth: 200, fontSize: 13 }} />
        {canEdit && <button className="btn btn-primary" onClick={openCreate}>+ Add volunteer</button>}
      </div>

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit volunteer" : "Add volunteer"}</div>
          <div className="form-grid">
            <div className="field"><label>Full name <span className="req">★</span></label>
              <input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="e.g. Amina Juma" />
            </div>
            <div className="field"><label>Phone</label>
              <input value={form.phone} onChange={e => setF("phone", e.target.value)} placeholder="+255 7XX XXX XXX" />
            </div>
            <div className="field"><label>Email</label>
              <input type="email" value={form.email} onChange={e => setF("email", e.target.value)} placeholder="volunteer@email.com" />
            </div>
            <div className="field"><label>Availability</label>
              <select value={form.availability} onChange={e => setF("availability", e.target.value)}>
                <option value="">Select...</option>
                {AVAILABILITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="field"><label>Active</label>
              <select value={form.isActive ? "yes" : "no"} onChange={e => setF("isActive", e.target.value === "yes")}>
                <option value="yes">Active</option>
                <option value="no">Inactive</option>
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Programs involved in</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {programs.filter(p => p.status === "approved").map(p => (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.programs.includes(p.id)}
                    onChange={() => setF("programs", form.programs.includes(p.id) ? form.programs.filter(x => x !== p.id) : [...form.programs, p.id])} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Skills</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {SKILL_OPTIONS.map(s => (
                <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.skills.includes(s)} onChange={() => toggleSkill(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Any additional notes about this volunteer..." />
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="panel"><div className="empty">No volunteers yet. Add your first volunteer above.</div></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Phone</th><th>Email</th><th>Skills</th><th>Availability</th><th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {v.phone || ""}
                    {whatsappLink(v.phone, v.name) && <a href={whatsappLink(v.phone, v.name)} target="_blank" rel="noreferrer" title="Open WhatsApp chat" style={{ marginLeft: 6, fontSize: 14, textDecoration: "none" }}>💬</a>}
                  </td>
                  <td style={{ fontSize: 12 }}>{v.email || ""}</td>
                  <td style={{ fontSize: 11 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(v.skills || []).slice(0, 3).map(s => (
                        <span key={s} style={{ background: "#e6f4ec", color: "#2d7a4f", borderRadius: 10, padding: "1px 7px" }}>{s}</span>
                      ))}
                      {(v.skills || []).length > 3 && <span style={{ color: "#888", fontSize: 11 }}>+{v.skills.length - 3} more</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{v.availability || ""}</td>
                  <td>
                    <span style={{ background: v.isActive !== false ? "#e6f4ec" : "#f5f4f0", color: v.isActive !== false ? "#2d7a4f" : "#888", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>
                      {v.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(v)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => del(v)}>Remove</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Task Management ────────────────────────────────────────────────────────────
function Tasks({ volunteers, programs, tasks, profile, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState({});
  const [filter,   setFilter]   = useState("all");
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const approvedPrograms = programs.filter(p => p.status === "approved");

  const toggleVolunteer = (id) => {
    const ids = form.volunteerIds || [];
    setF("volunteerIds", ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const openCreate = () => {
    setForm({ ...emptyTask(approvedPrograms), assignedBy: profile?.name || "" });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (t) => {
    setForm({
      title: t.title, description: t.description || "",
      volunteerIds: taskVolunteerIds(t),
      programId: t.programId || "", dueDate: t.dueDate || "", status: t.status,
      assignedBy: t.assignedBy || "", reportNotes: t.reportNotes || "",
    });
    setEditId(t.id);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title?.trim())              { alert("Task title is required."); return; }
    if (!form.volunteerIds?.length)       { alert("Assign this task to at least one volunteer."); return; }
    const data = { ...form };
    delete data.volunteerId; // remove legacy field if present
    if (!editId) {
      const id = await addTask(data);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "volunteerTasks", { targetId: id, recordTitle: form.title });

      // Email every assigned volunteer who has an email address
      const prog = approvedPrograms.find(p => p.id === form.programId);
      const emailResults = await Promise.all(
        form.volunteerIds.map(async (vid) => {
          const volunteer = volunteers.find(v => v.id === vid);
          if (!volunteer?.email) return null;
          const subject = `New task assigned to you: ${form.title}`;
          const body = [
            `Dear ${volunteer.name},`,
            ``,
            `You have been assigned a new task by ${form.assignedBy || "your coordinator"}:`,
            ``,
            `Task:     ${form.title}`,
            prog ? `Program:  ${prog.name}` : "",
            form.dueDate ? `Due date: ${form.dueDate}` : "",
            form.description ? `\nDetails:\n${form.description}` : "",
            ``,
            `Log in to the GSF Manager to see your full task list.`,
            ``,
            `Wikimedia Community Kilimanjaro`,
          ].filter(l => l !== undefined).join("\n");
          const result = await sendEmailNotification({ toEmails: [volunteer.email], subject, body });
          return { name: volunteer.name, ...result };
        })
      );

      const sent   = emailResults.filter(r => r?.ok).map(r => r.name);
      const failed = emailResults.filter(r => r && !r.ok);
      if (failed.length) {
        showToast(`Task assigned. Email failed for: ${failed.map(r => r.name).join(", ")}`);
      } else if (sent.length) {
        showToast(`Task assigned. Email sent to ${sent.join(", ")}.`);
      } else {
        showToast("Task assigned. (No emails — volunteers have no email addresses.)");
      }

      // SMS notifications via Africa's Talking (if configured)
      if (settings?.sms?.enabled) {
        const smsRecipients = form.volunteerIds
          .map(vid => volunteers.find(v => v.id === vid))
          .filter(v => v?.phone)
          .map(v => ({
            to: v.phone,
            message: `WikiKili: New task "${form.title}"${form.dueDate ? `, due ${form.dueDate}` : ""}. Log in to GSF Manager.`,
          }));
        if (smsRecipients.length) {
          sendSMSBulk(settings.sms, smsRecipients).catch(() => {});
        }
      }
    } else {
      await updateTask(editId, data);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "volunteerTasks", { targetId: editId, recordTitle: form.title });
      showToast("Task updated.");
    }
    setShowForm(false);
  };

  const del = async (t) => {
    if (!window.confirm(`Delete task "${t.title}"?`)) return;
    await deleteTask(t.id);
    showToast("Task deleted.");
  };

  const quickStatus = async (t, status) => {
    await updateTask(t.id, { status });
    showToast(`Task marked as ${TASK_STATUS_LABELS[status]}.`);
  };

  const volunteerNames = (t) => taskVolunteerIds(t)
    .map(id => volunteers.find(v => v.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  const programName = (id) => programs.find(p => p.id === id)?.name || "";
  const filtered    = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", ...TASK_STATUS].map(s => (
            <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : ""}`} onClick={() => setFilter(s)}>
              {s === "all" ? "All tasks" : TASK_STATUS_LABELS[s]}
              {s !== "all" && (
                <span style={{ marginLeft: 4, background: filter === s ? "rgba(255,255,255,0.3)" : TASK_STATUS_COLORS[s], color: "#fff", borderRadius: 10, padding: "0 5px", fontSize: 10 }}>
                  {tasks.filter(t => t.status === s).length}
                </span>
              )}
            </button>
          ))}
        </div>
        {canEdit && <button className="btn btn-primary" onClick={openCreate} disabled={volunteers.length === 0} title={volunteers.length === 0 ? "Add volunteers first" : ""}>+ Assign task</button>}
      </div>

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit task" : "Assign task"}</div>
          <div className="form-grid">
            <div className="field"><label>Task title <span className="req">★</span></label>
              <input value={form.title || ""} onChange={e => setF("title", e.target.value)} placeholder="e.g. Prepare training materials for Wikipedia workshop" />
            </div>
            <div className="field"><label>Program</label>
              <select value={form.programId || ""} onChange={e => setF("programId", e.target.value)}>
                <option value="">No specific program</option>
                {approvedPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Due date</label>
              <input type="date" value={form.dueDate || ""} onChange={e => setF("dueDate", e.target.value)} />
            </div>
            <div className="field"><label>Status</label>
              <select value={form.status || "pending"} onChange={e => setF("status", e.target.value)}>
                {TASK_STATUS.map(s => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="field"><label>Assigned by</label>
              <input value={form.assignedBy || ""} onChange={e => setF("assignedBy", e.target.value)} placeholder="Coordinator name" />
            </div>
          </div>

          {/* Multi-volunteer selector */}
          <div className="field" style={{ marginTop: 8 }}>
            <label>Assigned to <span className="req">★</span></label>
            <div style={{ border: "1.5px solid #d0d0c8", borderRadius: 7, padding: "8px 12px", maxHeight: 180, overflowY: "auto", marginTop: 4 }}>
              {volunteers.filter(v => v.isActive !== false).length === 0 ? (
                <div style={{ fontSize: 13, color: "#aaa" }}>No active volunteers in the registry.</div>
              ) : (
                volunteers.filter(v => v.isActive !== false).map(v => (
                  <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "4px 0" }}>
                    <input
                      type="checkbox"
                      checked={(form.volunteerIds || []).includes(v.id)}
                      onChange={() => toggleVolunteer(v.id)}
                    />
                    <span>{v.name}</span>
                    {v.skills?.length > 0 && (
                      <span style={{ fontSize: 11, color: "#888" }}>— {v.skills.slice(0, 2).join(", ")}</span>
                    )}
                  </label>
                ))
              )}
            </div>
            {(form.volunteerIds || []).length > 0 && (
              <div style={{ fontSize: 11, color: "#2d7a4f", marginTop: 4 }}>
                {form.volunteerIds.length} volunteer{form.volunteerIds.length > 1 ? "s" : ""} selected
              </div>
            )}
          </div>

          <div className="field" style={{ marginTop: 8 }}><label>Task description</label>
            <textarea rows={3} value={form.description || ""} onChange={e => setF("description", e.target.value)} placeholder="Describe what the volunteer(s) need to do..." />
          </div>
          <div className="field" style={{ marginTop: 8 }}><label>Coordinator report notes</label>
            <textarea rows={3} value={form.reportNotes || ""} onChange={e => setF("reportNotes", e.target.value)} placeholder="Notes on outcomes achieved..." />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="panel"><div className="empty">{filter === "all" ? "No tasks yet. Assign the first task above." : `No ${TASK_STATUS_LABELS[filter]?.toLowerCase()} tasks.`}</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(t => {
            const isOverdue = t.dueDate && t.status !== "completed" && t.status !== "cancelled" && t.dueDate < today();
            return (
              <div key={t.id} className="panel" style={{ borderLeft: `4px solid ${TASK_STATUS_COLORS[t.status] || "#ccc"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: "#555", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span>Assigned to: <strong>{volunteerNames(t) || "—"}</strong></span>
                      {t.programId && <span>Program: <strong>{programName(t.programId)}</strong></span>}
                      {t.assignedBy && <span>By: <strong>{t.assignedBy}</strong></span>}
                      {t.dueDate && (
                        <span style={{ color: isOverdue ? "#c0392b" : "#555" }}>
                          Due: <strong>{t.dueDate}</strong>{isOverdue ? " (overdue)" : ""}
                        </span>
                      )}
                    </div>
                    {t.description && <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>{t.description}</div>}
                    {t.reportNotes && (
                      <div style={{ marginTop: 8, background: "#f0f8f3", border: "1px solid #b7e0c8", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
                        <strong style={{ color: "#2d7a4f" }}>Coordinator notes:</strong> {t.reportNotes}
                      </div>
                    )}
                    {t.volunteerNotes && (
                      <div style={{ marginTop: 6, background: "#f3f0ff", border: "1px solid #c4b5fd", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
                        <strong style={{ color: "#7c3aed" }}>Volunteer update:</strong> {t.volunteerNotes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ background: TASK_STATUS_COLORS[t.status], color: "#fff", borderRadius: 10, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                      {TASK_STATUS_LABELS[t.status]}
                    </span>
                    {canEdit && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {t.status === "pending"     && <button className="btn btn-sm" onClick={() => quickStatus(t, "in_progress")}>Start</button>}
                        {t.status === "in_progress" && <button className="btn btn-sm" onClick={() => quickStatus(t, "completed")}>Mark done</button>}
                        {t.status === "completed"   && <button className="btn btn-sm" onClick={() => quickStatus(t, "in_progress")}>Reopen</button>}
                        <button className="btn btn-sm" onClick={() => openEdit(t)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => del(t)}>Remove</button>
                      </div>
                    )}
                  </div>
                </div>
                <TaskComments taskId={t.id} profile={profile} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Volunteer Report ───────────────────────────────────────────────────────────
function Report({ volunteers, programs, tasks, profile }) {
  const [selectedId, setSelectedId] = useState("");

  const volunteer   = volunteers.find(v => v.id === selectedId);
  // Support both old (volunteerId) and new (volunteerIds) format
  const myTasks     = tasks.filter(t => taskVolunteerIds(t).includes(selectedId));
  const programName = (id) => programs.find(p => p.id === id)?.name || "";
  const statusCount = (status) => myTasks.filter(t => t.status === status).length;

  const downloadReport = () => {
    if (!volunteer) return;
    const lines = [
      `VOLUNTEER REPORT: ${volunteer.name.toUpperCase()}`,
      "=".repeat(60),
      `Phone:        ${volunteer.phone || ""}`,
      `Email:        ${volunteer.email || ""}`,
      `Availability: ${volunteer.availability || ""}`,
      `Skills:       ${(volunteer.skills || []).join(", ")}`,
      `Status:       ${volunteer.isActive !== false ? "Active" : "Inactive"}`,
      "",
      "TASK SUMMARY",
      "-".repeat(40),
      `Total tasks:    ${myTasks.length}`,
      `Completed:      ${statusCount("completed")}`,
      `In progress:    ${statusCount("in_progress")}`,
      `Pending:        ${statusCount("pending")}`,
      `Cancelled:      ${statusCount("cancelled")}`,
      `Hours logged:   ${myTasks.reduce((s,t) => s+(t.hoursSpent||0), 0)}h`,
      "",
      "TASK DETAILS",
      "-".repeat(40),
      ...myTasks.map(t => [
        ``,
        `Task:     ${t.title}`,
        `Status:   ${TASK_STATUS_LABELS[t.status]}`,
        `Program:  ${programName(t.programId)}`,
        `Due:      ${t.dueDate || ""}`,
        `Assigned: ${t.assignedBy || ""}`,
        t.description    ? `Details:        ${t.description}` : "",
        t.reportNotes    ? `Coord. notes:   ${t.reportNotes}` : "",
        t.volunteerNotes ? `Volunteer note: ${t.volunteerNotes}` : "",
      ].filter(Boolean)),
      "",
      `Report generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`,
      `By: ${profile?.name || ""}`,
    ];
    const blob = new Blob([lines.flat().join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `volunteer-report-${volunteer.name.replace(/\s+/g, "-")}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>Select volunteer</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ fontSize: 13, flex: 1, minWidth: 200 }}>
            <option value="">Choose a volunteer...</option>
            {volunteers.map(v => <option key={v.id} value={v.id}>{v.name}{v.isActive === false ? " (inactive)" : ""}</option>)}
          </select>
          {volunteer && <button className="btn btn-primary" onClick={downloadReport}>Download report (.txt)</button>}
        </div>
      </div>

      {volunteer && (
        <>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#2d7a4f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                {volunteer.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{volunteer.name}</div>
                <div style={{ fontSize: 13, color: "#555", display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {volunteer.phone && (
                    <span>
                      {volunteer.phone}
                      {whatsappLink(volunteer.phone, volunteer.name) && (
                        <a href={whatsappLink(volunteer.phone, volunteer.name)} target="_blank" rel="noreferrer" title="WhatsApp" style={{ marginLeft: 6, fontSize: 14, textDecoration: "none" }}>💬</a>
                      )}
                    </span>
                  )}
                  {volunteer.email && <span>{volunteer.email}</span>}
                  {volunteer.availability && <span>Available: {volunteer.availability}</span>}
                </div>
                {(volunteer.skills || []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {volunteer.skills.map(s => (
                      <span key={s} style={{ background: "#e6f4ec", color: "#2d7a4f", borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              ["Total tasks",    myTasks.length,                                    "#555"],
              ["Completed",      statusCount("completed"),                           "#2d7a4f"],
              ["In progress",    statusCount("in_progress"),                         "#2563eb"],
              ["Pending",        statusCount("pending"),                             "#d97706"],
              ["Hours logged",   myTasks.reduce((s,t) => s+(t.hoursSpent||0), 0)+"h","#7c3aed"],
            ].map(([label, val, color]) => (
              <div key={label} className="panel" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 700, color }}>{val}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
              </div>
            ))}
          </div>

          {myTasks.length === 0 ? (
            <div className="panel"><div className="empty">No tasks assigned to {volunteer.name} yet.</div></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {myTasks.map(t => (
                <div key={t.id} className="panel" style={{ borderLeft: `4px solid ${TASK_STATUS_COLORS[t.status] || "#ccc"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: "#666", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {t.programId  && <span>Program: {programName(t.programId)}</span>}
                        {t.dueDate    && <span>Due: {t.dueDate}</span>}
                        {t.assignedBy && <span>Assigned by: {t.assignedBy}</span>}
                      </div>
                      {t.description  && <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>{t.description}</div>}
                      {t.reportNotes  && (
                        <div style={{ marginTop: 8, background: "#f0f8f3", border: "1px solid #b7e0c8", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
                          <strong style={{ color: "#2d7a4f" }}>Coordinator notes:</strong> {t.reportNotes}
                        </div>
                      )}
                      {t.volunteerNotes && (
                        <div style={{ marginTop: 6, background: "#f3f0ff", border: "1px solid #c4b5fd", borderRadius: 6, padding: "8px 12px", fontSize: 12 }}>
                          <strong style={{ color: "#7c3aed" }}>Volunteer update:</strong> {t.volunteerNotes}
                        </div>
                      )}
                    </div>
                    <span style={{ background: TASK_STATUS_COLORS[t.status], color: "#fff", borderRadius: 10, padding: "2px 10px", fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                      {TASK_STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <TaskComments taskId={t.id} profile={profile} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!volunteer && volunteers.length > 0 && (
        <div className="panel"><div className="empty">Select a volunteer above to view their report.</div></div>
      )}
      {volunteers.length === 0 && (
        <div className="panel"><div className="empty">No volunteers in the registry yet.</div></div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Volunteers({ profile }) {
  const [tab,        setTab]        = useState("Registry");
  const [volunteers, setVolunteers] = useState([]);
  const [programs,   setPrograms]   = useState([]);
  const [tasks,      setTasks]      = useState([]);
  const [settings,   setSettings]   = useState(null);
  const [toast,      setToast]      = useState("");

  useEffect(() => {
    const u1 = listenVolunteers(setVolunteers);
    const u2 = listenPrograms(setPrograms);
    const u3 = listenTasks(setTasks);
    const u4 = listenSettings(setSettings);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const pendingCount = tasks.filter(t => t.status === "pending").length;

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>
          {toast}
        </div>
      )}
      <div className="page-title">Volunteers</div>

      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t === "Tasks" && pendingCount > 0 && (
              <span style={{ marginLeft: 6, background: "#d97706", color: "#fff", borderRadius: 10, padding: "0 6px", fontSize: 10, fontWeight: 700 }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "Registry" && <Registry volunteers={volunteers} programs={programs} profile={profile} showToast={showToast} />}
      {tab === "Tasks"    && <Tasks    volunteers={volunteers} programs={programs} tasks={tasks} profile={profile} showToast={showToast} />}
      {tab === "Report"   && <Report   volunteers={volunteers} programs={programs} tasks={tasks} profile={profile} />}
    </div>
  );
}
