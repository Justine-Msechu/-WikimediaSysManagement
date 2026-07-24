import React, { useState } from "react";
import { parseTimelineWorkbook, suggestProgramMatch } from "../utils/timelineImport";
import { addProgram, updateProgram } from "../services/programService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { monthLabel } from "../data/plannedTimeline";

const PROGRAM_COLORS = ["#2d7a4f", "#2563eb", "#9333ea", "#d97706", "#0891b2", "#c0392b", "#059669", "#7c3aed", "#db2777"];

const SKIP = "__skip__";
const NEW  = "__new__";

export default function ImportTimelineModal({ profile, grantId, programs, onClose, onImported }) {
  const [step,     setStep]     = useState("pick"); // pick | preview | importing | done
  const [error,    setError]    = useState("");
  const [parsed,   setParsed]   = useState(null);
  const [mapped,   setMapped]   = useState([]);
  const [fileName, setFileName] = useState("");

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseTimelineWorkbook(ev.target.result);
        setParsed(result);
        setMapped(result.rows.map(r => ({
          ...r,
          include: true,
          targetId: suggestProgramMatch(r.programName, programs)?.id || NEW,
        })));
        setStep("preview");
      } catch (err) {
        setError(err.message || "Could not read this file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggle = (i) => setMapped(m => m.map((r, idx) => idx === i ? { ...r, include: !r.include } : r));
  const setTarget = (i, targetId) => setMapped(m => m.map((r, idx) => idx === i ? { ...r, targetId } : r));

  const runImport = async () => {
    setStep("importing");
    try {
      let created = 0, updated = 0;
      for (const row of mapped.filter(r => r.include && r.targetId !== SKIP)) {
        if (row.targetId === NEW) {
          const id = await addProgram({
            name: row.programName, category: "Other", color: PROGRAM_COLORS[created % PROGRAM_COLORS.length],
            description: "", plannedSessions: row.months.length, budgetItems: [],
            plannedMonths: row.months, grantId: grantId || "",
          });
          await addAudit(profile, AUDIT_ACTIONS.IMPORT, "programs", { targetId: id, recordTitle: row.programName, details: "Created from timeline template" });
          created++;
        } else {
          const target = programs.find(p => p.id === row.targetId);
          await updateProgram(row.targetId, { plannedMonths: row.months });
          await addAudit(profile, AUDIT_ACTIONS.IMPORT, "programs", { targetId: row.targetId, recordTitle: target?.name || row.programName, details: "Planned schedule updated from timeline template" });
          updated++;
        }
      }
      setStep("done");
      onImported({ created, updated });
    } catch (err) {
      setError(err.message || "Import failed.");
      setStep("preview");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 760, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1c2b1e" }}>Import timeline (Excel)</div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        {step === "pick" && (
          <div>
            <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
              Upload the timeline workbook (a "Timeline" sheet with program names down the first column
              and months across the header row — mark a cell with an "X" for each planned month). This
              sets the planned schedule used by the "Planned vs actual" comparison below.
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={onFile} />
            {error && <div style={{ marginTop: 12, fontSize: 13, color: "#c0392b" }}>{error}</div>}
          </div>
        )}

        {step === "preview" && parsed && (
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
              Parsed from <strong>{fileName}</strong> — {parsed.monthKeys.length} month columns, {mapped.length} program row(s).
              Match each row to a program, or create a new one. Uncheck anything you don't want imported.
            </div>

            <div style={{ overflowX: "auto", marginBottom: 18 }}>
              <table style={{ fontSize: 12, width: "100%" }}>
                <thead><tr><th></th><th>From file</th><th>Planned months</th><th>Maps to</th></tr></thead>
                <tbody>
                  {mapped.map((row, i) => (
                    <tr key={i} style={{ opacity: row.include ? 1 : 0.4 }}>
                      <td><input type="checkbox" checked={row.include} onChange={() => toggle(i)} /></td>
                      <td style={{ fontWeight: 500 }}>{row.programName}</td>
                      <td style={{ color: "#555" }}>{row.months.map(monthLabel).join(", ") || "—"}</td>
                      <td>
                        <select value={row.targetId} onChange={(e) => setTarget(i, e.target.value)} disabled={!row.include}>
                          <option value={NEW}>+ Create new program</option>
                          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          <option value={SKIP}>Skip this row</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <div style={{ marginBottom: 12, fontSize: 13, color: "#c0392b" }}>{error}</div>}

            <div className="btn-row">
              <button className="btn btn-primary" onClick={runImport}>Import selected</button>
              <button className="btn" onClick={() => setStep("pick")}>Back</button>
            </div>
          </div>
        )}

        {step === "importing" && <div className="empty">Importing…</div>}

        {step === "done" && (
          <div>
            <div style={{ fontSize: 14, color: "#2d7a4f", fontWeight: 600, marginBottom: 16 }}>✓ Import complete.</div>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
