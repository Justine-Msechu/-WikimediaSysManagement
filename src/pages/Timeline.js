import React, { useState, useEffect } from "react";
import { listenActivities } from "../services/activityService";
import { listenPrograms } from "../services/programService";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function startDow(year, month) { let d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }

export default function Timeline({ profile, goPage, grantId }) {
  const [activities, setActivities] = useState([]);
  const [programs,   setPrograms]   = useState([]);
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    const u1 = listenActivities(setActivities);
    const u2 = listenPrograms(setPrograms);
    return () => { u1(); u2(); };
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

  return (
    <div>
      <div className="page-title">Activity timeline</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <button className="btn" onClick={prev}>Prev</button>
        <div style={{ fontWeight: 700, fontSize: 18, minWidth: 180, textAlign: "center" }}>{MONTHS[month]} {year}</div>
        <button className="btn" onClick={next}>Next</button>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}>Today</button>
      </div>

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
