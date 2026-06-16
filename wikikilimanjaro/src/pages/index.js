import React, { useState } from "react";
import { fmt, pct, PROGRAM_CATS, MS_OPTIONS, compileGrantReport } from "../utils/helpers";

// ─── Metrics ──────────────────────────────────────────────────────────────────
export function Metrics({ state, update }) {
  const [saved, setSaved] = useState(false);
  const m = state.metrics;

  const setM = (key, field, val) => {
    const metrics = { ...m, [key]: { ...m[key], [field]: Number(val) || 0 } };
    update({ metrics });
  };

  const setP = (i, field, val) => {
    const projects = m.projects.map((p, idx) => idx === i ? { ...p, [field]: Number(val) || 0 } : p);
    update({ metrics: { ...m, projects } });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const rows = [
    { key: "participants", label: "All participants" },
    { key: "allEditors", label: "All editors" },
    { key: "newEditors", label: "New editors" },
    { key: "retainedEditors", label: "Retained editors" },
    { key: "allOrganizers", label: "All organizers" },
    { key: "newOrganizers", label: "New organizers" },
  ];

  return (
    <div>
      <div className="page-title">Metrics</div>
      <div className="page-sub">Set targets when applying. Update results as activities happen.</div>
      <div className="alert alert-info">Both target and result values are used to auto-generate your final report.</div>

      <div className="panel">
        <div className="panel-title">Participants & editors</div>
        <table>
          <thead><tr><th>Metric</th><th>Target</th><th>Result</th><th>% achieved</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const val = m[r.key];
              const p = pct(val.result, val.target);
              const col = p >= 100 ? "badge-green" : p >= 60 ? "badge-amber" : "badge-gray";
              return (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td><input type="number" defaultValue={val.target} onBlur={(e) => setM(r.key, "target", e.target.value)} style={{ width: 90 }} /></td>
                  <td><input type="number" defaultValue={val.result} onBlur={(e) => { setM(r.key, "result", e.target.value); setSaved(true); setTimeout(() => setSaved(false), 1500); }} style={{ width: 90 }} /></td>
                  <td><span className={`badge ${col}`}>{p}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-title">Wikimedia project contributions</div>
        <table>
          <thead>
            <tr><th>Project</th><th>Target created</th><th>Target improved</th><th>Result created</th><th>Result improved</th></tr>
          </thead>
          <tbody>
            {m.projects.map((p, i) => (
              <tr key={p.name}>
                <td><strong>{p.name}</strong></td>
                <td><input type="number" defaultValue={p.tCreated} onBlur={(e) => setP(i, "tCreated", e.target.value)} style={{ width: 85 }} /></td>
                <td><input type="number" defaultValue={p.tImproved} onBlur={(e) => setP(i, "tImproved", e.target.value)} style={{ width: 85 }} /></td>
                <td><input type="number" defaultValue={p.rCreated} onBlur={(e) => setP(i, "rCreated", e.target.value)} style={{ width: 85 }} /></td>
                <td><input type="number" defaultValue={p.rImproved} onBlur={(e) => setP(i, "rImproved", e.target.value)} style={{ width: 85 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saved && <div className="alert alert-success">Metrics saved!</div>}
    </div>
  );
}

// ─── Budget ───────────────────────────────────────────────────────────────────
export function Budget({ state, update }) {
  const b = state.budget;
  const totalSpent = Object.values(b.spent).reduce((a, v) => a + v, 0);
  const cats = [
    { key: "personnel", label: "Personnel costs" },
    { key: "operational", label: "Operational costs" },
    { key: "programmatic", label: "Programmatic costs" },
  ];
  const [expCat, setExpCat] = useState("Programmatic costs");
  const [expAmt, setExpAmt] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expDate, setExpDate] = useState("");

  const addExpense = () => {
    const amt = Number(expAmt) || 0;
    if (!amt) { alert("Enter an amount."); return; }
    const key = expCat.includes("Personnel") ? "personnel" : expCat.includes("Operational") ? "operational" : "programmatic";
    const expenses = [...(b.expenses || []), { cat: expCat, amount: amt, desc: expDesc, date: expDate || new Date().toISOString().slice(0, 10) }];
    const spent = { ...b.spent, [key]: b.spent[key] + amt };
    update({ budget: { ...b, expenses, spent } });
    setExpAmt(""); setExpDesc(""); setExpDate("");
  };

  const delExpense = (i) => {
    const e = b.expenses[i];
    const key = e.cat.includes("Personnel") ? "personnel" : e.cat.includes("Operational") ? "operational" : "programmatic";
    const expenses = b.expenses.filter((_, idx) => idx !== i);
    const spent = { ...b.spent, [key]: Math.max(0, b.spent[key] - e.amount) };
    update({ budget: { ...b, expenses, spent } });
  };

  return (
    <div>
      <div className="page-title">Budget</div>
      <div className="page-sub">Track planned vs actual spending in TZS.</div>

      <div className="card-grid">
        <div className="stat-card"><div className="stat-label">Total grant (TZS)</div><div className="stat-value blue">{fmt(b.total)}</div></div>
        <div className="stat-card"><div className="stat-label">Total spent</div><div className="stat-value amber">{fmt(totalSpent)}</div></div>
        <div className="stat-card"><div className="stat-label">Remaining</div><div className="stat-value" style={{ color: b.total - totalSpent < 0 ? "#c0392b" : "#2d7a4f" }}>{fmt(b.total - totalSpent)}</div></div>
        <div className="stat-card"><div className="stat-label">% used</div><div className="stat-value" style={{ color: pct(totalSpent, b.total) > 100 ? "#c0392b" : "#b06a00" }}>{pct(totalSpent, b.total)}%</div></div>
      </div>

      <div className="panel">
        <div className="panel-title">Category breakdown</div>
        <table>
          <thead><tr><th>Category</th><th>Planned (TZS)</th><th>Spent (TZS)</th><th>Balance</th><th>% used</th></tr></thead>
          <tbody>
            {cats.map((c) => {
              const bal = b.planned[c.key] - b.spent[c.key];
              const p = pct(b.spent[c.key], b.planned[c.key]);
              return (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td>
                    <input type="number" defaultValue={b.planned[c.key]}
                      onBlur={(e) => update({ budget: { ...b, planned: { ...b.planned, [c.key]: Number(e.target.value) || 0 } } })}
                      style={{ width: 130 }} />
                  </td>
                  <td style={{ fontWeight: 500 }}>{fmt(b.spent[c.key])}</td>
                  <td style={{ color: bal < 0 ? "#c0392b" : "#2d7a4f", fontWeight: 500 }}>{fmt(bal)}</td>
                  <td><span className={`badge ${p > 100 ? "badge-red" : p > 85 ? "badge-amber" : "badge-green"}`}>{p}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-title">Log an expense</div>
        <div className="form-grid">
          <div className="field">
            <label>Category</label>
            <select value={expCat} onChange={(e) => setExpCat(e.target.value)}>
              {cats.map((c) => <option key={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Amount (TZS) <span className="req">★</span></label>
            <input type="number" value={expAmt} onChange={(e) => setExpAmt(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Description</label>
            <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="e.g. Venue hire, editathon #8" />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={addExpense}>+ Log expense</button>
      </div>

      <div className="panel">
        <div className="panel-title">Expense log ({(b.expenses || []).length})</div>
        {(b.expenses || []).length === 0 ? (
          <div className="empty">No expenses logged yet.</div>
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount (TZS)</th><th></th></tr></thead>
            <tbody>
              {(b.expenses || []).map((e, i) => (
                <tr key={i}>
                  <td>{e.date}</td>
                  <td><span className="badge badge-blue">{e.cat}</span></td>
                  <td>{e.desc}</td>
                  <td>{fmt(e.amount)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => delExpense(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Application ──────────────────────────────────────────────────────────────
export function Application({ state, update }) {
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const a = state.application;
  const setA = (k, v) => update({ application: { ...a, [k]: v } });

  const toggleCat = (c) => {
    const cats = a.categories.includes(c) ? a.categories.filter((x) => x !== c) : [...a.categories, c];
    setA("categories", cats);
  };
  const toggleMS = (c) => {
    const ms = a.movementStrategy.includes(c) ? a.movementStrategy.filter((x) => x !== c) : [...a.movementStrategy, c];
    setA("movementStrategy", ms);
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div>
      <div className="page-title">Grant application</div>
      <div className="page-sub">Fill once per grant cycle. All fields carry into your final report.</div>
      <div className="alert alert-info">Required fields marked ★. This matches the Wikimedia GSF application form exactly.</div>

      {/* Org */}
      <div className="panel">
        <div className="panel-title">Applicant information</div>
        <div className="form-grid">
          <div className="field"><label>Organisation name <span className="req">★</span></label>
            <input value={state.org.name} onChange={(e) => update({ org: { ...state.org, name: e.target.value } })} /></div>
          <div className="field"><label>Country <span className="req">★</span></label>
            <input value={state.org.country} onChange={(e) => update({ org: { ...state.org, country: e.target.value } })} /></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Applying as <span className="req">★</span></label>
            <select value={state.org.type} onChange={(e) => update({ org: { ...state.org, type: e.target.value } })}>
              <option>Wikimedia User Group</option><option>Wikimedia Chapter</option>
              <option>Thematic Organization</option><option>Individual</option>
            </select></div>
          <div className="field"><label>Previous GSF grant? <span className="req">★</span></label>
            <select value={a.hasPreviousGrant} onChange={(e) => setA("hasPreviousGrant", e.target.value)}>
              <option>Yes</option><option>No</option>
            </select></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Organisation website</label>
            <input value={state.org.website} onChange={(e) => update({ org: { ...state.org, website: e.target.value } })} placeholder="https://..." /></div>
          <div className="field"><label>Meta-Wiki / annual plan link</label>
            <input value={state.org.metaPage} onChange={(e) => update({ org: { ...state.org, metaPage: e.target.value } })} /></div>
        </div>
        <div className="field"><label>Conflict of interest declaration <span className="req">★</span></label>
          <select value={a.coiDeclaration} onChange={(e) => setA("coiDeclaration", e.target.value)}>
            <option>No conflicts of interest</option>
            <option>Yes — disclosure details in additional info</option>
          </select></div>
      </div>

      {/* Proposal */}
      <div className="panel">
        <div className="panel-title">Main proposal</div>
        <div className="form-grid one">
          <div className="field"><label>Proposal title <span className="req">★</span></label>
            <input value={a.title} onChange={(e) => setA("title", e.target.value)} /></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Start date <span className="req">★</span></label>
            <input type="date" value={a.startDate} onChange={(e) => setA("startDate", e.target.value)} /></div>
          <div className="field"><label>End date <span className="req">★</span></label>
            <input type="date" value={a.endDate} onChange={(e) => setA("endDate", e.target.value)} /></div>
        </div>
        <div className="form-grid one">
          <div className="field"><label>Implementation location <span className="req">★</span></label>
            <input value={a.location} onChange={(e) => setA("location", e.target.value)} /></div>
        </div>
        <div className="form-grid one">
          <div className="field"><label>Programs, approaches & strategies <span className="req">★</span></label>
            <textarea rows={10} value={a.programs} onChange={(e) => setA("programs", e.target.value)} /></div>
        </div>
        <div className="field"><label>Program categories <span className="req">★</span></label>
          <div className="chip-group">
            {PROGRAM_CATS.map((c) => (
              <div key={c} className={`chip ${a.categories.includes(c) ? "on" : ""}`} onClick={() => toggleCat(c)}>{c}</div>
            ))}
          </div>
        </div>
        <hr className="sep" />
        <div className="form-grid one">
          <div className="field"><label>Team description <span className="req">★</span></label>
            <textarea rows={5} value={a.team} onChange={(e) => setA("team", e.target.value)} /></div>
        </div>
        <div className="form-grid one">
          <div className="field"><label>Partners <span className="req">★</span></label>
            <textarea rows={5} value={a.partners} onChange={(e) => setA("partners", e.target.value)} /></div>
        </div>
        <div className="field"><label>Movement Strategy 2030 contributions <span className="req">★</span></label>
          <div className="chip-group">
            {MS_OPTIONS.map((c) => (
              <div key={c} className={`chip ${a.movementStrategy.includes(c) ? "on" : ""}`} onClick={() => toggleMS(c)}>{c}</div>
            ))}
          </div>
        </div>
        <div className="form-grid one">
          <div className="field"><label>Additional information (optional)</label>
            <textarea rows={3} value={a.additionalInfo} onChange={(e) => setA("additionalInfo", e.target.value)} placeholder="Any other context..." /></div>
        </div>
      </div>

      {saved && <div className="alert alert-success">Application saved!</div>}
      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleSave}>Save application</button>
        <button className="btn" onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Hide" : "Preview"} as text</button>
      </div>

      {showPreview && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-title">Application preview (paste into Fluxx)</div>
          {[
            { title: "Organisation & applicant info", text: `Organisation: ${state.org.name}\nCountry: ${state.org.country}\nType: ${state.org.type}\nPrevious grant: ${a.hasPreviousGrant}\nCOI: ${a.coiDeclaration}` },
            { title: "Proposal title & dates", text: `Title: ${a.title}\nStart: ${a.startDate}\nEnd: ${a.endDate}\nLocation: ${a.location}` },
            { title: "Programs, approaches & strategies (Q8)", text: a.programs },
            { title: "Program categories (Q9)", text: a.categories.join(", ") },
            { title: "Team (Q11)", text: a.team },
            { title: "Partners (Q12)", text: a.partners },
            { title: "Movement Strategy (Q13)", text: a.movementStrategy.join(", ") },
          ].map((s) => (
            <div className="report-block" key={s.title}>
              <h4>{s.title}</h4>
              <pre>{s.text}</pre>
              <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => { navigator.clipboard.writeText(s.text); }}>Copy</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Final Report ──────────────────────────────────────────────────────────────
export function FinalReport({ state }) {
  const r = compileGrantReport(state);
  const sections = [
    { key: "part1q1", title: "Part 1, Q1 — Programs, approaches and challenges" },
    { key: "part1q2", title: "Part 1, Q2 — Plans to build on successes" },
    { key: "part2metrics", title: "Part 2 — Metrics summary" },
    { key: "part3skills", title: "Part 3 — Skill development" },
    { key: "part4finance", title: "Part 4 — Financial report" },
  ];

  const copyAll = () => {
    const text = sections.map((s) => `${s.title}\n${"─".repeat(40)}\n${r[s.key]}`).join("\n\n");
    navigator.clipboard.writeText(text);
    alert("Full report copied to clipboard!");
  };

  const downloadAll = () => {
    const text = sections.map((s) => `${s.title}\n${"═".repeat(50)}\n${r[s.key]}\n`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `GSF-Final-Report-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-title">Final learning report</div>
      <div className="page-sub">Auto-generated from your activities, metrics, and budget. Copy each section into Wikimedia Fluxx.</div>
      <div className="alert alert-success">All sections below are built from your logged data. Copy them directly into the report form.</div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={downloadAll}>↓ Download full report (.txt)</button>
        <button className="btn" onClick={copyAll}>Copy all sections</button>
      </div>

      {sections.map((s) => (
        <div className="report-block" key={s.key}>
          <h4>{s.title}</h4>
          <pre>{r[s.key]}</pre>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(r[s.key]); }}>
            Copy this section
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function Settings({ state, update }) {
  const [resetDone, setResetDone] = useState(false);
  const o = state.org;

  return (
    <div>
      <div className="page-title">Settings</div>
      <div className="page-sub">Organisation details and grant configuration.</div>

      <div className="panel">
        <div className="panel-title">Organisation</div>
        <div className="form-grid">
          <div className="field"><label>Organisation name</label>
            <input value={o.name} onChange={(e) => update({ org: { ...o, name: e.target.value } })} /></div>
          <div className="field"><label>Grant ID</label>
            <input value={o.grantId} onChange={(e) => update({ org: { ...o, grantId: e.target.value } })} /></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Grant cycle label</label>
            <input value={o.grantCycle} onChange={(e) => update({ org: { ...o, grantCycle: e.target.value } })} placeholder="e.g. 2025–2026" /></div>
          <div className="field"><label>Contact email</label>
            <input value={o.contactEmail} onChange={(e) => update({ org: { ...o, contactEmail: e.target.value } })} placeholder="you@example.com" /></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Total grant amount (TZS)</label>
            <input type="number" value={state.budget.total} onChange={(e) => update({ budget: { ...state.budget, total: Number(e.target.value) || 0 } })} /></div>
          <div className="field"><label>Currency</label>
            <input value={state.budget.currency} onChange={(e) => update({ budget: { ...state.budget, currency: e.target.value } })} /></div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Data management</div>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>All data is saved automatically in your browser's local storage. Export a backup before resetting.</p>
        <div className="btn-row">
          <button className="btn" onClick={() => {
            const json = JSON.stringify(state, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `wkgsf-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click(); URL.revokeObjectURL(url);
          }}>↓ Export backup (JSON)</button>
          <button className="btn btn-danger" onClick={() => {
            if (window.confirm("Reset ALL data? This cannot be undone.")) {
              localStorage.clear(); window.location.reload();
            }
          }}>Reset all data</button>
        </div>
        {resetDone && <div className="alert alert-success" style={{ marginTop: 10 }}>Data exported!</div>}
      </div>
    </div>
  );
}
