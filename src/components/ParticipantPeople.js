import React, { useEffect, useMemo, useState } from "react";
import { groupPeople } from "../utils/participantPeople";
import { checkUsernames, normalizeUsername } from "../utils/wikiContribs";
import { deleteParticipant } from "../services/participantService";
import { batchWrite } from "../firebase/firestore";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

// "People" view of the Participants registry: one row per person (records with
// the same Wikipedia username, ignoring capitals), returning editors, and tools
// to give every record of a person the same neat name and username.
export default function ParticipantPeople({ participants, programs, forms, search = "", canEdit, profile, showToast }) {
  const grouped = useMemo(() => groupPeople(participants), [participants]);
  // Wikipedia usernames are case-sensitive after the first letter, so when a
  // person's username was typed in different ways, ask Swahili Wikipedia which
  // spelling really exists and use that one.
  const [onWiki, setOnWiki] = useState({});   // normalized spelling → true (exists) / false
  const ambiguous = useMemo(() => [...new Set(grouped
    .filter(p => new Set(p.usernameVariants.map(normalizeUsername)).size > 1)
    .flatMap(p => p.usernameVariants.map(normalizeUsername)))], [grouped]);
  useEffect(() => {
    const todo = ambiguous.filter(u => onWiki[u] === undefined);
    if (!todo.length) return;
    let alive = true;
    checkUsernames(todo, "sw.wikipedia.org")
      .then(({ found, missing }) => {
        if (!alive) return;
        setOnWiki(prev => ({ ...prev, ...Object.fromEntries(found.map(u => [u, true])), ...Object.fromEntries(missing.map(u => [u, false])) }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [ambiguous, onWiki]);
  const people = useMemo(() => grouped.map(p => {
    const spellings = [...new Set(p.usernameVariants.map(normalizeUsername))];
    if (spellings.length < 2) return p;
    const real = spellings.filter(u => onWiki[u] === true);
    const checked = spellings.every(u => onWiki[u] !== undefined);
    const username = real.length === 1 ? real[0] : p.username;
    const usernameNote = !checked ? "Checking Wikipedia…"
      : real.length === 1 ? "Checked on Wikipedia"
      : real.length > 1 ? `${real.length} different accounts exist — check by hand`
      : "None of the spellings exists on Swahili Wikipedia";
    const needsFix = p.records.some(r => String(r.name || "").trim() !== p.name)
      || p.records.some(r => r.wikimediaUsername && String(r.wikimediaUsername).trim() !== username);
    return { ...p, username, usernameNote, usernameSure: real.length === 1, needsFix: needsFix && (real.length === 1 || p.records.some(r => String(r.name || "").trim() !== p.name)) };
  }), [grouped, onWiki]);
  const [onlyFix, setOnlyFix] = useState(false);
  const [onlyReturning, setOnlyReturning] = useState(false);
  const [editing, setEditing] = useState(null);   // { key, name, username }
  const [busy, setBusy] = useState(false);

  const eventName = (r) => forms.find(f => f.id === (r.formId || r.registeredViaForm))?.title
    || programs.find(p => p.id === r.programId)?.name || "";
  const q = search.toLowerCase();
  const shown = people.filter(p =>
    (!onlyFix || p.needsFix || p.sameEventDuplicates.length)
    && (!onlyReturning || p.returning)
    && (!q || [p.name, p.username, ...p.nameVariants, ...p.records.map(r => r.email)].join(" ").toLowerCase().includes(q)));
  const toFix = people.filter(p => p.needsFix);
  const dupCount = people.reduce((s, p) => s + p.sameEventDuplicates.reduce((n, l) => n + l.length - 1, 0), 0);
  const returning = people.filter(p => p.returning).length;

  // Every record of the person gets the same name and username.
  // (A username typed in different ways is only changed once Wikipedia confirmed which one exists.)
  const safeUsername = (p) => (p.usernameNote && !p.usernameSure ? "" : p.username);
  const fixOps = (p, name = p.name, username = safeUsername(p)) => p.records
    .filter(r => String(r.name || "").trim() !== name || (username && String(r.wikimediaUsername || "").trim() !== username))
    .map(r => ({ type: "update", path: "participants", id: r.id, data: { name, ...(username ? { wikimediaUsername: username } : {}) } }));

  const run = async (ops, label) => {
    setBusy(true);
    try {
      for (let i = 0; i < ops.length; i += 400) await batchWrite(ops.slice(i, i + 400));
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "participants", { recordTitle: label, details: `${label}: ${ops.length} records updated` });
      showToast(`${ops.length} record${ops.length === 1 ? "" : "s"} updated.`);
    } catch (e) {
      alert(`Could not update: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const fixAll = async () => {
    const ops = toFix.flatMap(p => fixOps(p));
    if (!ops.length) return;
    if (!window.confirm(`Give ${toFix.length} people one name and username on all their records (${ops.length} records)? The names chosen are shown in the table.`)) return;
    await run(ops, "Fixed participant name spellings");
  };

  const saveEdit = async (p) => {
    const name = editing.name.replace(/\s+/g, " ").trim();
    const username = editing.username.replace(/\s+/g, " ").trim();
    if (!name) { alert("The name can't be empty."); return; }
    const ops = fixOps(p, name, username);
    setEditing(null);
    if (ops.length) await run(ops, `Fixed participant ${name}`);
  };

  const removeDuplicates = async (p) => {
    const extra = p.sameEventDuplicates.flatMap(list => list.slice(1));
    if (!window.confirm(`${p.name} is in the same event more than once. Delete ${extra.length} extra record${extra.length === 1 ? "" : "s"} and keep the first? This can't be undone.`)) return;
    setBusy(true);
    try {
      for (const r of extra) await deleteParticipant(r.id);
      await addAudit(profile, AUDIT_ACTIONS.DELETE, "participants", { recordTitle: p.name, details: `Removed ${extra.length} duplicate record(s) in the same event` });
      showToast(`Removed ${extra.length} duplicate record${extra.length === 1 ? "" : "s"}.`);
    } catch (e) {
      alert(`Could not remove: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="card-grid" style={{ marginBottom: 12 }}>
        {[
          ["Records (sign-ups)", participants.length, "#1c2b1e"],
          ["Different people", people.length, "#2d7a4f"],
          ["Returning (2+ events)", returning, "#2563eb"],
          ["Names to fix", toFix.length, toFix.length ? "#d97706" : "#888"],
          ["Same event twice", dupCount, dupCount ? "#c0392b" : "#888"],
        ].map(([label, value, color]) => (
          <div key={label} className="stat-card"><div className="stat-label">{label}</div><div className="stat-value" style={{ color }}>{value}</div></div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <button className={`btn btn-sm ${onlyFix ? "btn-primary" : ""}`} onClick={() => setOnlyFix(v => !v)}>Only people to fix</button>
        <button className={`btn btn-sm ${onlyReturning ? "btn-primary" : ""}`} onClick={() => setOnlyReturning(v => !v)}>Only returning</button>
        {canEdit && toFix.length > 0 && (
          <button className="btn btn-sm btn-primary" onClick={fixAll} disabled={busy}>✎ Fix all spellings ({toFix.length})</button>
        )}
        <span style={{ fontSize: 12, color: "#888" }}>
          Records with the same Wikipedia username are one person (capital letters, spaces/underscores and "User:" ignored); without a username, the same email or name.
        </span>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {shown.length === 0 ? <div className="empty">{people.length ? "Nobody matches." : "No participants yet."}</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Name</th><th>Wikipedia username</th><th>Events</th><th>Status</th>{canEdit && <th>Actions</th>}</tr></thead>
              <tbody>
                {shown.map(p => (
                  <tr key={p.key}>
                    <td style={{ minWidth: 200 }}>
                      {editing?.key === p.key ? (
                        <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={{ fontSize: 13, width: "100%" }} />
                      ) : <strong>{p.name}</strong>}
                      {p.nameVariants.length > 1 && (
                        <div style={{ fontSize: 11, color: "#d97706" }}>Typed as: {p.nameVariants.join(" · ")}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {editing?.key === p.key ? (
                        <input value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} style={{ fontSize: 12, width: "100%" }}
                          autoComplete="off" autoCapitalize="none" spellCheck={false} />
                      ) : p.username ? (
                        <a href={`https://sw.wikipedia.org/wiki/Special:Contributions/${encodeURIComponent(p.username.replace(/ /g, "_"))}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{p.username}</a>
                      ) : <span style={{ color: "#aaa" }}>none</span>}
                      {p.usernameVariants.length > 1 && <div style={{ fontSize: 11, color: "#d97706" }}>Typed as: {p.usernameVariants.join(" · ")}</div>}
                      {p.usernameNote && <div style={{ fontSize: 11, color: p.usernameSure ? "#2d7a4f" : "#c0392b" }}>{p.usernameSure ? "✓ " : "⚠ "}{p.usernameNote}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <strong>{p.events}</strong>
                      <div style={{ color: "#888" }}>{[...new Set(p.records.map(eventName).filter(Boolean))].join(", ")}</div>
                    </td>
                    <td>
                      {p.returning && <span className="badge badge-blue" style={{ marginRight: 4 }} title="Took part in 2 or more events">Returning</span>}
                      {p.isNew && <span className="badge badge-green" style={{ marginRight: 4 }} title="Had never edited Wikipedia at their first event">New editor</span>}
                      {p.sameEventDuplicates.length > 0 && <span className="badge badge-red" title="Entered twice for the same event">Same event twice</span>}
                    </td>
                    {canEdit && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        {editing?.key === p.key ? (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={() => saveEdit(p)} disabled={busy}>Save to {p.records.length}</button>{" "}
                            <button className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            {p.needsFix && <button className="btn btn-sm btn-primary" onClick={() => run(fixOps(p), `Fixed participant ${p.name}`)} disabled={busy} title="Use this name and username on all their records">Fix</button>}{" "}
                            <button className="btn btn-sm" onClick={() => setEditing({ key: p.key, name: p.name, username: p.username })}>✎</button>{" "}
                            {p.sameEventDuplicates.length > 0 && <button className="btn btn-sm btn-danger" onClick={() => removeDuplicates(p)} disabled={busy}>Remove duplicate</button>}
                          </>
                        )}
                      </td>
                    )}
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
