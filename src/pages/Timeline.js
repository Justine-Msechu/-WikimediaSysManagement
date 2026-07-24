import React, { useState, useEffect } from "react";
import { listenActivities } from "../services/activityService";
import { listenPrograms } from "../services/programService";
import { listenSettings } from "../services/settingsService";
import { plannedScheduleFor, monthLabel } from "../data/plannedTimeline";
import { timelineReportHtml } from "../utils/timelineReport";
import ImportTimelineModal from "../components/ImportTimelineModal";
import logo from "../assets/logo.png";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function startDow(year, month) { let d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }

export default function Timeline({ profile, goPage, grantId, currentGrant }) {
  const [activities, setActivities] = useState([]);
  const [programs,   setPrograms]   = useState([]);
  const [settings,   setSettings]   = useState(null);
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [showImport, setShowImport] = useState(false);
  const canImport = ["admin", "coordinator"].includes(profile?.role);

  useEffect(() => {
    const u1 = listenActivities(setActivities);
    const u2 = listenPrograms(setPrograms);
    const u3 = listenSettings(setSettings);
    return () => { u1(); u2(); u3 && u3(); };
  }, []);

  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  const programColor = (pid) => programs.find(p => p.id === pid)?.color || "#4a9e6b";
  const programName  = (pid) => programs.find(p => p.id === pid)?.name  || null;

  const visibleActivities = grantId ? activities.filter(a => a.grantId === grantId) : activities;

  const actsByDay = {};
  visibleActivities.forEach(a => {
    if (!a.date) return;
    const d = new Date(a.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!actsByDay[day]) actsByDay[day] = [];
      actsByDay[day].push(a);
    }
  });

  const days     = daysInMonth(year, month);
  const startPad = startDow(year, month);
  const today    = new Date();
  const isToday  = (d) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  // Month list — all activities for the month sorted by date
  const monthActivities = visibleActivities
    .filter(a => { if (!a.date) return false; const d = new Date(a.date); return d.getFullYear() === year && d.getMonth() === month; })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Planned vs actual — compares each program's planned schedule against logged activities
  // for the full grant cycle, regardless of which month the calendar above is showing.
  // A program's planned schedule comes from an imported timeline file (program.plannedMonths)
  // when one has been set; otherwise it falls back to the official 2026-2027 document's
  // schedule, matched by program name, so this still works before anything is imported.
  const visiblePrograms = grantId ? programs.filter(p => p.grantId === grantId) : programs;
  const comparisonRows = visiblePrograms
    .map(p => {
      const months = p.plannedMonths?.length ? p.plannedMonths : plannedScheduleFor(p.name)?.months;
      if (!months?.length) return null;
      const actualMonths = new Set(
        visibleActivities.filter(a => a.programId === p.id && a.date).map(a => a.date.slice(0, 7))
      );
      const plannedSet = new Set(months);
      const done = months.filter(m => actualMonths.has(m)).length;
      const extra = [...actualMonths].filter(m => !plannedSet.has(m));
      return { program: p, months, actualMonths, done, extra };
    })
    .filter(Boolean);
  const allMonths = new Set();
  comparisonRows.forEach(r => { r.months.forEach(m => allMonths.add(m)); r.actualMonths.forEach(m => allMonths.add(m)); });
  const timelineColumns = [...allMonths].sort();

  const orgName = settings?.org?.name || "Wikimedia Community Kilimanjaro";
  const grant   = currentGrant || settings?.grant || {};
  const printTimelineReport = () => {
    const html = timelineReportHtml(comparisonRows, timelineColumns, orgName, grant, logo);
    const w = window.open("", "_blank", "width=1000,height=800");
    w.document.write(html);
    w.document.close();
  };

  return (
    <div>
      <div className="page-title">Activity timeline</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <button className="btn" onClick={prev}>Prev</button>
        <div style={{ fontWeight: 700, fontSize: 18, minWidth: 180, textAlign: "center" }}>{MONTHS[month]} {year}</div>
        <button className="btn" onClick={next}>Next</button>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}>Today</button>
      </div>

      {/* Planned vs actual — imported schedule (or the official 2026-2027 document) vs logged activities */}
      <div className="panel" style={{ marginBottom: 20, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div className="panel-title">Planned vs actual</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-sm" onClick={printTimelineReport}>Print timeline report</button>
            {canImport && (
              <>
                <a className="btn btn-sm" href={`${process.env.PUBLIC_URL}/templates/wkk-timeline-template.xlsx`} download>Download timeline template</a>
                <button className="btn btn-sm" onClick={() => setShowImport(true)}>Import timeline (Excel)</button>
              </>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#888", margin: "6px 0 10px" }}>
          A filled green dot means a planned month has a matching logged activity; an empty amber ring means it's still pending; a blue dot marks an activity logged in a month that wasn't part of the plan.
        </div>
        {comparisonRows.length === 0 ? (
          <div className="empty">No planned schedule yet — import the timeline template above, or create programs that match the official 2026-2027 document.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e8e8e4" }}>Program</th>
                {timelineColumns.map(m => (
                  <th key={m} style={{ textAlign: "center", padding: "6px 4px", borderBottom: "1px solid #e8e8e4", fontSize: 10, color: "#888" }}>{monthLabel(m)}</th>
                ))}
                <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #e8e8e4", fontSize: 10, color: "#888" }}>On track</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(({ program, months, actualMonths, done, extra }) => (
                <tr key={program.id}>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f5f4f0", whiteSpace: "nowrap" }}>{program.name}</td>
                  {timelineColumns.map(m => {
                    const planned = months.includes(m);
                    const actual  = actualMonths.has(m);
                    let dot = null;
                    if (planned && actual)      dot = <span title={`Planned and done in ${monthLabel(m)}`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#2d7a4f" }} />;
                    else if (planned && !actual) dot = <span title={`Planned for ${monthLabel(m)}, not yet logged`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2px solid #d68a1a" }} />;
                    else if (!planned && actual) dot = <span title={`Logged in ${monthLabel(m)} but not in the original plan`} style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#3a7bd5" }} />;
                    return <td key={m} style={{ textAlign: "center", padding: "6px 4px", borderBottom: "1px solid #f5f4f0" }}>{dot}</td>;
                  })}
                  <td style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #f5f4f0", whiteSpace: "nowrap" }}>
                    {done}/{months.length}{extra.length > 0 && <span style={{ color: "#3a7bd5" }}> +{extra.length}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showImport && (
        <ImportTimelineModal
          profile={profile}
          grantId={grantId}
          programs={visiblePrograms}
          onClose={() => setShowImport(false)}
          onImported={() => setShowImport(false)}
        />
      )}

      {/* Calendar grid */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {WEEKDAYS.map(d => <div key={d} style={{ fontSize: 11, fontWeight: 700, textAlign: "center", color: "#888", letterSpacing: "0.06em", textTransform: "uppercase" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const day   = i + 1;
            const acts  = actsByDay[day] || [];
            return (
              <div key={day} style={{ minHeight: 72, background: isToday(day) ? "#e6f4ec" : "#fafaf7", borderRadius: 8, padding: 6, border: isToday(day) ? "2px solid #4a9e6b" : "1px solid #e8e8e4" }}>
                <div style={{ fontSize: 12, fontWeight: isToday(day) ? 700 : 400, color: isToday(day) ? "#2d7a4f" : "#888", marginBottom: 4 }}>{day}</div>
                {acts.map(a => (
                  <div key={a.id} onClick={() => goPage("activity-detail", a.id)} style={{ fontSize: 10, background: programColor(a.programId), color: "#fff", borderRadius: 4, padding: "2px 5px", marginBottom: 3, cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {a.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Month activity list */}
      {monthActivities.length > 0 && (
        <div className="panel">
          <div className="panel-title">{MONTHS[month]} activities ({monthActivities.length})</div>
          {monthActivities.map(a => (
            <div key={a.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #f5f4f0" }}>
              <div style={{ minWidth: 60, fontSize: 12, color: "#888", paddingTop: 2 }}>{a.date?.slice(8)}</div>
              <div style={{ width: 4, borderRadius: 2, alignSelf: "stretch", flexShrink: 0, background: programColor(a.programId) }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {a.type} · {a.participants || 0} participants
                  {programName(a.programId) && <span> · <span style={{ color: programColor(a.programId) }}>{programName(a.programId)}</span></span>}
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => goPage("activity-detail", a.id)}>View</button>
            </div>
          ))}
        </div>
      )}

      {monthActivities.length === 0 && (
        <div className="panel"><div className="empty">No activities in {MONTHS[month]} {year}.</div></div>
      )}
    </div>
  );
}
