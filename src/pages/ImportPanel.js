import React, { useState, useRef } from "react";
import { uid } from "../data/store";
import { fetchEventParticipants, parseODCSV } from "../utils/wikiImport";

/**
 * ImportPanel — shared component for importing participants from:
 * 1. Wikipedia Event Platform page (via MediaWiki API)
 * 2. Outreach Dashboard CSV export
 *
 * Props:
 *   existingParticipants  — state.participants array (for duplicate detection)
 *   programs              — state.programs (for linking)
 *   onImport(records)     — called with array of participant records to add
 *   defaultWikiUrl        — pre-fill the URL field (e.g. from activity's wikiEventUrl)
 *   activityId            — if importing for a specific activity
 *   activityName          — label for the context header
 */
export default function ImportPanel({
  existingParticipants = [],
  programs = [],
  onImport,
  defaultWikiUrl = "",
  activityId = null,
  activityName = "",
}) {
  const [tab, setTab]             = useState("wiki"); // "wiki" | "od"
  const [wikiUrl, setWikiUrl]     = useState(defaultWikiUrl);
  const [fetching, setFetching]   = useState(false);
  const [fetchErr, setFetchErr]   = useState("");
  const [preview, setPreview]     = useState(null);   // { pageTitle, participants[] }
  const [selected, setSelected]   = useState(new Set()); // set of usernames to import
  const [odPreview, setOdPreview] = useState(null);   // OD parsed rows
  const [odErr, setOdErr]         = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone]           = useState("");
  const fileRef = useRef();

  // ── Wikipedia fetch ────────────────────────────────────────────────────────
  const fetchWiki = async () => {
    setFetchErr(""); setPreview(null); setSelected(new Set()); setDone("");
    if (!wikiUrl.trim()) { setFetchErr("Paste the Wikipedia Event page URL first."); return; }
    setFetching(true);
    try {
      const result = await fetchEventParticipants(wikiUrl.trim());
      setPreview(result);
      // Pre-select all usernames NOT already in the participant registry
      const existing = new Set(
        existingParticipants.map(p => (p.wikimediaUsername || "").toLowerCase()).filter(Boolean)
      );
      const toSelect = new Set(
        result.participants
          .filter(p => !existing.has(p.username.toLowerCase()))
          .map(p => p.username)
      );
      setSelected(toSelect);
    } catch (e) {
      setFetchErr(e.message || "Failed to fetch. Check the URL and your internet connection.");
    } finally {
      setFetching(false);
    }
  };

  const toggleSelect = (username) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(username) ? next.delete(username) : next.add(username);
      return next;
    });
  };

  const importWiki = () => {
    if (selected.size === 0) return;
    setImporting(true);
    const now = new Date().toISOString();
    const records = preview.participants
      .filter(p => selected.has(p.username))
      .map(p => ({
        id: uid(),
        name: p.displayName || p.username,
        wikimediaUsername: p.username,
        email: "", phone: "", gender: "", age: "",
        region: "", district: "", organization: "",
        programIds: activityId ? [] : [],
        importedFrom: "wikipedia",
        importedFromUrl: wikiUrl.trim(),
        importedAt: now,
        source: "wikipedia-event",
      }));
    onImport(records);
    setImporting(false);
    setDone(`${records.length} participant${records.length !== 1 ? "s" : ""} imported from Wikipedia.`);
    setPreview(null);
    setSelected(new Set());
  };

  // ── OD CSV ─────────────────────────────────────────────────────────────────
  const handleCSVFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOdErr(""); setOdPreview(null); setDone("");
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseODCSV(ev.target.result);
        setOdPreview(rows);
      } catch (err) {
        setOdErr(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importOD = () => {
    if (!odPreview?.length) return;
    setImporting(true);
    const now = new Date().toISOString();
    const existing = new Set(
      existingParticipants.map(p => (p.wikimediaUsername || "").toLowerCase()).filter(Boolean)
    );
    const toAdd = odPreview.filter(r => !existing.has(r.username.toLowerCase()));
    const records = toAdd.map(r => ({
      id: uid(),
      name: r.realName || r.username,
      wikimediaUsername: r.username,
      email: "", phone: "", gender: "", age: "",
      region: "", district: "", organization: "",
      programIds: [],
      importedFrom: "outreach-dashboard",
      importedAt: now,
      source: "outreach-dashboard",
      odStats: {
        articlesCreated: r.articlesCreated,
        articlesEdited:  r.articlesEdited,
        filesUploaded:   r.filesUploaded,
        refsAdded:       r.refsAdded,
        bytesAdded:      r.bytesAdded,
        totalEdits:      r.totalEdits,
      },
    }));
    onImport(records);
    setImporting(false);
    setOdPreview(null);
    setDone(`${records.length} participant${records.length !== 1 ? "s" : ""} imported from Outreach Dashboard (${odPreview.length - records.length} already existed).`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#f9f9f7", border: "1.5px solid #4a9e6b44", borderRadius: 11, padding: 20, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#1c2b1e", marginBottom: 4 }}>
        Import participants
        {activityName && <span style={{ fontWeight: 400, color: "#888", fontSize: 12, marginLeft: 8 }}>for: {activityName}</span>}
      </div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 14, lineHeight: 1.5 }}>
        Pull in participant usernames automatically — no manual transcription.
        Wikipedia event registration and OD edit-tracking stay as-is; this just brings the data here.
      </div>

      {/* Tab switcher */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        <button className={`tab-btn ${tab === "wiki" ? "tab-active" : ""}`} onClick={() => { setTab("wiki"); setDone(""); }}>
          📥 Wikipedia Event page
        </button>
        <button className={`tab-btn ${tab === "od" ? "tab-active" : ""}`} onClick={() => { setTab("od"); setDone(""); }}>
          📊 Outreach Dashboard CSV
        </button>
      </div>

      {done && (
        <div style={{ background: "#e8f5ec", border: "1px solid #4a9e6b44", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#2d7a4f", fontWeight: 500, marginBottom: 14 }}>
          ✓ {done}
        </div>
      )}

      {/* ── Wikipedia tab ── */}
      {tab === "wiki" && (
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10, lineHeight: 1.6 }}>
            Paste the URL of your Wikipedia Event page. We'll extract all usernames linked on that page
            (organisers + participants who signed up by editing the page).
            <br />
            <span style={{ color: "#d97706" }}>
              ⚠ Participants who clicked the on-page "Register" button without editing the page cannot be fetched — Wikipedia doesn't expose that data publicly.
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={wikiUrl}
              onChange={e => { setWikiUrl(e.target.value); setPreview(null); setFetchErr(""); }}
              placeholder="https://sw.wikipedia.org/wiki/Event:..."
              style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
              onKeyDown={e => e.key === "Enter" && fetchWiki()}
            />
            <button className="btn btn-primary" onClick={fetchWiki} disabled={fetching}>
              {fetching ? "Fetching…" : "Fetch →"}
            </button>
          </div>

          {fetchErr && (
            <div style={{ color: "#c0392b", fontSize: 13, background: "#fdf0ee", padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>{fetchErr}</div>
          )}

          {preview && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#1c2b1e" }}>
                Found {preview.participants.length} user{preview.participants.length !== 1 ? "s" : ""} on: <span style={{ fontWeight: 400, color: "#555" }}>{preview.pageTitle}</span>
              </div>

              {preview.participants.length === 0 ? (
                <div style={{ fontSize: 13, color: "#888", padding: "10px 0" }}>
                  No user links found on this page. The event page may only have participants registered via the WEP button (not editable by API), or this isn't an event page.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button className="btn btn-sm" onClick={() => setSelected(new Set(preview.participants.map(p => p.username)))}>Select all</button>
                    <button className="btn btn-sm" onClick={() => setSelected(new Set())}>Deselect all</button>
                    <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>
                      {selected.size} selected
                    </span>
                  </div>

                  <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e8e8e4", borderRadius: 7 }}>
                    {preview.participants.map(p => {
                      const alreadyExists = existingParticipants.some(
                        ex => (ex.wikimediaUsername || "").toLowerCase() === p.username.toLowerCase()
                      );
                      return (
                        <label key={p.username} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                          borderBottom: "1px solid #f0f0ec", cursor: alreadyExists ? "default" : "pointer",
                          background: alreadyExists ? "#f8f8f6" : selected.has(p.username) ? "#f0faf4" : "#fff",
                        }}>
                          <input
                            type="checkbox"
                            checked={selected.has(p.username)}
                            onChange={() => !alreadyExists && toggleSelect(p.username)}
                            disabled={alreadyExists}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 13, color: alreadyExists ? "#aaa" : "#1c2b1e" }}>
                              {p.displayName}
                            </div>
                            <div style={{ fontSize: 11, color: "#888" }}>
                              Wikipedia: <span style={{ fontFamily: "monospace" }}>{p.username}</span>
                              {alreadyExists && <span style={{ color: "#4a9e6b", marginLeft: 8 }}>✓ already in registry</span>}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <button
                      className="btn btn-primary"
                      onClick={importWiki}
                      disabled={selected.size === 0 || importing}
                    >
                      {importing ? "Importing…" : `Import ${selected.size} participant${selected.size !== 1 ? "s" : ""}`}
                    </button>
                    <span style={{ fontSize: 11, color: "#aaa", marginLeft: 12 }}>
                      Imported participants will be added to the Participants registry. You can add gender, phone, etc. from there.
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── OD CSV tab ── */}
      {tab === "od" && (
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 12, lineHeight: 1.6 }}>
            Export your participants from the Outreach Dashboard, then upload the CSV here.
            <br />
            <strong>How to export from OD:</strong> Go to your campaign → Courses tab → click a course → scroll to Editors table → "Download CSV".
            <br />
            Edit counts and article stats are imported automatically.
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
              📂 Choose OD export CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv" style={{ display: "none" }} onChange={handleCSVFile} />
          </div>

          {odErr && (
            <div style={{ color: "#c0392b", fontSize: 13, background: "#fdf0ee", padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>{odErr}</div>
          )}

          {odPreview && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
                {odPreview.length} editor{odPreview.length !== 1 ? "s" : ""} found in CSV
              </div>

              <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e8e8e4", borderRadius: 7 }}>
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f5f4f0" }}>
                      <th>Wikipedia username</th><th>Real name</th>
                      <th>Articles created</th><th>Articles edited</th>
                      <th>Files uploaded</th><th>Total edits</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {odPreview.map(r => {
                      const exists = existingParticipants.some(
                        p => (p.wikimediaUsername || "").toLowerCase() === r.username.toLowerCase()
                      );
                      return (
                        <tr key={r.username} style={{ background: exists ? "#f8f8f6" : "#fff" }}>
                          <td style={{ fontFamily: "monospace", color: exists ? "#aaa" : "#1c2b1e" }}>{r.username}</td>
                          <td style={{ color: exists ? "#aaa" : "#333" }}>{r.realName || "—"}</td>
                          <td>{r.articlesCreated || "—"}</td>
                          <td>{r.articlesEdited || "—"}</td>
                          <td>{r.filesUploaded || "—"}</td>
                          <td>{r.totalEdits || "—"}</td>
                          <td>
                            {exists
                              ? <span style={{ fontSize: 10, color: "#4a9e6b" }}>✓ exists</span>
                              : <span style={{ fontSize: 10, color: "#2563eb" }}>new</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <button className="btn btn-primary" onClick={importOD} disabled={importing}>
                  {importing ? "Importing…" : `Import ${odPreview.filter(r => !existingParticipants.some(p => (p.wikimediaUsername || "").toLowerCase() === r.username.toLowerCase())).length} new participants`}
                </button>
                <span style={{ fontSize: 11, color: "#888" }}>
                  Existing participants will be skipped. OD edit stats are saved on each record.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
