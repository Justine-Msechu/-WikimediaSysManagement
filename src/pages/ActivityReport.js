import React from "react";
import { fmt, buildActivityReport } from "../utils/helpers";

export default function ActivityReport({ activity: a, index, state, update, onBack }) {
  if (!a) return <div className="empty">Activity not found.</div>;

  const wPct = a.participants ? Math.round((a.women / a.participants) * 100) : 0;

  const handleDownload = () => {
    const text = buildActivityReport(a);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${a.date}-${a.name.replace(/\s+/g, "-")}-report.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    // Allow editing key fields inline — opens a simple prompt
    // For full edit, remove and re-add (simpler for MVP)
    alert("To edit this activity, delete it and re-log it with corrected information.");
  };

  return (
    <div>
      <button className="btn btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>
        Back to activities
      </button>

      {/* Header */}
      <div className="act-report-header">
        <div className="act-report-title">{a.name}</div>
        <div className="act-report-meta">
          {a.date} · {a.location} · {a.type}
          {a.reportedBy && ` · Reported by ${a.reportedBy}`}
        </div>
      </div>

      {/* Stats row */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Total participants</div>
          <div className="stat-value green">{a.participants || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Women ({wPct}%)</div>
          <div className="stat-value green">{a.women || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">New editors</div>
          <div className="stat-value blue">{a.newEditors || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Articles created</div>
          <div className="stat-value green">{fmt(a.created || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Articles improved</div>
          <div className="stat-value blue">{fmt(a.improved || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cost (TZS)</div>
          <div className="stat-value amber">{fmt(a.cost || 0)}</div>
        </div>
      </div>

      {/* Report sections */}
      <div className="panel">
        <div className="panel-title">Activity summary</div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: a.summary ? "#1a1a1a" : "#aaa" }}>
          {a.summary || "(No summary provided)"}
        </p>
      </div>

      <div className="form-grid">
        <div className="panel">
          <div className="panel-title">Challenges faced</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: a.challenges ? "#1a1a1a" : "#aaa" }}>
            {a.challenges || "(None reported)"}
          </p>
        </div>
        <div className="panel">
          <div className="panel-title">Lessons learned</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: a.lessons ? "#1a1a1a" : "#aaa" }}>
            {a.lessons || "(None reported)"}
          </p>
        </div>
      </div>

      <div className="form-grid">
        <div className="panel">
          <div className="panel-title">Impact stories</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: a.stories ? "#1a1a1a" : "#aaa", fontStyle: a.stories ? "normal" : "italic" }}>
            {a.stories || "(No stories recorded)"}
          </p>
        </div>
        <div className="panel">
          <div className="panel-title">Next steps</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: a.nextSteps ? "#1a1a1a" : "#aaa" }}>
            {a.nextSteps || "(None planned)"}
          </p>
        </div>
      </div>

      {/* Contribution details */}
      <div className="panel">
        <div className="panel-title">Contribution details</div>
        <table>
          <thead>
            <tr><th>Category</th><th>Count</th></tr>
          </thead>
          <tbody>
            <tr><td>Wikipedia articles created</td><td><strong style={{ color: "#2d7a4f" }}>{fmt(a.created || 0)}</strong></td></tr>
            <tr><td>Wikipedia articles improved</td><td><strong style={{ color: "#1a5fa8" }}>{fmt(a.improved || 0)}</strong></td></tr>
            <tr><td>Wikimedia Commons uploads</td><td>{fmt(a.commons || 0)}</td></tr>
            <tr><td>Wikidata items</td><td>{fmt(a.wikidata || 0)}</td></tr>
            {a.link && (
              <tr>
                <td>Outreach Dashboard</td>
                <td><a href={a.link} target="_blank" rel="noreferrer" style={{ color: "#1a5fa8" }}>{a.link}</a></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Diversity */}
      <div className="panel">
        <div className="panel-title">Participation breakdown</div>
        <table>
          <thead><tr><th>Group</th><th>Count</th><th>% of total</th></tr></thead>
          <tbody>
            <tr><td>Total participants</td><td>{a.participants || 0}</td><td>100%</td></tr>
            <tr><td>Women</td><td>{a.women || 0}</td><td>{wPct}%</td></tr>
            <tr><td>New editors</td><td>{a.newEditors || 0}</td><td>{a.participants ? Math.round(((a.newEditors||0)/(a.participants||1))*100) : 0}%</td></tr>
            <tr><td>Youth (under 30)</td><td>{a.youth || 0}</td><td>{a.participants ? Math.round(((a.youth||0)/(a.participants||1))*100) : 0}%</td></tr>
            <tr><td>Persons with disability</td><td>{a.pwd || 0}</td><td>{a.participants ? Math.round(((a.pwd||0)/(a.participants||1))*100) : 0}%</td></tr>
          </tbody>
        </table>
      </div>

      {/* Plain text preview */}
      <div className="panel">
        <div className="panel-title">Plain text report (copy to paste anywhere)</div>
        <pre style={{ fontSize: 12, fontFamily: "monospace", background: "#f5f4f0", padding: 14, borderRadius: 7, whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 300, overflowY: "auto" }}>
          {buildActivityReport(a)}
        </pre>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleDownload}>
          ↓ Download report (.txt)
        </button>
        <button className="btn" onClick={() => {
          navigator.clipboard.writeText(buildActivityReport(a));
          alert("Report copied to clipboard!");
        }}>
          Copy report text
        </button>
        <button className="btn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
