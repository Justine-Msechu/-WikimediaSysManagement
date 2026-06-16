import React, { useState, useEffect } from "react";
import { listenUsers, createUser, updateUser, activateUser, deactivateUser, ROLES, ROLE_LABELS, ROLE_COLORS } from "../services/userService";
import { sendReset } from "../firebase/auth";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

function RoleBadge({ role }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color: ROLE_COLORS[role] || "#888", background: (ROLE_COLORS[role] || "#888") + "18", border: `1px solid ${(ROLE_COLORS[role] || "#888")}33`, borderRadius: 5, padding: "2px 8px" }}>{ROLE_LABELS[role] || role}</span>;
}

const EMPTY_FORM = { name: "", email: "", role: "coordinator", password: "", confirm: "" };

export default function Users({ profile }) {
  const [users,     setUsers]     = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [error,     setError]     = useState("");
  const [toast,     setToast]     = useState("");
  const [busy,      setBusy]      = useState(false);

  useEffect(() => { return listenUsers(setUsers); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setError(""); setShowForm(true); };
  const openEdit   = (u) => { setForm({ name: u.name, email: u.email, role: u.role, password: "", confirm: "" }); setEditId(u.id); setError(""); setShowForm(true); };

  const save = async () => {
    setError("");
    if (!form.name.trim())  { setError("Name is required.");  return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!editId && !form.password) { setError("Password is required for new users."); return; }
    if (form.password && form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password && form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      if (!editId) {
        const uid = await createUser(form.email.trim().toLowerCase(), form.password, { name: form.name.trim(), role: form.role });
        await addAudit(profile, AUDIT_ACTIONS.CREATE, "users", { targetId: uid, recordTitle: form.name, details: `Created user: ${form.name} (${ROLE_LABELS[form.role]})` });
        showToast(`User ${form.name} created.`);
      } else {
        await updateUser(editId, { name: form.name.trim(), role: form.role });
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

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openCreate}>+ Add user</button>
      </div>

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit user" : "New user"}</div>
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="form-grid">
            <div className="field"><label>Full name <span className="req">★</span></label><input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Jane Doe" /></div>
            <div className="field"><label>Email {!editId && <span className="req">★</span>}</label><input type="email" value={form.email} onChange={e => setF("email", e.target.value)} disabled={!!editId} placeholder="jane@example.com" /></div>
            <div className="field"><label>Role</label>
              <select value={form.role} onChange={e => setF("role", e.target.value)}>
                {Object.values(ROLES).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          {!editId && (
            <div className="form-grid">
              <div className="field"><label>Password <span className="req">★</span></label><input type="password" value={form.password} onChange={e => setF("password", e.target.value)} placeholder="Min. 6 characters" /></div>
              <div className="field"><label>Confirm password</label><input type="password" value={form.confirm} onChange={e => setF("confirm", e.target.value)} placeholder="Repeat password" /></div>
            </div>
          )}
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
                    <td style={{ fontSize: 11, color: "#888" }}>{u.lastLogin ? (u.lastLogin.toDate ? u.lastLogin.toDate().toLocaleDateString("en-GB") : "—") : "Never"}</td>
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
