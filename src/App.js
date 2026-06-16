import React, { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { logout } from "./firebase/auth";
import { addAudit, AUDIT_ACTIONS } from "./services/auditService";
import { ROLE_LABELS, ROLE_COLORS } from "./services/userService";
import { listenNotifications, markAllRead } from "./services/notificationService";

import Login         from "./pages/Login";
import Dashboard     from "./pages/Dashboard";
import Grant         from "./pages/Grant";
import Programs      from "./pages/Programs";
import Activities    from "./pages/Activities";
import ActivityDetail from "./pages/ActivityDetail";
import Timeline      from "./pages/Timeline";
import Budget        from "./pages/Budget";
import Metrics       from "./pages/Metrics";
import Participants  from "./pages/Participants";
import RegistrationForms from "./pages/RegistrationForms";
import PublicRegister    from "./pages/PublicRegister";
import Review        from "./pages/Review";
import RiskRegister  from "./pages/RiskRegister";
import DonorDashboard from "./pages/DonorDashboard";
import FinalReport   from "./pages/FinalReport";
import AuditLog      from "./pages/AuditLog";
import Users         from "./pages/Users";
import Settings      from "./pages/Settings";

import logo from "./assets/logo.png";
import "./App.css";

const NAV = [
  { id: "dashboard",    label: "Dashboard",     icon: "⊞", roles: null },
  { id: "grant",        label: "Grant",          icon: "◇", roles: null },
  { id: "programs",     label: "Programs",       icon: "◈", roles: null },
  { id: "activities",   label: "Activities",     icon: "◉", roles: null },
  { id: "timeline",     label: "Timeline",       icon: "◷", roles: null },
  { id: "budget",       label: "Budget",         icon: "◎", roles: null },
  { id: "review",       label: "Review",         icon: "✓", roles: null },
  { id: "metrics",      label: "Metrics",        icon: "◑", roles: null },
  { id: "participants", label: "Participants",    icon: "◐", roles: ["admin", "coordinator"] },
  { id: "risks",        label: "Risk register",  icon: "◬", roles: ["admin", "coordinator", "finance_officer"] },
  { id: "donor",        label: "Donor report",   icon: "◌", roles: ["admin", "finance_officer"] },
  { id: "report",       label: "Final report",   icon: "▤", roles: null },
  { id: "audit",        label: "Audit log",      icon: "☰", roles: ["admin"] },
  { id: "users",        label: "Users",          icon: "◯", roles: ["admin"] },
  { id: "register",     label: "Reg. forms",     icon: "◫", roles: ["admin", "coordinator"] },
  { id: "settings",     label: "Settings",       icon: "⚙", roles: null },
];

function getPublicFormId() {
  try { return new URLSearchParams(window.location.search).get("form"); }
  catch { return null; }
}

function AppShell() {
  const { currentUser, profile, loading } = useAuth();
  const [page, setPage]                   = useState("dashboard");
  const [selectedActivityId, setSelectedActivityId] = useState(null);

  const publicFormId = getPublicFormId();

  if (loading) {
    return (
      <div className="auth-wrap">
        <div style={{ color: "#888", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  // Public registration — no login required
  if (publicFormId) {
    return <PublicRegister formId={publicFormId} />;
  }

  if (!currentUser || !profile) {
    return <Login />;
  }

  // Inactive account
  if (profile.isActive === false) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-title" style={{ color: "#c0392b" }}>Account deactivated</div>
          <div className="auth-sub">Contact your administrator.</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => logout()}>Sign out</button>
        </div>
      </div>
    );
  }

  const role = profile.role;
  const [budgetEntries,   setBudgetEntries]   = React.useState([]);
  const [reviewPrograms,  setReviewPrograms]  = React.useState([]);
  const [notifications,   setNotifications]   = React.useState([]);
  const [showNotifPanel,  setShowNotifPanel]  = React.useState(false);

  React.useEffect(() => {
    const { listenBudgetEntries } = require("./services/budgetService");
    const { listenPrograms }      = require("./services/programService");
    const u1 = listenBudgetEntries(setBudgetEntries);
    const u2 = listenPrograms(setReviewPrograms);
    const u3 = listenNotifications(role, setNotifications);
    return () => { u1(); u2(); u3(); };
  }, [role]);

  const pendingBudget   = budgetEntries.filter(e => e.status === "submitted").length;
  const pendingPrograms = reviewPrograms.filter(p => p.status === "submitted").length;
  const myDraftCount    = budgetEntries.filter(e => e.status === "draft" && e.requestedBy === profile?.name).length;
  const reviewBadge     = ["admin","finance_officer"].includes(role)
    ? pendingBudget + pendingPrograms
    : myDraftCount + pendingPrograms;

  const unreadNotifs  = notifications.filter(n => !n.read);
  const markAllAsRead = () => {
    const ids = unreadNotifs.map(n => n.id);
    if (ids.length) markAllRead(ids).catch(() => {});
    setShowNotifPanel(false);
  };

  const handleLogout = async () => {
    await addAudit(profile, AUDIT_ACTIONS.LOGOUT, "auth", { details: "Signed out" });
    await logout();
    setPage("dashboard");
    setSelectedActivityId(null);
  };

  const goPage = (id, extraId) => {
    if (id === "activity-detail" && extraId) {
      setSelectedActivityId(extraId);
    } else {
      setSelectedActivityId(null);
      setPage(id);
    }
  };

  const visibleNav = NAV.filter(n => !n.roles || n.roles.includes(role));
  const activePage = selectedActivityId ? null : page;

  const renderPage = () => {
    if (selectedActivityId) {
      return <ActivityDetail activityId={selectedActivityId} profile={profile} goPage={goPage} />;
    }
    switch (page) {
      case "dashboard":    return <Dashboard    profile={profile} goPage={goPage} />;
      case "grant":        return <Grant        profile={profile} />;
      case "programs":     return <Programs     profile={profile} />;
      case "activities":   return <Activities   profile={profile} goPage={goPage} />;
      case "timeline":     return <Timeline     profile={profile} goPage={goPage} />;
      case "budget":       return <Budget       profile={profile} />;
      case "review":       return <Review       profile={profile} goPage={goPage} />;
      case "metrics":      return <Metrics      profile={profile} />;
      case "participants": return <Participants profile={profile} />;
      case "risks":        return <RiskRegister profile={profile} />;
      case "donor":        return <DonorDashboard profile={profile} />;
      case "report":       return <FinalReport  profile={profile} />;
      case "audit":        return role === "admin" ? <AuditLog profile={profile} /> : <Dashboard profile={profile} goPage={goPage} />;
      case "users":        return role === "admin" ? <Users    profile={profile} /> : <Dashboard profile={profile} goPage={goPage} />;
      case "register":     return <RegistrationForms profile={profile} />;
      case "settings":     return <Settings     profile={profile} />;
      default:             return <Dashboard    profile={profile} goPage={goPage} />;
    }
  };

  const roleColor = ROLE_COLORS[role] || "#888";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="Wikimedia Community Kilimanjaro" className="sidebar-logo" />
        </div>

        <nav className="sidebar-nav">
          {visibleNav.map(n => (
            <button
              key={n.id}
              className={`nav-item ${activePage === n.id ? "active" : ""}`}
              onClick={() => goPage(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
              {n.id === "review" && reviewBadge > 0 && (
                <span style={{ marginLeft: "auto", background: "#d97706", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{reviewBadge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Notification bell */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            <button
              onClick={() => setShowNotifPanel(v => !v)}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#ccc", fontSize: 12, cursor: "pointer", padding: "6px 10px", display: "flex", alignItems: "center", gap: 8 }}
            >
              <span style={{ fontSize: 16 }}>🔔</span>
              <span>Notifications</span>
              {unreadNotifs.length > 0 && (
                <span style={{ marginLeft: "auto", background: "#c0392b", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{unreadNotifs.length}</span>
              )}
            </button>
            {showNotifPanel && (
              <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e8e8e4", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 1000, maxHeight: 320, overflowY: "auto", marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #f0f0ec" }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#1c2b1e" }}>Notifications</span>
                  {unreadNotifs.length > 0 && <button onClick={markAllAsRead} style={{ fontSize: 11, color: "#4a9e6b", background: "none", border: "none", cursor: "pointer" }}>Mark all read</button>}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: "16px 14px", color: "#aaa", fontSize: 13 }}>No notifications yet.</div>
                ) : (
                  notifications.slice(0, 20).map(n => (
                    <div
                      key={n.id}
                      onClick={() => { if (n.link) { goPage(n.link); } setShowNotifPanel(false); if (!n.read) markAllRead([n.id]).catch(() => {}); }}
                      style={{ padding: "10px 14px", borderBottom: "1px solid #f5f4f0", cursor: n.link ? "pointer" : "default", background: n.read ? "#fff" : "#f0f7f3" }}
                    >
                      <div style={{ fontWeight: n.read ? 400 : 600, fontSize: 13, color: "#1c2b1e", marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>{n.body}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="role-badge-block">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className="role-dot" style={{ background: roleColor }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#e8e8e4" }}>{profile.name}</div>
                <div style={{ fontSize: 10, color: roleColor }}>{ROLE_LABELS[role]}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: "100%", marginTop: 6, padding: "5px 0",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 5, color: "#aaa", fontSize: 11, cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-wrap">{renderPage()}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
