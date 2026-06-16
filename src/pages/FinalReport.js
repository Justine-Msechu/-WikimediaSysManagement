import React, { useState, useEffect } from "react";
import { listenSettings, updateSettings } from "../services/settingsService";
import { listenMetrics, DEFAULT_METRICS } from "../services/metricsService";
import { listenActivities } from "../services/activityService";
import { listenPrograms } from "../services/programService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import logo from "../assets/logo.png";

function fmt(n)  { return (n || 0).toLocaleString(); }
function pct(r, t) { if (!t) return 0; return Math.min(999, Math.round((r / t) * 100)); }

const METRIC_ROWS = [
  { key: "participants",    label: "All participants" },
  { key: "allEditors",      label: "All editors" },
  { key: "newEditors",      label: "New editors" },
  { key: "retainedEditors", label: "Retained editors" },
  { key: "allOrganizers",   label: "All organizers" },
  { key: "newOrganizers",   label: "New organizers" },
];

function QuestionBlock({ qnum, question, hint, ansKey, answers, onChange, children, canEdit }) {
  const val = answers?.[ansKey] || "";
  const copy = () => navigator.clipboard.writeText(val);
  return (
    <div className="rpt-q-block">
      <div className="rpt-q-num">{qnum}</div>
      <div className="rpt-q-text">{question}</div>
      {hint && <div className="rpt-q-hint">{hint}</div>}
      {children && <div className="rpt-q-data">{children}</div>}
      {ansKey && (
        <div style={{ marginTop: 8 }}>
          <textarea className="rpt-q-answer" rows={5} placeholder={canEdit ? "Write your answer here…" : "Sign in as Coordinator or Admin to write answers."} value={val} onChange={e => canEdit && onChange(ansKey, e.target.value)} readOnly={!canEdit} style={!canEdit ? { background: "#f8f8f6", color: "#999" } : {}} />
          <button className="btn btn-sm btn-primary" style={{ marginTop: 6 }} onClick={copy}>Copy answer</button>
        </div>
      )}
    </div>
  );
}

