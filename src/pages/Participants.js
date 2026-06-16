import React, { useState, useEffect, useRef } from "react";
import { listenParticipants, addParticipant, updateParticipant, deleteParticipant, batchAddParticipants } from "../services/participantService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { fetchEventParticipants, parseODCSV } from "../utils/wikiImport";

const GENDERS  = ["Female", "Male", "Non-binary", "Prefer not to say"];
const REGIONS  = ["Kilimanjaro", "Arusha", "Dar es Salaam", "Mwanza", "Dodoma", "Other"];

function emptyParticipant() {
  return { name: "", wikimediaUsername: "", email: "", phone: "", gender: "", region: "", isNew: false, notes: "" };
}

export default function Participants({ profile }) {
  const [participants, setParticipants] = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(emptyParticipant());
  const [search,    setSearch]    = useState("");
  const [toast,     setToast]     = useState("");
  const [showImport,setShowImport]= useState(false);
  const [importTab, setImportTab] = useState("wep");
  const [wepUrl,    setWepUrl]    = useState("");
  const [wepLoading,setWepLoading]= useState(false);
  const [wepPreview,setWepPreview]= useState(null);
  const csvRef = useRef();
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => { return listenParticipants(setParticipants); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyParticipant()); setEditId(null); setShowForm(true); };
  const openEdit   = (p) => { setForm({ name: p.name || "", wikimediaUsername: p.wikimediaUsername || "", email: p.email || "", phone: p.phone || "", gender: p.gender || "", region: p.region || "", isNew: p.isNew || false, notes: p.notes || "" }); setEditId(p.id); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) { alert("Name is required."); return; }
    if (!editId) {
      const id = await addParticipant(form);
      await addAudit(profile, AUDIT_ACTIONS.CREATE, "participants", { targetId: id, recordTitle: form.name });
      showToast("Participant added.");
    } else {
      await updateParticipant(editId, form);
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "participants", { targetId: editId, recordTitle: form.name });
      showToast("Participant updated.");
    }
    setShowForm(false);
  };

  const del = async (p) => {
    if (!window.confirm(`Remove ${p.name} from the registry?`)) return;
    await deleteParticipant(p.id);
    await addAudit(profile, AUDIT_ACTIONS.DELETE, "participants", { targetId: p.id, recordTitle: p.name });
    showToast("Participant removed.");
  };

  // WEP import
  const importFromWep = async () => {
    if (!wepUrl.trim()) { alert("Paste the Wikipedia Event Platform page URL."); return; }
    setWepLoading(true);
    try {
      const records = await fetchEventParticipants(wepUrl);
      setWepPreview(records);
    } catch (err) {
      alert("Failed to fetch: " + (err.message || err));
    } finally {
      setWepLoading(false);
    }
  };

  const confirmWepImport = async () => {
    if (!wepPreview) return;
    const existingEmails = participants.map(p => (p.email || "").toLowerCase()).filter(Boolean);
    const added = await batchAddParticipants(wepPreview, existingEmails);
    await addAudit(profile, AUDIT_ACTIONS.IMPORT, "participants", { details: `WEP import: ${added} new participants added` });
    showToast(`${added} participants imported.`);
    setWepPreview(null); setWepUrl(""); setShowImport(false);
  };

  // CSV import
  const handleCsvImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const records = parseODCSV(text);
    if (!records.length) { alert("No valid participants found in CSV."); return; }
    const existingEmails = participants.map(p => (p.email || "").toLowerCase()).filter(Boolean);
    const added = await batchAddParticipants(records, existingEmails);
    await addAudit(profile, AUDIT_ACTIONS.IMPORT, "participants", { details: `CSV import: ${added} participants added` });
    showToast(`${added} participants imported from CSV.`);
    setShowImport(false);
    csvRef.current.value = "";
  };

  // CSV export
  const exportCSV = () => {
    const header = "Name,Wikipedia username,Email,Phone,Gender,Region,New editor,Notes";
    const rows   = participants.map(p => [p.name, p.wikimediaUsername, p.email, p.phone, p.gender, p.region, p.isNew ? "Yes" : "No", p.notes].map(v => `"${(v || "").replace(/"/g, '""')}"`).join(","));
    const csv    = [header, ...rows].join("\n");
    const blob   = new Blob([csv], { type: "text/csv" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url; a.download = "participants.csv"; a.click();
    URL.revokeObjectURL(url);
    addAudit(profile, AUDIT_ACTIONS.EXPORT, "participants", { details: `${participants.length} participants exported` });
  };

  const filtered = participants.filter(p => !search || [p.name, p.wikimediaUsername, p.email, p.region].join(" ").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Participants registry</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participants…" style={{ flex: 1, minWidth: 200, fontSize: 13 }} />
        <span style={{ fontSize: 12, color: "#888" }}>{filtered.length} / {participants.length} participants</span>
        {canEdit && <>
          <button className="btn" onClick={() => setShowImport(s => !s)}>Import</button>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Add participant</button>
        </>}
      </div>

      {showImport && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">Import participants</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["wep", "csv"].map(t => <button key={t} className={`btn ${importTab === t ? "btn-primary" : ""}`} onClick={() => setImportTab(t)}>{t === "wep" ? "Wikipedia Event Platform" : "Outreach Dashboard CSV"}</button>)}
          </div>
          {importTab === "wep" ? (
            <div>
              <div className="field"><label>Wikipedia Event Platform page URL</label><input value={wepUrl} onChange={e => setWepUrl(e.target.value)} placeholder="https://www.mediawiki.org/wiki/Wikipedia_Education_Program/…" /></div>
              <button className="btn btn-primary" onClick={importFromWep} disabled={wepLoading}>{wepLoading ? "Fetching…" : "Fetch participants"}</button>
              {wepPreview && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, marginBottom: 8 }}><strong>{wepPreview.length}</strong> participants found. Click confirm to add new ones.</div>
                  <div style={{ maxHeight: 160, overflowY: "auto", background: "#f5f4f0", borderRadius: 6, padding: 10, fontSize: 12 }}>
                    {wepPreview.slice(0, 20).map((r, i) => <div key={i}>{r.name}{r.wikimediaUsername ? ` (@${r.wikimediaUsername})` : ""}</div>)}
                    {wepPreview.length > 20 && <div style={{ color: "#888" }}>…and {wepPreview.length - 20} more</div>}
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-primary" onClick={confirmWepImport}>Confirm import</button>
                    <button className="btn" onClick={() => setWepPreview(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Upload the CSV exported from Outreach Dashboard. Columns: username, realname, email.</div>
              <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvImport} />
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">{editId ? "Edit participant" : "Add participant"}</div>
          <div className="form-grid">
            <div className="field"><label>Full name <span className="req">★</span></label><input value={form.name} onChange={e => setF("name", e.target.value)} placeholder="Jane Doe" /></div>
            <div className="field"><label>Wikipedia username</label><input value={form.wikimediaUsername} onChange={e => setF("wikimediaUsername", e.target.value)} placeholder="JaneDoe" /></div>
            <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => setF("email", e.target.value)} placeholder="jane@example.com" /></div>
            <div className="field"><label>Phone</label><input value={form.phone} onChange={e => setF("phone", e.target.value)} placeholder="+255 …" /></div>
            <div className="field"><label>Gender</label>
              <select value={form.gender} onChange={e => setF("gender", e.target.value)}>
                <option value="">— Not specified —</option>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="field"><label>Region</label>
              <select value={form.region} onChange={e => setF("region", e.target.value)}>
                <option value="">— Not specified —</option>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input type="checkbox" id="isnew" checked={form.isNew} onChange={e => setF("isNew", e.target.checked)} />
            <label htmlFor="isnew" style={{ fontSize: 13 }}>New editor (first Wikipedia contribution)</label>
          </div>
          <div className="field"><label>Notes</label><textarea rows={2} value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Optional notes…" /></div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>Save</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: 0 }}>
        {filtered.length === 0 ? <div className="empty">{participants.length === 0 ? "No participants yet. Add manually, import from WEP, or share the registration form." : "No participants match your search."}</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Name</th><th>Wikipedia username</th><th>Email</th><th>Gender</th><th>Region</th><th>New editor</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>{p.wikimediaUsername ? <a href={`https://en.wikipedia.org/wiki/User:${encodeURIComponent(p.wikimediaUsername)}`} target="_blank" rel="noreferrer" style={{ color: "#4a9e6b" }}>{p.wikimediaUsername}</a> : "—"}</td>
                    <td style={{ fontSize: 12, color: "#555" }}>{p.email || "—"}</td>
                    <td style={{ fontSize: 12 }}>{p.gender || "—"}</td>
                    <td style={{ fontSize: 12 }}>{p.region || "—"}</td>
                    <td>{p.isNew ? <span className="badge badge-green">New</span> : "—"}</td>
                    <td>
                      {canEdit && <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => del(p)}>✕</button>
                      </div>}
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
