import React, { useState, useEffect, useRef } from "react";
import { listenParticipants, addParticipant, updateParticipant, deleteParticipant, batchAddParticipants } from "../services/participantService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { fetchEventParticipants, parseODCSV } from "../utils/wikiImport";
import { listenSettings } from "../services/settingsService";
import { listenPrograms } from "../services/programService";
import logo from "../assets/logo.png";

const GENDERS  = ["Female", "Male", "Non-binary", "Prefer not to say"];
const REGIONS  = ["Kilimanjaro", "Arusha", "Dar es Salaam", "Mwanza", "Dodoma", "Other"];

function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function emptyParticipant(programId = "") {
  return { name: "", wikimediaUsername: "", email: "", phone: "", gender: "", region: "", isNew: false, programId, notes: "" };
}

export default function Participants({ profile }) {
  const [participants, setParticipants] = useState([]);
  const [programs,   setPrograms]    = useState([]);
  const [programFilter, setProgramFilter] = useState("");
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
  const [wikiStats, setWikiStats] = useState({});
  const [settings,  setSettings]  = useState(null);
  const csvRef = useRef();
  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenParticipants(setParticipants);
    const u2 = listenSettings(setSettings);
    const u3 = listenPrograms(setPrograms);
    return () => { u1(); u2(); u3(); };
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyParticipant(programFilter)); setEditId(null); setShowForm(true); };
  const openEdit   = (p) => { setForm({ name: p.name || "", wikimediaUsername: p.wikimediaUsername || "", email: p.email || "", phone: p.phone || "", gender: p.gender || "", region: p.region || "", isNew: p.isNew || false, programId: p.programId || "", notes: p.notes || "" }); setEditId(p.id); setShowForm(true); };

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
  const [wepResult,  setWepResult]  = useState(null);
  const [wepError,   setWepError]   = useState(null);
  const importFromWep = async () => {
    if (!wepUrl.trim()) { alert("Paste the EventDetails or Event page URL."); return; }
    setWepLoading(true); setWepError(null); setWepPreview(null); setWepResult(null);
    try {
      const result = await fetchEventParticipants(wepUrl);
      setWepResult(result);
      setWepPreview(result.participants);
    } catch (err) {
      const msg = err.message || "";
      if (msg.startsWith("CROSS_ORIGIN_BLOCKED")) {
        setWepError("cross-origin");
      } else {
        setWepError(msg || "Failed to fetch.");
      }
    } finally {
      setWepLoading(false);
    }
  };

  const confirmWepImport = async () => {
    if (!wepPreview) return;
    const normalized = wepPreview.map(r => ({
      name:             r.displayName || r.name || r.username || "",
      wikimediaUsername:r.username    || r.wikimediaUsername  || "",
      email: "", phone: "", gender: "", region: "", isNew: false, notes: "",
    }));
    const existingEmails = participants.map(p => (p.email || "").toLowerCase()).filter(Boolean);
    const added = await batchAddParticipants(normalized, existingEmails);
    await addAudit(profile, AUDIT_ACTIONS.IMPORT, "participants", { details: `WEP import: ${added} new participants added` });
    showToast(`${added} participants imported.`);
    setWepPreview(null); setWepResult(null); setWepUrl(""); setShowImport(false);
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

  const fetchEditCount = async (username) => {
    if (!username) return;
    setWikiStats(s => ({ ...s, [username]: "loading" }));
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=users&ususers=${encodeURIComponent(username)}&usprop=editcount&format=json&origin=*`;
      const res  = await fetch(url);
      const json = await res.json();
      const user = json?.query?.users?.[0];
      if (user && !user.missing && user.editcount != null) {
        setWikiStats(s => ({ ...s, [username]: user.editcount }));
        return user.editcount;
      } else {
        setWikiStats(s => ({ ...s, [username]: "not found" }));
      }
    } catch {
      setWikiStats(s => ({ ...s, [username]: "error" }));
    }
    return null;
  };

  const fetchAllEditCounts = async () => {
    const withUsername = participants.filter(p => p.wikimediaUsername);
    if (!withUsername.length) { alert("No participants have a Wikipedia username."); return; }
    // Batch up to 50 at a time using the ususers multi-value API
    const BATCH = 50;
    for (let i = 0; i < withUsername.length; i += BATCH) {
      const batch = withUsername.slice(i, i + BATCH);
      const names = batch.map(p => p.wikimediaUsername).join("|");
      batch.forEach(p => setWikiStats(s => ({ ...s, [p.wikimediaUsername]: "loading" })));
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=users&ususers=${encodeURIComponent(names)}&usprop=editcount&format=json&origin=*`;
        const res  = await fetch(url);
        const json = await res.json();
        const users = json?.query?.users || [];
        users.forEach(u => {
          if (!u.missing && u.editcount != null) {
            setWikiStats(s => ({ ...s, [u.name]: u.editcount }));
          } else {
            setWikiStats(s => ({ ...s, [u.name]: "not found" }));
          }
        });
      } catch {
        batch.forEach(p => setWikiStats(s => ({ ...s, [p.wikimediaUsername]: "error" })));
      }
    }
  };

  const printCertificate = (p) => {
    const orgName = settings?.orgName || "Wikimedians of Kilimanjaro";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Certificate — ${esc(p.name)}</title>
    <style>
      @page { size: A4 landscape; margin: 0; }
      body { font-family: 'Segoe UI', Georgia, serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; }
      .cert { width: 90%; max-width: 720px; text-align: center; border: 8px double #2d7a4f; padding: 48px 56px; }
      .logo { width: 72px; height: 72px; object-fit: contain; margin-bottom: 12px; }
      .org { font-size: 13px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
      h1 { font-size: 36px; font-weight: 300; color: #2d7a4f; margin: 0 0 24px; }
      .presented { font-size: 14px; color: #555; margin-bottom: 12px; }
      .name { font-size: 32px; font-weight: 700; color: #1c2b1e; border-bottom: 2px solid #4a9e6b; display: inline-block; padding-bottom: 6px; margin-bottom: 24px; }
      .body { font-size: 14px; color: #555; line-height: 1.8; margin-bottom: 32px; }
      .footer { display: flex; justify-content: space-around; margin-top: 40px; }
      .sig { font-size: 12px; color: #888; }
      .sig span { display: block; border-top: 1px solid #ccc; padding-top: 6px; margin-top: 24px; }
      .no-print { position: fixed; top: 16px; right: 16px; }
      .no-print button { padding: 8px 20px; background: #2d7a4f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
      @media print { .no-print { display: none; } }
    </style></head><body>
    <div class="no-print"><button onclick="window.print()">Print / Save PDF</button></div>
    <div class="cert">
      <img src="${logo}" class="logo" alt="logo" />
      <div class="org">${esc(orgName)}</div>
      <h1>Certificate of Participation</h1>
      <div class="presented">This is to certify that</div>
      <div class="name">${esc(p.name)}</div>
      <div class="body">
        has actively participated in Wikimedia community activities<br>
        organised by <strong>${esc(orgName)}</strong><br>
        and has contributed to the growth of free knowledge.
        ${p.wikimediaUsername ? `<br><br>Wikipedia username: <strong>${esc(p.wikimediaUsername)}</strong>` : ""}
      </div>
      <div class="footer">
        <div class="sig"><span>Coordinator signature</span></div>
        <div class="sig"><span>Date</span></div>
        <div class="sig"><span>Official stamp</span></div>
      </div>
    </div>
    </body></html>`;
    const w = window.open("", "_blank", "width=900,height=650");
    w.document.write(html);
    w.document.close();
  };

  const whatsappLink = (phone, name) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Hello ${name || ""},`);
    return `https://wa.me/${digits}?text=${msg}`;
  };

  const filtered = participants.filter(p => {
    if (programFilter && (p.programId || "") !== programFilter) return false;
    if (search && ![p.name, p.wikimediaUsername, p.email, p.region].join(" ").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const printAttendance = () => {
    const prog = programs.find(p => p.id === programFilter);
    const orgName = esc(settings?.org?.name || "Wikimedians of Kilimanjaro");
    const progName = esc(prog?.name || "All participants");
    const MIN_ROWS = Math.max(20, filtered.length);
    const rows = [...filtered];
    while (rows.length < MIN_ROWS) rows.push(null);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attendance — ${progName}</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;padding:24px 32px;max-width:900px;margin:0 auto}
      h2{font-size:15px;margin:0 0 2px} h3{font-size:13px;color:#555;margin:0 0 16px;font-weight:400}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{background:#1c2b1e;color:#fff;padding:7px 8px;text-align:left;font-size:11px}
      td{padding:7px 8px;border-bottom:1px solid #ddd;height:28px}
      .sig{border-bottom:1px solid #999;min-width:120px}
      @media print{button{display:none}}
    </style></head><body>
    <button onclick="window.print()" style="margin-bottom:16px;padding:8px 20px;background:#2d7a4f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print / Save PDF</button>
    <h2>${orgName} — Attendance List</h2>
    <h3>${progName} &nbsp;|&nbsp; Date: _________________ &nbsp;|&nbsp; Location: _________________</h3>
    <table>
      <thead><tr><th>#</th><th>Full name</th><th>Wikipedia username</th><th>Phone</th><th>Gender</th><th>New editor</th><th>Signature</th></tr></thead>
      <tbody>
        ${rows.map((p, i) => `<tr>
          <td style="color:#888;width:30px">${i + 1}</td>
          <td>${p ? esc(p.name) : ""}</td>
          <td style="color:#4a9e6b">${p ? esc(p.wikimediaUsername || "") : ""}</td>
          <td>${p ? esc(p.phone || "") : ""}</td>
          <td>${p ? esc(p.gender || "") : ""}</td>
          <td style="text-align:center">${p?.isNew ? "✓" : ""}</td>
          <td class="sig"></td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div style="margin-top:24px;font-size:11px;color:#888">Total registered: ${filtered.length} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})}</div>
    </body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(html);
    w.document.close();
  };

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2d7a4f", color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999 }}>✓ {toast}</div>}
      <div className="page-title">Participants registry</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={programFilter} onChange={e => setProgramFilter(e.target.value)} style={{ fontSize: 13, minWidth: 180 }}>
          <option value="">All programs</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participants…" style={{ flex: 1, minWidth: 160, fontSize: 13 }} />
        <span style={{ fontSize: 12, color: "#888" }}>{filtered.length} / {participants.length}</span>
        <button className="btn btn-sm" onClick={fetchAllEditCounts}>Fetch edit counts</button>
        {canEdit && <>
          <button className="btn btn-sm" onClick={printAttendance}>🖨 Attendance sheet</button>
          <button className="btn" onClick={() => setShowImport(s => !s)}>Import</button>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Add participant</button>
        </>}
      </div>

      {/* Metrics suggestion panel — shown after edit counts are fetched */}
      {Object.keys(wikiStats).length > 0 && (() => {
        const fetched      = Object.entries(wikiStats).filter(([, v]) => typeof v === "number");
        const totalEditors = fetched.length;
        const newEditors   = participants.filter(p => p.isNew && p.wikimediaUsername && typeof wikiStats[p.wikimediaUsername] === "number").length;
        const totalEdits   = fetched.reduce((s, [, v]) => s + v, 0);
        return (
          <div className="panel" style={{ marginBottom: 16, background: "#f0f8f3", border: "1px solid #b7e0c8" }}>
            <div className="panel-title" style={{ color: "#2d7a4f", marginBottom: 8 }}>Wikimedia API results</div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
              <div><span style={{ color: "#888" }}>Participants with username:</span> <strong>{fetched.length + Object.entries(wikiStats).filter(([,v]) => v === "not found").length}</strong></div>
              <div><span style={{ color: "#888" }}>Active editors (have edits):</span> <strong style={{ color: "#2d7a4f" }}>{totalEditors}</strong></div>
              <div><span style={{ color: "#888" }}>New editors (marked as new):</span> <strong style={{ color: "#2563eb" }}>{newEditors}</strong></div>
              <div><span style={{ color: "#888" }}>Total Wikipedia edits:</span> <strong>{totalEdits.toLocaleString()}</strong></div>
            </div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 10 }}>
              Use these numbers to update your targets and results in the <strong>Metrics</strong> page.
              Total participants in registry: <strong>{participants.length}</strong>.
            </div>
          </div>
        );
      })()}

      {showImport && (
        <div className="panel" style={{ border: "2px solid #4a9e6b", marginBottom: 20 }}>
          <div className="panel-title">Import participants</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["wep", "csv"].map(t => <button key={t} className={`btn ${importTab === t ? "btn-primary" : ""}`} onClick={() => setImportTab(t)}>{t === "wep" ? "Wikipedia Event Platform" : "Outreach Dashboard CSV"}</button>)}
          </div>
          {importTab === "wep" ? (
            <div>
              <div className="field">
                <label>EventDetails URL (recommended) or Event page URL</label>
                <input value={wepUrl} onChange={e => setWepUrl(e.target.value)} placeholder="https://sw.wikipedia.org/wiki/Maalum:EventDetails/2936" />
                <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                  On your event page, click <strong>"Maelezo ya tukio"</strong> in the sidebar to get the EventDetails URL.
                </div>
              </div>
              <button className="btn btn-primary" onClick={importFromWep} disabled={wepLoading}>{wepLoading ? "Fetching…" : "Fetch participants"}</button>
              {wepError === "cross-origin" && (
                <div style={{ marginTop: 12, background: "#fff3cd", border: "1px solid #f0c060", borderRadius: 8, padding: "12px 16px", fontSize: 13 }}>
                  <strong style={{ color: "#856404" }}>Wikipedia blocks direct browser access to participant lists.</strong>
                  <div style={{ color: "#856404", marginTop: 6, lineHeight: 1.6 }}>
                    This is a Wikipedia security restriction — it cannot be bypassed from a web app.<br />
                    <strong>Use the Outreach Dashboard CSV instead:</strong>
                    <ol style={{ margin: "6px 0 0 16px", padding: 0 }}>
                      <li>Open your OD program page</li>
                      <li>Scroll to the <strong>Editors</strong> table</li>
                      <li>Click <strong>Download CSV</strong></li>
                      <li>Switch to the <strong>Outreach Dashboard CSV</strong> tab above and upload the file</li>
                    </ol>
                  </div>
                </div>
              )}
              {wepError && wepError !== "cross-origin" && (
                <div style={{ marginTop: 10, color: "#c0392b", fontSize: 13, background: "#fdf0ee", padding: "8px 12px", borderRadius: 6 }}>{wepError}</div>
              )}
              {wepPreview && (
                <div style={{ marginTop: 12 }}>
                  {wepResult && !wepResult.wikitextFallback ? (
                    <div style={{ background: "#e8f5ec", border: "1px solid #b7e0c8", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#2d7a4f", marginBottom: 8 }}>
                      ✓ Campaign Events API — actual registered participants
                    </div>
                  ) : (
                    <div style={{ background: "#fff8e8", border: "1px solid #f0c060", borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "#92600a", marginBottom: 8 }}>
                      ⚠ Wikitext fallback — may include organizers. Use the EventDetails URL for accurate data.
                    </div>
                  )}
                  <div style={{ fontSize: 13, marginBottom: 8 }}><strong>{wepPreview.length}</strong> participants found. Click confirm to add new ones.</div>
                  <div style={{ maxHeight: 160, overflowY: "auto", background: "#f5f4f0", borderRadius: 6, padding: 10, fontSize: 12 }}>
                    {wepPreview.slice(0, 20).map((r, i) => <div key={i}>{r.displayName || r.name}{r.username ? ` (@${r.username})` : r.wikimediaUsername ? ` (@${r.wikimediaUsername})` : ""}</div>)}
                    {wepPreview.length > 20 && <div style={{ color: "#888" }}>…and {wepPreview.length - 20} more</div>}
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-primary" onClick={confirmWepImport}>Confirm import</button>
                    <button className="btn" onClick={() => { setWepPreview(null); setWepResult(null); }}>Cancel</button>
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
                <option value="">(Not specified)</option>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="field"><label>Region</label>
              <select value={form.region} onChange={e => setF("region", e.target.value)}>
                <option value="">(Not specified)</option>
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>Program</label>
            <select value={form.programId || ""} onChange={e => setF("programId", e.target.value)}>
              <option value="">(None / unassigned)</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
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
              <thead><tr><th>Name</th><th>Program</th><th>Wikipedia username</th><th>Edits</th><th>Email</th><th>Phone</th><th>Gender</th><th>New editor</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(p => {
                  const stat = p.wikimediaUsername ? wikiStats[p.wikimediaUsername] : undefined;
                  const waLink = whatsappLink(p.phone, p.name);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td style={{ fontSize: 11, color: "#888" }}>{programs.find(pr => pr.id === p.programId)?.name || ""}</td>
                      <td>
                        {p.wikimediaUsername
                          ? <a href={`https://en.wikipedia.org/wiki/User:${encodeURIComponent(p.wikimediaUsername)}`} target="_blank" rel="noreferrer" style={{ color: "#4a9e6b" }}>{p.wikimediaUsername}</a>
                          : ""}
                      </td>
                      <td style={{ fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                        {p.wikimediaUsername && (
                          stat === undefined
                            ? <button className="btn btn-sm" style={{ fontSize: 10, padding: "2px 6px" }} onClick={() => fetchEditCount(p.wikimediaUsername)}>Fetch</button>
                            : stat === "loading"
                              ? <span style={{ color: "#888" }}>…</span>
                              : typeof stat === "number"
                                ? <span style={{ fontWeight: 600, color: stat > 0 ? "#2d7a4f" : "#888" }}>{stat.toLocaleString()}</span>
                                : <span style={{ color: "#c0392b", fontSize: 11 }}>{stat}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "#555" }}>{p.email || ""}</td>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {p.phone || ""}
                        {waLink && <a href={waLink} target="_blank" rel="noreferrer" title="Open WhatsApp chat" style={{ marginLeft: 6, fontSize: 14, textDecoration: "none" }}>💬</a>}
                      </td>
                      <td style={{ fontSize: 12 }}>{p.gender || ""}</td>
                      <td style={{ fontSize: 12 }}>{p.region || ""}</td>
                      <td>{p.isNew ? <span className="badge badge-green">New</span> : ""}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm" title="Generate participation certificate" onClick={() => printCertificate(p)}>Cert</button>
                          {canEdit && <>
                            <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => del(p)}>✕</button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
