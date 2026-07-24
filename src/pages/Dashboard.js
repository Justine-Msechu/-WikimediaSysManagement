import React, { useState, useEffect } from "react";
import { renderHtml } from "../components/RichTextEditor";
import { listenActivities } from "../services/activityService";
import { listenParticipants } from "../services/participantService";
import { listenSettings } from "../services/settingsService";
import { listenMetrics, listenMetricsByGrant, DEFAULT_METRICS } from "../services/metricsService";
import { listenBudgetEntries } from "../services/budgetService";
import { listenAnnouncements } from "../services/announcementService";
import { listenDeadlines } from "../services/deadlineService";
import { listenInvoices } from "../services/invoiceService";
import { listenPrograms } from "../services/programService";
import { spendingReportHtml } from "../utils/spendingReport";
import logo from "../assets/logo.png";

function pct(r, t) { if (!t) return 0; return Math.min(999, Math.round((r / t) * 100)); }
function fmt(n)    { return (n || 0).toLocaleString(); }
function todayStr(){ return new Date().toISOString().slice(0, 10); }

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "short" }),
    });
  }
  return months;
}

function BarChart({ data, color = "#4a9e6b" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80, marginTop: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          {d.value > 0 && <div style={{ fontSize: 10, color: "#555", fontWeight: 600 }}>{d.value}</div>}
          <div style={{
            width: "100%",
            height: `${Math.max(d.value > 0 ? (d.value / max) * 54 : 0, d.value ? 4 : 0)}px`,
            background: color,
            borderRadius: "3px 3px 0 0",
            transition: "height 0.4s",
          }} />
          <div style={{ fontSize: 9, color: "#aaa", textAlign: "center", lineHeight: 1.2 }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function daysUntil(date) {
  return Math.round((new Date(date).setHours(0,0,0,0) - new Date(todayStr()).setHours(0,0,0,0)) / 86400000);
}

export default function Dashboard({ profile, goPage, grantId, grants }) {
  const [activities,     setActivities]     = useState([]);
  const [participants,   setParticipants]   = useState([]);
  const [settings,       setSettings]       = useState(null);
  const [metrics,        setMetrics]        = useState(DEFAULT_METRICS);
  const [budgetEntries,  setBudgetEntries]  = useState([]);
  const [announcements,  setAnnouncements]  = useState([]);
  const [deadlines,      setDeadlines]      = useState([]);
  const [invoices,       setInvoices]       = useState([]);
  const [programs,       setPrograms]       = useState([]);

  useEffect(() => {
    const u1 = listenActivities(setActivities);
    const u2 = listenParticipants(setParticipants);
    const u3 = listenSettings(setSettings);
    const u4 = grantId
      ? listenMetricsByGrant(grantId, setMetrics)
      : listenMetrics(setMetrics);
    const u5 = listenBudgetEntries(setBudgetEntries);
    const u6 = listenAnnouncements(setAnnouncements);
    const u7 = listenDeadlines(setDeadlines);
    const u8 = listenInvoices(setInvoices);
    const u9 = listenPrograms(setPrograms);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
  }, [grantId]);

  // Filter in JS when a grant is selected (keep subscriptions unfiltered for simplicity)
  const filteredActivities = grantId
    ? activities.filter(a => a.grantId === grantId)
    : activities;
  const filteredEntries = grantId
    ? budgetEntries.filter(e => e.grantId === grantId)
    : budgetEntries;

  // Current grant info for header display
  const currentGrant = grantId && grants ? grants.find(g => g.id === grantId) : null;

  const grant          = settings?.grant || {};
  // Prefer current grant totalUSD/conversionRate if a grant is selected
  const grantTotalUSD  = currentGrant?.totalUSD || grant.totalUSD;
  const grantRate      = currentGrant?.conversionRate || grant.conversionRate;
  const totalBudgetTZS = grantTotalUSD ? Math.round(grantTotalUSD / (grantRate || 0.000413)) : 0;
  const approvedSpend  = filteredEntries.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
  const budgetPct      = totalBudgetTZS ? Math.min(100, Math.round((approvedSpend / totalBudgetTZS) * 100)) : 0;

  const canApprove     = ["admin", "finance_officer"].includes(profile?.role);
  // Money totals (grant size, budget utilisation) are finance-only — coordinators run
  // programs/activities but should not see overall grant money figures.
  const showFinancials = profile?.role !== "coordinator";

  const printSpendingReport = () => {
    const visibleInvoices = grantId ? invoices.filter(i => i.grantId === grantId) : invoices;
    const visiblePrograms = grantId ? programs.filter(p => p.grantId === grantId) : programs;
    const approvedEntries = filteredEntries.filter(e => e.status === "approved");
    const orgName = settings?.org?.name || "Wikimedia Community Kilimanjaro";
    const reportGrant = { conversionRate: grantRate, title: currentGrant?.title || grant.title || "" };
    const html = spendingReportHtml(visibleInvoices, approvedEntries, visiblePrograms, orgName, reportGrant, logo);
    const w = window.open("", "_blank", "width=1000,height=800");
    w.document.write(html);
    w.document.close();
  };
  const pendingEntries = filteredEntries.filter(e => e.status === "submitted");
  const myDrafts       = filteredEntries.filter(e => e.status === "draft" && e.requestedBy === profile?.name);
  const actionItems    = [
    canApprove && pendingEntries.length > 0 && {
      label: `${pendingEntries.length} budget ${pendingEntries.length === 1 ? "entry" : "entries"} pending your approval`,
      color: "#d97706", bg: "#fff8e1", border: "#ffe082", page: "review",
    },
    myDrafts.length > 0 && {
      label: `You have ${myDrafts.length} draft budget ${myDrafts.length === 1 ? "entry" : "entries"} not yet submitted`,
      color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", page: "review",
    },
  ].filter(Boolean);

  const totalParticipants = filteredActivities.reduce((s, a) => s + (a.participants || 0), 0);
  const totalWomen        = filteredActivities.reduce((s, a) => s + (a.women       || 0), 0);
  const totalNewEditors   = filteredActivities.reduce((s, a) => s + (a.newEditors  || 0), 0);

  const STAT_METRICS = [
    { key: "participants",  label: "Participants" },
    { key: "allEditors",    label: "Editors" },
    { key: "newEditors",    label: "New editors" },
    { key: "allOrganizers", label: "Organizers" },
  ];

  // Monthly activity chart data
  const months      = getLast6Months();
  const chartData   = months.map(m => ({ label: m.label, value: filteredActivities.filter(a => a.date?.startsWith(m.key)).length }));
  const chartPeople = months.map(m => ({
    label: m.label,
    value: filteredActivities.filter(a => a.date?.startsWith(m.key)).reduce((s, a) => s + (a.participants || 0), 0),
  }));

  // Upcoming deadlines for widget
  const today         = todayStr();
  const urgentDlines  = deadlines.filter(d => !d.done).slice(0, 4);
  const latestAnnouncements = [...announcements].sort((a, b) => (a.pinned && !b.pinned) ? -1 : (!a.pinned && b.pinned) ? 1 : 0).slice(0, 3);

  return (
    <div>
      <div className="page-title">Dashboard</div>

      {/* Current grant indicator */}
      {currentGrant && (
        <div style={{ marginBottom: 16, padding: "8px 14px", background: "#f0f7f3", border: "1px solid #b7e0c8", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#2d7a4f", fontWeight: 700 }}>Viewing:</span>
          <span style={{ fontWeight: 600 }}>{currentGrant.title || currentGrant.grantNumber || "Untitled"}</span>
          {currentGrant.type && <span style={{ fontSize: 11, color: "#555", background: "#e6f4ec", borderRadius: 4, padding: "2px 8px" }}>{currentGrant.type}</span>}
          {currentGrant.cycle && <span style={{ fontSize: 12, color: "#888" }}>{currentGrant.cycle}</span>}
        </div>
      )}

      {/* Action-required alerts */}
      {actionItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {actionItems.map((item, i) => (
            <div key={i} onClick={() => goPage(item.page)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: item.bg, border: `1px solid ${item.border}`, borderLeft: `4px solid ${item.color}`, borderRadius: 8, cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: 12, color: item.color, fontWeight: 500 }}>Go to Review</div>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="card-grid" style={{ marginBottom: 24 }}>
        {[
          { label: "Activities logged",  value: filteredActivities.length, color: "#1c2b1e" },
          { label: "Total participants", value: fmt(totalParticipants), color: "#2d7a4f" },
          { label: "Women participants", value: fmt(totalWomen),        color: "#9333ea" },
          { label: "New editors",        value: fmt(totalNewEditors),   color: "#2563eb" },
          { label: "Registry size",      value: participants.length,    color: "#0891b2" },
          showFinancials && { label: "Budget used", value: `${budgetPct}%`, color: budgetPct > 90 ? "#c0392b" : "#2d7a4f" },
        ].filter(Boolean).map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-title">Activities per month</div>
          <BarChart data={chartData} color="#4a9e6b" />
        </div>
        <div className="panel">
          <div className="panel-title">Participants per month</div>
          <BarChart data={chartPeople} color="#2563eb" />
        </div>
      </div>

      {/* Metrics + Recent activities */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-title">Metrics progress</div>
          {STAT_METRICS.map(({ key, label }) => {
            const m = metrics[key] || { target: 0, result: 0 };
            const p = pct(m.result, m.target);
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#555" }}>{label}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(m.result)} / {fmt(m.target)} <span style={{ color: "#888", fontWeight: 400 }}>({p}%)</span></span>
                </div>
                <div style={{ background: "#e8e8e4", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, p)}%`, height: 6, borderRadius: 4, background: p >= 100 ? "#2d7a4f" : p >= 60 ? "#4a9e6b" : "#d97706" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Recent activities</div>
            <button className="btn btn-sm" onClick={() => goPage("activities")}>View all</button>
          </div>
          {filteredActivities.length === 0 ? <div className="empty">No activities logged yet.</div>
            : filteredActivities.slice(0, 5).map(a => (
              <div key={a.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f0f0ec" }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "#888" }}>{a.date} · {a.type} · {a.participants || 0} participants</div>
              </div>
            ))}
        </div>
      </div>

      {/* Deadlines + Announcements */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Upcoming deadlines widget */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Upcoming deadlines</div>
            <button className="btn btn-sm" onClick={() => goPage("deadlines")}>Manage</button>
          </div>
          {urgentDlines.length === 0 ? (
            <div className="empty">No upcoming deadlines.</div>
          ) : (
            urgentDlines.map(d => {
              const days = daysUntil(d.date);
              const color = days < 0 ? "#c0392b" : days <= 7 ? "#d97706" : days <= 30 ? "#2563eb" : "#2d7a4f";
              return (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f0f0ec" }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{d.title}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{d.type} · {d.date}</div>
                  </div>
                  <span style={{ color, fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", marginLeft: 8 }}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today!" : `${days}d`}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Announcements widget */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Announcements</div>
            <button className="btn btn-sm" onClick={() => goPage("announcements")}>View all</button>
          </div>
          {latestAnnouncements.length === 0 ? (
            <div className="empty">No announcements yet.</div>
          ) : (
            latestAnnouncements.map(a => (
              <div key={a.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid #f0f0ec" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  {a.priority === "urgent" && <span style={{ background: "#c0392b", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 10, padding: "1px 6px" }}>URGENT</span>}
                  {a.pinned && <span style={{ fontSize: 11 }}>📌</span>}
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                </div>
                {a.body && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }} dangerouslySetInnerHTML={{ __html: renderHtml(a.body) }} />}
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>By {a.createdBy}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Budget */}
      {showFinancials && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: totalBudgetTZS > 0 ? 6 : 0 }}>
            <div className="panel-title" style={{ marginBottom: 0 }}>Budget utilisation</div>
            <button className="btn btn-sm" onClick={printSpendingReport}>Spending report</button>
          </div>
          {totalBudgetTZS > 0 ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>TZS {fmt(approvedSpend)} approved</span>
                <span style={{ color: "#888" }}>of TZS {fmt(totalBudgetTZS)} total</span>
              </div>
              <div style={{ background: "#e8e8e4", borderRadius: 5, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${budgetPct}%`, height: 10, borderRadius: 5, background: budgetPct > 90 ? "#c0392b" : "#4a9e6b", transition: "width 0.3s" }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#888" }}>No total grant amount set for this grant yet — set it on the Grants page to see a utilisation bar here.</div>
          )}
        </div>
      )}
    </div>
  );
}
