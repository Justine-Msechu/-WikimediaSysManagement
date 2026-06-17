import React, { useState, useEffect } from "react";
import { listenUsers, createUser, updateUser, activateUser, deactivateUser, ROLES, ROLE_LABELS, ROLE_COLORS } from "../services/userService";
import { listenVolunteers } from "../services/volunteerService";
import { sendReset } from "../firebase/auth";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { listenCollection, setDocument, deleteDocument } from "../firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { doc, setDoc } from "firebase/firestore";

function RoleBadge({ role }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color: ROLE_COLORS[role] || "#888", background: (ROLE_COLORS[role] || "#888") + "18", border: `1px solid ${(ROLE_COLORS[role] || "#888")}33`, borderRadius: 5, padding: "2px 8px" }}>{ROLE_LABELS[role] || role}</span>;
}

const EMPTY_FORM = { name: "", email: "", role: "coordinator", volunteerId: "" };

export default function Users({ profile }) {
  const [users,      setUsers]      = useState([]);
  const [pending,    setPending]    = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [error,    setError]    = useState("");
  const [toast,    setToast]    = useState("");
  const [busy,     setBusy]     = useState(false);
  // Per-pending-activation name+role form
  const [pendingForms, setPendingForms] = useState({});

  useEffect(() => {
    const u1 = listenUsers(setUsers);
    const u2 = listenCollection("pendingActivations", setPending);
    const u3 = listenVolunteers(setVolunteers);
    return () => { u1(); u2(); u3(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setError(""); setShowForm(true); };
  const openEdit   = (u) => { setForm({ name: u.name, email: u.email, role: u.role, volunteerId: u.volunteerId || "", password: "", confirm: "" }); setEditId(u.id); setError(""); setShowForm(true); };

  const save = async () => {
    setError("");
    if (!form.name.trim())  { setError("Name is required.");  return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!form.email.includes("@")) { setError("Enter a valid email address."); return; }
    setBusy(true);
    try {
      const extraFields = form.role === "volunteer" ? { volunteerId: form.volunteerId || "" } : {};
      if (!editId) {
        const uid = await createUser(form.email.trim().toLowerCase(), null, { name: form.name.trim(), role: form.role, ...extraFields });
        await addAudit(profile, AUDIT_ACTIONS.CREATE, "users", { targetId: uid, recordTitle: form.name, details: `Created user: ${form.name} (${ROLE_LABELS[form.role]})` });
        showToast(`Account created. A password-setup email has been sent to ${form.email.trim()}.`);
      } else {
        await updateUser(editId, { name: form.name.trim(), role: form.role, ...extraFields });
        await addAudit(profile, AUDIT_ACTIONS.UPDATE, "users", { targetId: editId, recordTitle: form.name, details: `Updated user: ${form.name}` });
        showToast("User updated.");
      }
      setShowForm(false);
    } catch (e) {
      setError(e.message || "Failed to save user.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u) => {
    if (u.id === profile.id) { alert("You cannot deactivate your own account."); return; }
    if (u.isActive === false) {
      await activateUser(u.id);
      await addAudit(profile, AUDIT_ACTIONS.ACTIVATE_USER, "users", { targetId: u.id, recordTitle: u.name });
      showToast(`${u.name} reactivated.`);
    } else {
      await deactivateUser(u.id);
      await addAudit(profile, AUDIT_ACTIONS.DEACTIVATE_USER, "users", { targetId: u.id, recordTitle: u.name });
      showToast(`${u.name} deactivated.`);
    }
  };

  const setPF = (uid, k, v) => setPendingForms(f => ({ ...f, [uid]: { ...(f[uid] || { name: "", role: "coordinator" }), [k]: v } }));

  const activatePending = async (p) => {
    const pf = pendingForms[p.id] || { name: "", role: "coordinator" };
    if (!pf.name.trim()) { alert("Enter the user's full name to activate their account."); return; }
    setBusy(true);
    try {
      await setDoc(doc(db, "users", p.id), {
        name:      pf.name.trim(),
        role:      pf.role,
        email:     p.email,
        isActive:  true,
        createdAt: serverTimestamp(),
        lastLogin: null,
      });
      await deleteDocument("pendingActivations", p.id);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "users", { targetId: p.id, recordTitle: pf.name, details: `Activated pending account: ${p.email}` });
      showToast(`${pf.name} activated.`);
    } catch (e) {
      alert("Failed to activate: " + (e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const resetPwd = async (u) => {
    if (!window.confirm(`Send a password reset email to ${u.email}?`)) return;
    await sendReset(u.email);
    await addAudit(profile, AUDIT_ACTIONS.RESET_PASSWORD, "users", { targetId: u.id, recordTitle: u.name });
    showToast(`Reset email sent to ${u.email}.`);
  };

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">User management</div>

      {/* Pending activations */}
      {pending.length > 0 && (
        <div className="panel" style={{ border: "2px solid #d97706", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div className="panel-title" style={{ marginBottom: 0, color: "#d97706" }}>Pending activations</div>
            <span style={{ background: "#d97706", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{pending.length}</span>
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 14 }}>
            These people logged in but their staff profile wasn't created yet. Enter their name and role, then click Activate.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pending.map(p => {
              const pf = pendingForms[p.id] || { name: "", role: "coordinator" };
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, minWidth: 200 }}>{p.email}</div>
                  <input
                    value={pf.name}
                    onChange={e => setPF(p.id, "name", e.target.value)}
                    placeholder="Full name"
                    style={{ padding: "5px 10px", fontSize: 13, border: "1.5px solid #d0d0c8", borderRadius: 6, flex: 1, minWidth: 140 }}
                  />
                  <select value={pf.role} onChange={e => setPF(p.id, "role", e.target.value)} style={{ fontSize: 13, padding: "5px 8px", borderRadius: 6, border: "1.5px solid #d0d0c8" }}>
                    {Object.values(ROLES).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => activatePending(p)}>Activate</button>
                  <div style={{ fontSize: 11, color: "#aaa" }}>Requested: {p.requestedAt ? new Date(p.requestedAt).toLocaleDateString("en-GB") : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openCreate}>+ Add user</button>
      </div>

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit user" : "New user"}</div>
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          {!editId && (
            <div style={{ background: "#f0f7f3", border: "1px solid #b7e0c8", borderRadius: 7, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#2d7a4f" }}>
              The new user will receive an email with a link to set their own password. You do not need to create one for them.
            </div>
          )}
          <div className="form-grid">
            <div className="field"><label>Full name <span className="req">★</span></label><input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Jane Doe" autoFocus /></div>
            <div className="field"><label>Email {!editId && <span className="req">★</span>}</label><input type="email" value={form.email} onChange={e => setF("email", e.target.value)} disabled={!!editId} placeholder="jane@example.com" /></div>
            <div className="field"><label>Role</label>
              <select value={form.role} onChange={e => setF("role", e.target.value)}>
                {Object.values(ROLES).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            {form.role === "volunteer" && (
              <div className="field"><label>Link to volunteer registry</label>
                <select value={form.volunteerId} onChange={e => setF("volunteerId", e.target.value)}>
                  <option value="">Select volunteer...</option>
                  {volunteers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Links this login account to the volunteer's task list.</div>
              </div>
            )}
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: 0 }}>
        {users.length === 0 ? <div className="empty">No users yet. Add the first admin account.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ opacity: u.isActive === false ? 0.5 : 1 }}>
                    <td style={{ fontWeight: 500 }}>{u.name}{u.id === profile.id && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>(you)</span>}</td>
                    <td style={{ fontSize: 12, color: "#555" }}>{u.email}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td><span className={`badge ${u.isActive === false ? "badge-red" : "badge-green"}`}>{u.isActive === false ? "Inactive" : "Active"}</span></td>
                    <td style={{ fontSize: 11, color: "#888" }}>{u.lastLogin ? (u.lastLogin.toDate ? u.lastLogin.toDate().toLocaleDateString("en-GB") : "") : "Never"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(u)}>Edit</button>
                        <button className="btn btn-sm" onClick={() => resetPwd(u)}>Reset pwd</button>
                        {u.id !== profile.id && (
                          <button className={`btn btn-sm ${u.isActive === false ? "" : "btn-danger"}`} onClick={() => toggleActive(u)}>
                            {u.isActive === false ? "Activate" : "Deactivate"}
                          </button>
                        )}
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
