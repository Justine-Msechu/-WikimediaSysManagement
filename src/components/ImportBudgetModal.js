import React, { useState } from "react";
import { parseBudgetWorkbook } from "../utils/budgetImport";
import { addProgram } from "../services/programService";
import { addBudgetEntry } from "../services/budgetService";
import { updateSettings } from "../services/settingsService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";

function fmtUSD(n) { return `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtTZS(n) { return `TZS ${Math.round(Number(n) || 0).toLocaleString()}`; }

export default function ImportBudgetModal({ profile, grantId, settings, conversionRate, onClose, onImported }) {
  const [step,     setStep]     = useState("pick"); // pick | preview | importing | done
  const [error,    setError]    = useState("");
  const [parsed,   setParsed]   = useState(null);
  const [fileName, setFileName] = useState("");

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseBudgetWorkbook(ev.target.result, conversionRate);
        setParsed(result);
        setStep("preview");
      } catch (err) {
        setError(err.message || "Could not read this file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggle = (group, idx) => {
    setParsed(p => {
      const list = [...p[group]];
      list[idx] = { ...list[idx], include: !list[idx].include };
      return { ...p, [group]: list };
    });
  };

  const runImport = async () => {
    setStep("importing");
    try {
      const programsToAdd  = parsed.programs.filter(p => p.include);
      const personnelToAdd = parsed.personnel.filter(p => p.include);
      const opsToAdd        = parsed.opsEntries.filter(o => o.include);

      for (const p of programsToAdd) {
        const id = await addProgram({
          name: p.name, category: p.category, color: p.color,
          plannedSessions: p.plannedSessions, description: p.description,
          requestedBudgetUSD: p.requestedBudgetUSD, requestedBudgetTZS: p.requestedBudgetTZS,
          requestedPerSessionUSD: p.requestedPerSessionUSD, requestedPerSessionTZS: p.requestedPerSessionTZS,
          exchangeRate: conversionRate, budgetItems: [], grantId: grantId || "",
        });
        await addAudit(profile, AUDIT_ACTIONS.IMPORT, "programs", { targetId: id, recordTitle: p.name, details: "Imported from budget template" });
      }

      if (personnelToAdd.length) {
        const existing = settings?.personnel || [];
        const merged = [
          ...existing,
          ...personnelToAdd.map(p => ({ id: Date.now().toString() + Math.random(), name: p.name, monthlySalary: p.monthlySalaryTZS })),
        ];
        await updateSettings({ personnel: merged });
        await addAudit(profile, AUDIT_ACTIONS.IMPORT, "settings", { details: `Imported ${personnelToAdd.length} personnel role(s) from budget template` });
      }

      for (const o of opsToAdd) {
        const id = await addBudgetEntry({
          title: o.title, description: o.notes, category: o.category,
          programId: "", amount: o.amountTZS, date: new Date().toISOString().slice(0, 10),
          requestedBy: profile?.name || "", status: "draft", reviewerComment: "",
          grantId: grantId || "",
        });
        await addAudit(profile, AUDIT_ACTIONS.IMPORT, "budgetEntries", { targetId: id, recordTitle: o.title, details: "Imported from budget template" });
      }

      setStep("done");
      onImported({
        programs: programsToAdd.length, personnel: personnelToAdd.length, opsEntries: opsToAdd.length,
      });
    } catch (err) {
      setError(err.message || "Import failed.");
      setStep("preview");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 720, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1c2b1e" }}>Import budget (Excel)</div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        {step === "pick" && (
          <div>
            <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
              Upload the budget workbook (matching the standard WKK template — "Programs Budget" and "Operations Budget" sheets).
              Programs are created as drafts for the coordinator to fill in with the actual budget line items.
              Personnel and operational costs are written directly as drafts awaiting review.
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={onFile} />
            {error && <div style={{ marginTop: 12, fontSize: 13, color: "#c0392b" }}>{error}</div>}
          </div>
        )}

        {step === "preview" && parsed && (
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Parsed from <strong>{fileName}</strong>. Uncheck anything you don't want imported.</div>

            <div className="panel-title" style={{ fontSize: 13 }}>Programs ({parsed.programs.filter(p => p.include).length} of {parsed.programs.length})</div>
            <div style={{ overflowX: "auto", marginBottom: 18 }}>
              <table style={{ fontSize: 12 }}>
                <thead><tr><th></th><th>Program</th><th>Category</th><th>Sessions/yr</th><th style={{ textAlign: "right" }}>Per session</th><th style={{ textAlign: "right" }}>Total requested</th></tr></thead>
                <tbody>
                  {parsed.programs.map((p, i) => (
                    <tr key={i} style={{ opacity: p.include ? 1 : 0.4 }}>
                      <td><input type="checkbox" checked={p.include} onChange={() => toggle("programs", i)} /></td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td>{p.category}</td>
                      <td style={{ textAlign: "center" }}>{p.plannedSessions}</td>
                      <td style={{ textAlign: "right" }}>{fmtUSD(p.requestedPerSessionUSD)}<div style={{ color: "#888" }}>{fmtTZS(p.requestedPerSessionTZS)}</div></td>
                      <td style={{ textAlign: "right" }}>{fmtUSD(p.requestedBudgetUSD)}<div style={{ color: "#888" }}>{fmtTZS(p.requestedBudgetTZS)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parsed.personnel.length > 0 && (
              <>
                <div className="panel-title" style={{ fontSize: 13 }}>Personnel ({parsed.personnel.filter(p => p.include).length} of {parsed.personnel.length})</div>
                <div style={{ overflowX: "auto", marginBottom: 18 }}>
                  <table style={{ fontSize: 12 }}>
                    <thead><tr><th></th><th>Role</th><th style={{ textAlign: "right" }}>Monthly salary</th></tr></thead>
                    <tbody>
                      {parsed.personnel.map((p, i) => (
                        <tr key={i} style={{ opacity: p.include ? 1 : 0.4 }}>
                          <td><input type="checkbox" checked={p.include} onChange={() => toggle("personnel", i)} /></td>
                          <td style={{ fontWeight: 500 }}>{p.name}</td>
                          <td style={{ textAlign: "right" }}>{fmtUSD(p.monthlySalaryUSD)}<div style={{ color: "#888" }}>{fmtTZS(p.monthlySalaryTZS)}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {parsed.opsEntries.length > 0 && (
              <>
                <div className="panel-title" style={{ fontSize: 13 }}>Operational costs ({parsed.opsEntries.filter(o => o.include).length} of {parsed.opsEntries.length})</div>
                <div style={{ overflowX: "auto", marginBottom: 18 }}>
                  <table style={{ fontSize: 12 }}>
                    <thead><tr><th></th><th>Item</th><th>Category</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
                    <tbody>
                      {parsed.opsEntries.map((o, i) => (
                        <tr key={i} style={{ opacity: o.include ? 1 : 0.4 }}>
                          <td><input type="checkbox" checked={o.include} onChange={() => toggle("opsEntries", i)} /></td>
                          <td style={{ fontWeight: 500 }}>{o.title}</td>
                          <td>{o.category}</td>
                          <td style={{ textAlign: "right" }}>{fmtUSD(o.amountUSD)}<div style={{ color: "#888" }}>{fmtTZS(o.amountTZS)}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {parsed.skipped.length > 0 && (
              <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
                Skipped (not funded / $0 in this budget): {parsed.skipped.join(", ")}
              </div>
            )}

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