export default function FinalReport({ profile }) {
  const [settings,   setSettings]   = useState(null);
  const [metrics,    setMetrics]    = useState(DEFAULT_METRICS);
  const [activities, setActivities] = useState([]);
  const [programs,   setPrograms]   = useState([]);

  const canEdit = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenSettings(setSettings);
    const u2 = listenMetrics(setMetrics);
    const u3 = listenActivities(setActivities);
    const u4 = listenPrograms(setPrograms);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const answers   = settings?.reportAnswers || {};
  const grant     = settings?.grant         || {};

  const setAns = async (key, val) => {
    await updateSettings({ reportAnswers: { ...answers, [key]: val } });
  };

  const totalParticipants = activities.reduce((s, a) => s + (a.participants || 0), 0);
  const totalWomen        = activities.reduce((s, a) => s + (a.women || 0), 0);
  const womenPct          = totalParticipants > 0 ? Math.round((totalWomen / totalParticipants) * 100) : 0;

  const downloadReport = () => {
    const lines = [
      `WIKIMEDIA COMMUNITY KILIMANJARO — GSF FINAL LEARNING REPORT`,
      `Grant: ${grant.title || "—"} | Cycle: ${grant.cycle || "—"} | ID: ${grant.id || "—"}`,
      "=".repeat(70),
      "",
      "PART 1 — YOUR WORK AND LEARNING",
      "-".repeat(40),
      `Q1 — Programs and approaches:\n${answers.q1 || "(not filled)"}`,
      "",
      `Q2 — Lessons, successes, plans:\n${answers.q2 || "(not filled)"}`,
      "",
      `Q3 — Links to documentation:\n${answers.q3 || "(not filled)"}`,
      "",
      `Q4 — Sharing with community:\n${answers.q4 || "(not filled)"}`,
      "",
      `Q5 — Impact measurement:\n${answers.q5 || "(not filled)"}`,
      "",
      `Q6.1 — Diversity (participants):\n${answers.q6_1 || "(not filled)"}`,
      "",
      `Q6.2 — Diversity (content):\n${answers.q6_2 || "(not filled)"}`,
      "",
      `Q6.3 — Retention:\n${answers.q6_3 || "(not filled)"}`,
      "",
      "PART 2 — METRICS",
      "-".repeat(40),
      ...METRIC_ROWS.map(({ key, label }) => {
        const m = metrics[key] || { target: 0, result: 0 };
        return `${label}: ${fmt(m.result)} / ${fmt(m.target)} (${pct(m.result, m.target)}%)`;
      }),
      "",
      "PART 3 — SKILL DEVELOPMENT",
      "-".repeat(40),
      `Q12 — New skills:\n${answers.q12 || "(not filled)"}`,
      "",
      `Q13 — Capacity focus:\n${answers.q13 || "(not filled)"}`,
      "",
      "PART 4 — FINANCIAL REPORTING",
      "-".repeat(40),
      `Grant total: USD ${fmt(grant.totalUSD)} | TZS rate: ${grant.conversionRate || "0.000413"}`,
      `Q17 — Other funding:\n${answers.q17 || "(not filled)"}`,
      "",
      `Q18 — Financial report link:\n${answers.q18 || "(not filled)"}`,
      "",
      `Q19 — Unspent funds:\n${answers.q19 || "(not filled)"}`,
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `GSF-Final-Report-${new Date().toISOString().slice(0, 10)}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-title">Final learning report</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
        Answer each Fluxx question below. Auto-filled data is shown in blue panels. Your typed answers save automatically to the cloud.
      </div>

      {/* Overview stats */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-title">Overview</div>
        <div className="card-grid">
          {[
            { label: "Activities",        value: activities.length,      color: "#1c2b1e" },
            { label: "Total participants", value: fmt(totalParticipants), color: "#2d7a4f" },
            { label: "Women",             value: `${fmt(totalWomen)} (${womenPct}%)`, color: "#9333ea" },
            { label: "New editors",       value: fmt(activities.reduce((s, a) => s + (a.newEditors || 0), 0)), color: "#2563eb" },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card"><div className="stat-label">{label}</div><div className="stat-value" style={{ color }}>{value}</div></div>
          ))}
        </div>

        {METRIC_ROWS.map(({ key, label }) => {
          const m = metrics[key] || { target: 0, result: 0 };
          const p = pct(m.result, m.target);
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "#555" }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{fmt(m.result)} / {fmt(m.target)} ({p}%)</span>
              </div>
              <div style={{ background: "#e8e8e4", borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, p)}%`, height: 6, borderRadius: 4, background: p >= 100 ? "#2d7a4f" : p >= 60 ? "#4a9e6b" : "#d97706" }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="btn-row" style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={downloadReport}>↓ Download full report (.txt)</button>
        <button className="btn" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="rpt-part-header">Part 1 — Your work and learning</div>

      <QuestionBlock qnum="Q1" question="Describe your programs and approaches for the year. Explain how you adapted your planned activities. What were the major challenges?" hint="Reference the activities logged in the system. Explain each program and any changes from your plan." ansKey="q1" answers={answers} onChange={setAns} canEdit={canEdit}>
        {activities.length > 0 && (
          <div style={{ fontSize: 12 }}>
            <div style={{ color: "#555", marginBottom: 4 }}>Activities logged this cycle:</div>
            {activities.slice(0, 5).map(a => <div key={a.id} style={{ color: "#555", marginBottom: 2 }}>• {a.date} — {a.name} ({a.participants || 0} participants, {a.type})</div>)}
            {activities.length > 5 && <div style={{ color: "#aaa" }}>…and {activities.length - 5} more</div>}
          </div>
        )}
      </QuestionBlock>

      <QuestionBlock qnum="Q2" question="What did you learn about what worked and what didn't? What were your biggest achievements? What are your plans to build on successes?" hint="Use lessons learned and impact stories from your activity logs." ansKey="q2" answers={answers} onChange={setAns} canEdit={canEdit}>
        {activities.filter(a => a.lessons || a.stories).slice(0, 3).map(a => (
          <div key={a.id} style={{ fontSize: 12, color: "#555", marginBottom: 6, borderLeft: "3px solid #e8e8e4", paddingLeft: 8 }}>
            <strong>{a.name}:</strong>
            {a.lessons && <div>Lessons: {a.lessons}</div>}
            {a.stories && <div>Impact: {a.stories}</div>}
          </div>
        ))}
      </QuestionBlock>

      <QuestionBlock qnum="Q3" question="Please link to your learning log or relevant online documentation." hint="Add your Meta-Wiki grant page link and activity report links." ansKey="q3" answers={answers} onChange={setAns} canEdit={canEdit}>
        {settings?.org?.metaPage && <div style={{ fontSize: 12, color: "#555" }}>Meta-Wiki page: <strong>{settings.org.metaPage}</strong></div>}
      </QuestionBlock>

      <QuestionBlock qnum="Q4" question="Are there ways you'd like to share your work with the broader Wikimedia or free knowledge community?" ansKey="q4" answers={answers} onChange={setAns} canEdit={canEdit} />

      <QuestionBlock qnum="Q5" question="Describe how you measure or capture the impact of the activities you organize." hint="Describe your tracking methods: participation forms, article tracking, Programs & Events Dashboard, etc." ansKey="q5" answers={answers} onChange={setAns} canEdit={canEdit} />

      <QuestionBlock qnum="Q6.1" question="How is your organization ensuring sufficient diversity in participants and leadership?" hint="Reference your Wikimalkia and Feminism & Folklore programs, and your women/youth participation data." ansKey="q6_1" answers={answers} onChange={setAns} canEdit={canEdit}>
        <div style={{ fontSize: 12, color: "#555" }}>Women participants: <strong>{totalWomen}</strong> ({womenPct}% of {fmt(totalParticipants)} total)</div>
      </QuestionBlock>

      <QuestionBlock qnum="Q6.2" question="What steps are you taking to ensure diverse content is available on Wikimedia projects?" ansKey="q6_2" answers={answers} onChange={setAns} canEdit={canEdit} />

      <QuestionBlock qnum="Q6.3" question="What steps are you taking to retain participants, especially women and underrepresented groups?" ansKey="q6_3" answers={answers} onChange={setAns} canEdit={canEdit} />

      <div className="rpt-part-header">Part 2 — Metrics</div>

      <div className="rpt-q-block">
        <div className="rpt-q-num">14.1</div>
        <div className="rpt-q-text">Participants, editors, and organizers — target vs result</div>
        <div className="rpt-q-data">
          <table style={{ fontSize: 12 }}>
            <thead><tr><th>Metric</th><th>Target</th><th>Result</th><th>% achieved</th></tr></thead>
            <tbody>
              {METRIC_ROWS.map(({ key, label }) => {
                const m = metrics[key] || { target: 0, result: 0 };
                const p = pct(m.result, m.target);
                const cls = p >= 100 ? "badge-green" : p >= 60 ? "badge-amber" : "badge-gray";
                return <tr key={key}><td>{label}</td><td>{fmt(m.target)}</td><td><strong>{fmt(m.result)}</strong></td><td><span className={`badge ${cls}`}>{p}%</span></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rpt-q-block">
        <div className="rpt-q-num">14.2</div>
        <div className="rpt-q-text">Wikimedia project contributions — target vs result</div>
        <div className="rpt-q-data">
          <table style={{ fontSize: 12 }}>
            <thead><tr><th>Project</th><th>Target created</th><th>Result created</th><th>Target improved</th><th>Result improved</th></tr></thead>
            <tbody>
              {(metrics.projects || []).map(p => (
                <tr key={p.name}>
                  <td><strong>{p.name}</strong></td>
                  <td style={{ color: "#888" }}>{fmt(p.tCreated)}</td><td>{fmt(p.rCreated)}</td>
                  <td style={{ color: "#888" }}>{fmt(p.tImproved)}</td><td>{fmt(p.rImproved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rpt-part-header">Part 3 — Skill development</div>

      <QuestionBlock qnum="Q12" question="What new skills have you or your members developed? How will these help your organization address community needs?" hint="Think about Wikipedia editing, event management, leadership, outreach, Kiwix, digital literacy." ansKey="q12" answers={answers} onChange={setAns} canEdit={canEdit} />

      <QuestionBlock qnum="Q13" question="What is one capacity area your organization should focus on in the coming year and why?" ansKey="q13" answers={answers} onChange={setAns} canEdit={canEdit} />

      <div className="rpt-part-header">Part 4 — Financial reporting</div>

      <QuestionBlock qnum="Q17" question="Have you received any other sources of revenue or funding during this grant period? If yes, describe." ansKey="q17" answers={answers} onChange={setAns} canEdit={canEdit} />

      <QuestionBlock qnum="Q18" question="Please provide a link to your financial report document." hint="Usually a Google Spreadsheet or Meta-Wiki document." ansKey="q18" answers={answers} onChange={setAns} canEdit={canEdit} />

      <QuestionBlock qnum="Q19" question="If you have unspent funds at the end of the grant period, how do you intend to use or return them?" ansKey="q19" answers={answers} onChange={setAns} canEdit={canEdit} />

      <div className="rpt-q-block">
        <div className="rpt-q-num">Q20</div>
        <div className="rpt-q-text">Compliance declarations</div>
        <div className="rpt-q-data" style={{ fontSize: 13, color: "#555" }}>Confirm in Fluxx that you have complied with: (1) the terms of your grant agreement, (2) applicable laws and regulations, (3) US IRS Code provisions.</div>
      </div>

      <div className="btn-row" style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={downloadReport}>↓ Download full report (.txt)</button>
        <button className="btn" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
    </div>
  );
}
