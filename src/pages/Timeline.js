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

  // Month-cell state in Planned vs actual.
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const shownMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  const cellState = (planned, actual, m) => {
    if (planned && actual) return "done";
    if (planned && m < thisMonth) return "overdue";
    if (planned) return m === thisMonth ? "due" : "planned";
    if (actual) return "extra";
    return "";
  };
  const CELL = {
    done:    { label: "Done",                   title: (m) => `Planned and done in ${monthLabel(m)}` },
    overdue: { label: "Planned, not logged",    title: (m) => `Planned for ${monthLabel(m)} — no activity logged` },
    due:     { label: "Planned this month",     title: (m) => `Planned for ${monthLabel(m)} (this month)` },
    planned: { label: "Planned",                title: (m) => `Planned for ${monthLabel(m)}` },
    extra:   { label: "Not in the plan",        title: (m) => `Logged in ${monthLabel(m)} but not in the plan` },
  };
  const totals = comparisonRows.reduce((t, r) => {
    t.planned += r.months.length;
    t.done    += r.done;
    t.overdue += r.months.filter(m => m < thisMonth && !r.actualMonths.has(m)).length;
    t.extra   += r.extra.length;
    return t;
  }, { planned: 0, done: 0, overdue: 0, extra: 0 });
  const goMonth = (m) => { const [y, mo] = m.split("-").map(Number); setYear(y); setMonth(mo - 1); };
  const fmtDay = (iso) => { const d = new Date(iso); return { day: d.getDate(), dow: WEEKDAYS[(d.getDay() + 6) % 7] }; };

  return (
    <div>
      <div className="page-title">Activity timeline</div>
      <div className="page-sub">The grant's plan month by month, what has been done, and the calendar of activities.</div>

      {comparisonRows.length > 0 && (
        <div className="card-grid" style={{ marginBottom: 16 }}>
          {[
            ["Planned months",   totals.planned, "#1c2b1e"],
            ["Done",             totals.done,    "#2d7a4f"],
            ["Overdue",          totals.overdue, totals.overdue ? "#c0392b" : "#1c2b1e"],
            ["Not in the plan",  totals.extra,   "#2563eb"],
          ].map(([label, value, color]) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Planned vs actual — imported schedule (or the official 2026-2027 document) vs logged activities */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="tl-head">
          <div>
            <div className="panel-title" style={{ marginBottom: 2 }}>Planned vs actual</div>
            <div style={{ fontSize: 12, color: "#888" }}>Each program's planned months against the activities logged. Click a month to see it in the calendar.</div>
          </div>
          <div className="tl-actions">
            <button className="btn btn-sm" onClick={printTimelineReport}>Print timeline report</button>
            {canImport && (
              <>
                <a className="btn btn-sm" href={`${process.env.PUBLIC_URL}/templates/wkk-timeline-template.xlsx`} download>Download template</a>
                <button className="btn btn-sm" onClick={() => setShowImport(true)}>Import timeline (Excel)</button>
              </>
            )}
          </div>
        </div>

        {comparisonRows.length === 0 ? (
          <div className="empty">No planned schedule yet — import the timeline template above, or create programs that match the official 2026-2027 document.</div>
        ) : (
          <>
            <div className="tl-legend">
              {["done", "due", "planned", "overdue", "extra"].map(k => (
                <span key={k}><span className={`tl-dot tl-${k}`} />{CELL[k].label}</span>
              ))}
            </div>
            <div className="tl-scroll">
              <table className="no-cards tl-table">
                <thead>
                  <tr>
                    <th className="tl-prog">Program</th>
                    {timelineColumns.map(m => (
                      <th key={m} className={`tl-month${m === thisMonth ? " is-now" : ""}${m === shownMonth ? " is-shown" : ""}`}>
                        <button onClick={() => goMonth(m)} title={`Show ${monthLabel(m)} in the calendar`}>{monthLabel(m)}</button>
                      </th>
                    ))}
                    <th className="tl-progress-col">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map(({ program, months, actualMonths, done, extra }) => {
                    const pct = months.length ? Math.round((done / months.length) * 100) : 0;
                    return (
                      <tr key={program.id}>
                        <td className="tl-prog">
                          <span className="tl-swatch" style={{ background: program.color || "#4a9e6b" }} />
                          {program.name}
                        </td>
                        {timelineColumns.map(m => {
                          const st = cellState(months.includes(m), actualMonths.has(m), m);
                          return (
                            <td key={m} className={`tl-cell${m === thisMonth ? " is-now" : ""}`}>
                              {st && <span className={`tl-dot tl-${st}`} title={CELL[st].title(m)} />}
                            </td>
                          );
                        })}
                        <td className="tl-progress-col">
                          <div className="tl-bar"><div style={{ width: `${pct}%` }} /></div>
                          <div className="tl-bar-label">{done} of {months.length}{extra.length > 0 && <span style={{ color: "#2563eb" }}> · +{extra.length} extra</span>}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
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

      {/* Calendar */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="tl-cal-head">
          <div className="tl-cal-nav">
            <button className="btn btn-sm" onClick={prev} aria-label="Previous month">‹</button>
            <div className="tl-cal-title">{MONTHS[month]} {year}</div>
            <button className="btn btn-sm" onClick={next} aria-label="Next month">›</button>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{monthActivities.length} activit{monthActivities.length === 1 ? "y" : "ies"}</span>
            {shownMonth !== thisMonth && <button className="btn btn-sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}>This month</button>}
          </div>
        </div>
        <div className="tl-cal">
          {WEEKDAYS.map(d => <div key={d} className="tl-cal-dow">{d}</div>)}
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} className="tl-cal-pad" />)}
          {Array.from({ length: days }, (_, i) => {
            const day  = i + 1;
            const acts = actsByDay[day] || [];
            return (
              <div key={day} className={`tl-cal-day${isToday(day) ? " is-today" : ""}${acts.length ? " has-acts" : ""}`}>
                <div className="tl-cal-num">{day}</div>
                {acts.map(a => (
                  <div key={a.id} className="tl-cal-act" onClick={() => goPage("activity-detail", a.id)} title={a.name}
                    style={{ background: programColor(a.programId) }}>
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Activities in the month */}
      <div className="panel">
        <div className="panel-title">Activities in {MONTHS[month]} {year}</div>
        {monthActivities.length === 0 ? (
          <div className="empty">No activities logged in {MONTHS[month]} {year}.</div>
        ) : monthActivities.map(a => {
          const d = fmtDay(a.date);
          return (
            <div key={a.id} className="tl-item">
              <div className="tl-date" style={{ borderColor: programColor(a.programId) }}>
                <div className="tl-date-day">{d.day}</div>
                <div className="tl-date-dow">{d.dow}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#1c2b1e" }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                  {[a.type, `${a.participants || 0} participants`].filter(Boolean).join(" · ")}
                  {programName(a.programId) && <> · <span style={{ color: programColor(a.programId), fontWeight: 600 }}>{programName(a.programId)}</span></>}
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => goPage("activity-detail", a.id)}>View</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
