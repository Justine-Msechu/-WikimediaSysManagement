import React, { useState, useEffect } from "react";
import { listenSettings, updateSettings, DEFAULT_SETTINGS } from "../services/settingsService";
import { getAllUsers } from "../services/userService";
import { changePassword } from "../firebase/auth";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { db } from "../firebase/config";
import { collection, getDocs, writeBatch } from "firebase/firestore";

export default function Settings({ profile }) {
  const [settings, setSettings] = useState(null);
  const [form,     setForm]     = useState(null);
  const [saved,    setSaved]    = useState(false);
  const [toast,    setToast]    = useState("");
  const [pwdForm,  setPwdForm]  = useState({ current: "", next: "", confirm: "" });
  const [pwdErr,   setPwdErr]   = useState("");
  const [pwdOk,    setPwdOk]    = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    return listenSettings(s => {
      const d = s || DEFAULT_SETTINGS;
      setSettings(d);
      setForm(JSON.parse(JSON.stringify(d)));
    });
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (path, val) => {
    setForm(f => {
      const c = JSON.parse(JSON.stringify(f));
      const keys = path.split(".");
      let obj = c;
      keys.slice(0, -1).forEach(k => { obj = obj[k]; });
      obj[keys[keys.length - 1]] = val;
      return c;
    });
  };

  const save = async () => {
    await updateSettings(form);
    await addAudit(profile, AUDIT_ACTIONS.UPDATE, "settings", { details: "Settings updated" });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    showToast("Settings saved.");
  };

  const changePwd = async () => {
    setPwdErr("");
    if (!pwdForm.current) { setPwdErr("Current password is required."); return; }
    if (!pwdForm.next)    { setPwdErr("New password is required."); return; }
    if (pwdForm.next.length < 6) { setPwdErr("New password must be at least 6 characters."); return; }
    if (pwdForm.next !== pwdForm.confirm) { setPwdErr("Passwords do not match."); return; }
    try {
      await changePassword(pwdForm.current, pwdForm.next);
      setPwdOk(true); setPwdForm({ current: "", next: "", confirm: "" });
      await addAudit(profile, AUDIT_ACTIONS.RESET_PASSWORD, "settings", { details: "Password changed by user" });
    } catch (err) {
      setPwdErr(err.message || "Failed to change password.");
    }
  };

  const exportBackup = async () => {
    const users = await getAllUsers();
    const colls = ["activities", "participants", "programs", "budgetEntries", "risks", "registrationForms", "registrations", "auditLogs"];
    const data  = { settings, users, exportedAt: new Date().toISOString() };
    for (const col of colls) {
      const snap = await getDocs(collection(db, col));
      data[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `wkgsf-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    await addAudit(profile, AUDIT_ACTIONS.BACKUP, "settings", { details: "Full data export" });
    showToast("Backup exported.");
  };

  if (!form) return <div className="empty">Loading settings…</div>;

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Settings</div>

      {/* Organisation */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Organisation</div>
        {!isAdmin && <div style={{ fontSize: 12, color: "#888", background: "#f5f4f0", borderRadius: 6, padding: "7px 11px", marginBottom: 12 }}>Organisation details can only be edited by Admin.</div>}
        <div className="form-grid">
          <div className="field"><label>Organisation name</label><input value={form.org?.name || ""} onChange={e => setF("org.name", e.target.value)} disabled={!isAdmin} /></div>
          <div className="field"><label>Country</label><input value={form.org?.country || ""} onChange={e => setF("org.country", e.target.value)} disabled={!isAdmin} placeholder="Tanzania" /></div>
          <div className="field"><label>Contact email</label><input type="email" value={form.org?.contactEmail || ""} onChange={e => setF("org.contactEmail", e.target.value)} disabled={!isAdmin} /></div>
          <div className="field"><label>Website</label><input value={form.org?.website || ""} onChange={e => setF("org.website", e.target.value)} disabled={!isAdmin} placeholder="https://…" /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Meta-Wiki grant page</label><input value={form.org?.metaPage || ""} onChange={e => setF("org.metaPage", e.target.value)} disabled={!isAdmin} placeholder="https://meta.wikimedia.org/…" /></div>
        </div>
        {isAdmin && (
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save settings</button>
            {saved && <span style={{ fontSize: 13, color: "#2d7a4f" }}>✓ Saved</span>}
          </div>
        )}
      </div>

      {/* Team */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Team members</div>
        {(form.team || []).length === 0 ? (
          <div className="empty">No team members configured.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Wikipedia username</th><th>Email</th></tr></thead>
              <tbody>
                {(form.team || []).map((m, i) => (
                  <tr key={i}>
                    <td><input value={m.name || ""} onChange={e => { const t = [...form.team]; t[i] = { ...t[i], name: e.target.value }; setForm(f => ({ ...f, team: t })); }} disabled={!isAdmin} style={{ width: "100%" }} /></td>
                    <td><input value={m.role || ""} onChange={e => { const t = [...form.team]; t[i] = { ...t[i], role: e.target.value }; setForm(f => ({ ...f, team: t })); }} disabled={!isAdmin} style={{ width: "100%" }} /></td>
                    <td><input value={m.username || ""} onChange={e => { const t = [...form.team]; t[i] = { ...t[i], username: e.target.value }; setForm(f => ({ ...f, team: t })); }} disabled={!isAdmin} style={{ width: "100%" }} /></td>
                    <td><input value={m.email || ""} onChange={e => { const t = [...form.team]; t[i] = { ...t[i], email: e.target.value }; setForm(f => ({ ...f, team: t })); }} disabled={!isAdmin} style={{ width: "100%" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isAdmin && (
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setForm(f => ({ ...f, team: [...(f.team || []), { name: "", role: "", username: "", email: "" }] }))}>+ Add team member</button>
            <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
          </div>
        )}
      </div>

      {/* Password change */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Change password</div>
        {pwdOk && <div style={{ color: "#2d7a4f", fontSize: 13, marginBottom: 10 }}>✓ Password changed successfully.</div>}
        {pwdErr && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{pwdErr}</div>}
        <div className="form-grid">
          <div className="field"><label>Current password</label><input type="password" value={pwdForm.current} onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))} /></div>
          <div className="field"><label>New password</label><input type="password" value={pwdForm.next} onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))} placeholder="Min. 6 characters" /></div>
          <div className="field"><label>Confirm new password</label><input type="password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} /></div>
        </div>
        <button className="btn btn-primary" onClick={changePwd}>Change password</button>
      </div>

      {/* SMS Notifications — Africa's Talking */}
      {isAdmin && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">SMS notifications (Africa's Talking)</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 14, lineHeight: 1.6 }}>
            Configure Africa's Talking to send SMS alerts for task assignments and deadline reminders.
            Get credentials at <strong>africastalking.com</strong>. Use Sandbox mode for testing.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <input type="checkbox" id="smsEnabled" checked={form.sms?.enabled || false} onChange={e => setF("sms.enabled", e.target.checked)} />
            <label htmlFor="smsEnabled" style={{ fontSize: 13 }}>Enable SMS notifications</label>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>AT Username</label>
              <input value={form.sms?.atUsername || ""} onChange={e => setF("sms.atUsername", e.target.value)} placeholder="e.g. wikikilimanjaro" />
            </div>
            <div className="field">
              <label>AT API Key</label>
              <input type="password" value={form.sms?.atApiKey || ""} onChange={e => setF("sms.atApiKey", e.target.value)} placeholder="Your Africa's Talking API key" />
            </div>
            <div className="field">
              <label>Sender ID (optional)</label>
              <input value={form.sms?.atSenderId || ""} onChange={e => setF("sms.atSenderId", e.target.value)} placeholder="e.g. WikiKili (max 11 chars)" />
            </div>
            <div className="field">
              <label>Mode</label>
              <select value={form.sms?.sandbox ? "sandbox" : "live"} onChange={e => setF("sms.sandbox", e.target.value === "sandbox")}>
                <option value="sandbox">Sandbox (testing)</option>
                <option value="live">Live (production)</option>
              </select>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save SMS settings</button>
          </div>
        </div>
      )}

      {/* Data export — admin only */}
      {isAdmin && (
        <div className="panel">
          <div className="panel-title">Data management</div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>Export a full backup of all Firestore data as a JSON file.</div>
          <button className="btn" onClick={exportBackup}>↓ Export full backup (JSON)</button>
        </div>
      )}
    </div>
  );
}
