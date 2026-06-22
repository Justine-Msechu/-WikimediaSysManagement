import React, { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { logout } from "./firebase/auth";
import { addAudit, AUDIT_ACTIONS } from "./services/auditService";
import { ROLE_LABELS, ROLE_COLORS } from "./services/userService";
import { listenNotifications, markAllRead } from "./services/notificationService";
import { listenGrants } from "./services/grantService";
import OnboardingModal from "./components/OnboardingModal";
import BackToTop      from "./components/BackToTop";

import Login         from "./pages/Login";
import Dashboard     from "./pages/Dashboard";
import Grant         from "./pages/Grant";
import Programs      from "./pages/Programs";
import Activities    from "./pages/Activities";
import ActivityDetail from "./pages/ActivityDetail";
import Timeline      from "./pages/Timeline";
import Budget        from "./pages/Budget";
import Invoices      from "./pages/Invoices";
import Metrics       from "./pages/Metrics";
import Participants  from "./pages/Participants";
import RegistrationForms from "./pages/RegistrationForms";
import Volunteers        from "./pages/Volunteers";
import PublicRegister    from "./pages/PublicRegister";
import Review        from "./pages/Review";
import RiskRegister  from "./pages/RiskRegister";
import DonorDashboard from "./pages/DonorDashboard";
import FinalReport   from "./pages/FinalReport";
import AuditLog      from "./pages/AuditLog";
import Users         from "./pages/Users";
import Settings      from "./pages/Settings";
import MyTasks       from "./pages/MyTasks";
import Announcements from "./pages/Announcements";
import Deadlines     from "./pages/Deadlines";
import Help          from "./pages/Help";

import logo from "./assets/logo.png";
import "./App.css";

// Flat lookup — used for role filtering and rendering detail
const NAV_ITEMS = {
  dashboard:    { label: "Dashboard",    icon: "⊞", roles: null },
  announcements:{ label: "Announcements",icon: "📢", roles: null },
  deadlines:    { label: "Deadlines",    icon: "⏰", roles: null },
  grant:        { label: "Grant",        icon: "◇", roles: ["admin"] },
  programs:     { label: "Programs",     icon: "◈", roles: null },
  timeline:     { label: "Timeline",     icon: "◷", roles: null },
  metrics:      { label: "Metrics",      icon: "◑", roles: null },
  activities:   { label: "Activities",   icon: "◉", roles: null },
  participants: { label: "Participants", icon: "◐", roles: ["admin", "coordinator"] },
  volunteers:   { label: "Volunteers",   icon: "◎", roles: ["admin", "coordinator"] },
  register:     { label: "Reg. forms",   icon: "◫", roles: ["admin", "coordinator"] },
  budget:       { label: "Budget",       icon: "◎", roles: null },
  invoices:     { label: "Invoices",     icon: "▤", roles: ["admin", "finance_officer"] },
  review:       { label: "Review",       icon: "✓", roles: null },
  report:       { label: "Final report", icon: "▤", roles: null },
  donor:        { label: "Donor report", icon: "◌", roles: ["admin", "finance_officer"] },
  risks:        { label: "Risk register",icon: "◬", roles: ["admin", "coordinator", "finance_officer"] },
  audit:        { label: "Audit log",    icon: "☰", roles: ["admin"] },
  users:        { label: "Users",        icon: "◯", roles: ["admin"] },
  settings:     { label: "Settings",     icon: "⚙", roles: null },
  mytasks:      { label: "My tasks",     icon: "✓", roles: ["volunteer"] },
  help:         { label: "Help & guide", icon: "?", roles: null },
};

// Grouped modules for the sidebar
const NAV_GROUPS = [
  { label: "Overview",         ids: ["dashboard", "announcements", "deadlines"] },
  { label: "Grant & planning", ids: ["grant", "programs", "timeline", "metrics"] },
  { label: "Activities",       ids: ["activities", "participants", "volunteers", "register"] },
  { label: "Finance",          ids: ["budget", "invoices", "review"] },
  { label: "Reports",          ids: ["report", "donor", "risks"] },
  { label: "Admin",            ids: ["audit", "users", "settings"] },
  { label: "Help",             ids: ["help"] },
];

const VOLUNTEER_GROUPS = [
  { label: "My portal", ids: ["mytasks", "announcements", "deadlines"] },
  { label: "Help",      ids: ["help"] },
];

function getPublicFormId() {
  try { return new URLSearchParams(window.location.search).get("form"); }
  catch { return null; }
}

function AppShell() {
  const { currentUser, profile, loading } = useAuth();
  const [page, setPage]                   = useState("dashboard");
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [budgetEntries,   setBudgetEntries]   = React.useState([]);
  const [reviewPrograms,  setReviewPrograms]  = React.useState([]);
  const [notifications,   setNotifications]   = React.useState([]);
  const [showNotifPanel,  setShowNotifPanel]  = React.useState(false);
  const [grants,          setGrants]          = React.useState([]);
  const [currentGrantId,  setCurrentGrantIdState] = React.useState(
    () => localStorage.getItem("wkgsf_currentGrantId") || ""
  );

  const setCurrentGrant = (id) => {
    setCurrentGrantIdState(id);
    localStorage.setItem("wkgsf_currentGrantId", id);
  };

  const onboardingKey = profile ? `wkgsf_onboarded_${profile.id}` : null;
  const [showOnboarding, setShowOnboarding] = React.useState(
    () => onboardingKey ? !localStorage.getItem(onboardingKey) : false
  );
  const dismissOnboarding = () => {
    if (onboardingKey) localStorage.setItem(onboardingKey, "1");
    setShowOnboarding(false);
  };

  React.useEffect(() => {
    if (!profile || profile.role === "volunteer") return;
    const { listenBudgetEntries } = require("./services/budgetService");
    const { listenPrograms }      = require("./services/programService");
    const { purgeOrphanedData }   = require("./services/grantService");
    const u1 = listenBudgetEntries(setBudgetEntries);
    const u2 = listenPrograms(setReviewPrograms);
    const u3 = listenNotifications(profile.role, profile.name || "", setNotifications);
    const u4 = listenGrants(setGrants);
    purgeOrphanedData().catch(() => {});
    return () => { u1(); u2(); u3(); u4(); };
  }, [profile?.role, profile?.name]);

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

  const role        = profile.role;
  const isVolunteer = role === "volunteer";

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
    setSidebarOpen(false);
    if (id === "activity-detail" && extraId) {
      setSelectedActivityId(extraId);
    } else {
      setSelectedActivityId(null);
      setPage(id);
    }
  };

  // Build visible grouped nav
  const visibleGroups = (isVolunteer ? VOLUNTEER_GROUPS : NAV_GROUPS).map(group => ({
    ...group,
    items: group.ids
      .filter(id => {
        const item = NAV_ITEMS[id];
        if (!item) return false;
        return !item.roles || item.roles.includes(role);
      })
      .map(id => ({ id, ...NAV_ITEMS[id] })),
  })).filter(g => g.items.length > 0);

  const effectivePage = isVolunteer ? "mytasks" : page;
  const activePage    = selectedActivityId ? null : effectivePage;

  const renderPage = () => {
    if (isVolunteer) {
      if (page === "announcements") return <Announcements profile={profile} />;
      if (page === "deadlines")     return <Deadlines     profile={profile} />;
      if (page === "help")          return <Help          profile={profile} />;
      return <MyTasks profile={profile} />;
    }
    if (selectedActivityId) {
      return <ActivityDetail activityId={selectedActivityId} profile={profile} goPage={goPage} />;
    }

    // Auto-select first grant if none selected or if saved ID no longer exists
    const currentGrant = grants.find(g => g.id === currentGrantId) || null;
    if (grants.length > 0 && !currentGrant) {
      setCurrentGrant(grants[0].id);
    }

    // Guard: data pages require a grant to be selected
    const DATA_PAGES = ["dashboard","programs","activities","timeline","budget","invoices","review","metrics","participants","risks","donor","report"];
    if (!currentGrant && DATA_PAGES.includes(page)) {
      return (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60vh", gap:16, textAlign:"center", padding:24 }}>
          <div style={{ fontSize:52 }}>🗂️</div>
          <div style={{ fontSize:22, fontWeight:700, color:"#1c2b1e" }}>No grant selected</div>
          <div style={{ fontSize:14, color:"#666", maxWidth:340 }}>
            {grants.length === 0
              ? "No grants have been created yet. Create your first grant to get started."
              : "Select a grant from the dropdown in the sidebar to view its data."}
          </div>
          {role === "admin" && <button className="btn btn-primary" onClick={() => goPage("grant")}>Go to Grants</button>}
        </div>
      );
    }

    switch (page) {
      case "dashboard":    return <Dashboard    key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} grants={grants} currentGrant={currentGrant} />;
      case "grant":        return role === "admin" ? <Grant profile={profile} currentGrantId={currentGrantId} onSelectGrant={setCurrentGrant} /> : <Dashboard key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} grants={grants} currentGrant={currentGrant} />;
      case "programs":     return <Programs     key={currentGrantId} profile={profile} grantId={currentGrantId} />;
      case "activities":   return <Activities   key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} />;
      case "timeline":     return <Timeline     key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} />;
      case "budget":       return <Budget       key={currentGrantId} profile={profile} grantId={currentGrantId} currentGrant={currentGrant} />;
      case "invoices":     return ["admin","finance_officer"].includes(role) ? <Invoices key={currentGrantId} profile={profile} grantId={currentGrantId} currentGrant={currentGrant} /> : <Dashboard key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} grants={grants} currentGrant={currentGrant} />;
      case "review":       return <Review       key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} />;
      case "metrics":      return <Metrics      key={currentGrantId} profile={profile} grantId={currentGrantId} currentGrant={currentGrant} />;
      case "participants": return <Participants key={currentGrantId} profile={profile} grantId={currentGrantId} />;
      case "risks":        return <RiskRegister key={currentGrantId} profile={profile} grantId={currentGrantId} />;
      case "donor":        return <DonorDashboard key={currentGrantId} profile={profile} grantId={currentGrantId} currentGrant={currentGrant} />;
      case "report":       return <FinalReport  key={currentGrantId} profile={profile} grantId={currentGrantId} currentGrant={currentGrant} />;
      case "audit":        return role === "admin" ? <AuditLog profile={profile} /> : <Dashboard key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} grants={grants} />;
      case "users":        return role === "admin" ? <Users    profile={profile} /> : <Dashboard key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} grants={grants} />;
      case "volunteers":    return <Volunteers         profile={profile} />;
      case "register":      return <RegistrationForms profile={profile} />;
      case "announcements": return <Announcements     profile={profile} />;
      case "deadlines":     return <Deadlines         profile={profile} />;
      case "settings":      return <Settings          profile={profile} goPage={goPage} />;
      case "help":          return <Help              profile={profile} />;
      default:             return <Dashboard    key={currentGrantId} profile={profile} goPage={goPage} grantId={currentGrantId} grants={grants} />;
    }
  };

  const roleColor = ROLE_COLORS[role] || "#888";

  return (
    <div className="app-layout">

      {/* Mobile top bar — only visible on small screens */}
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(v => !v)} aria-label="Open menu">
          <span /><span /><span />
        </button>
        <img src={logo} alt="logo" className="mobile-topbar-logo" />
        <span className="mobile-topbar-title">GSF Manager</span>
        {unreadNotifs.length > 0 && (
          <span style={{ background: "#c0392b", color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{unreadNotifs.length}</span>
        )}
      </div>

      {/* Backdrop overlay — closes sidebar when tapped */}
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="Wikimedia Community Kilimanjaro" className="sidebar-logo" />
        </div>

        {!isVolunteer && (
          <div style={{ padding: "0 12px 10px" }}>
            <div style={{ fontSize: 10, color: "#6b8f7a", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 4 }}>Active grant</div>
            <select
              value={currentGrantId}
              onChange={e => setCurrentGrant(e.target.value)}
              style={{ width: "100%", fontSize: 12, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: currentGrantId ? "#e8e8e4" : "#6b8f7a", padding: "6px 8px", cursor: "pointer" }}
            >
              <option value="">— select a grant —</option>
              {grants.map(g => (
                <option key={g.id} value={g.id}>{g.title || g.grantNumber || "Untitled"}{g.type === "Rapid Grant" ? " [R]" : ""}</option>
              ))}
            </select>
          </div>
        )}

        <nav className="sidebar-nav">
          {visibleGroups.map((group, gi) => (
            <React.Fragment key={group.label}>
              {gi > 0 && <div className="nav-divider" />}
              <span className="nav-section-label">{group.label}</span>
              {group.items.map(n => (
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
            </React.Fragment>
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

      {/* Shown only when printing — logo header on every printed page */}
      <div className="print-logo-header">
        <img src={logo} alt="Wikimedia Community Kilimanjaro" />
        <div>
          <div className="print-org-name">Wikimedia Community Kilimanjaro</div>
          <div className="print-org-sub">Youth Technology · GSF Manager</div>
        </div>
        <div className="print-date">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
      </div>

      <main className="main-content">
        <div className="page-wrap">{renderPage()}</div>
      </main>

      {showOnboarding && (
        <OnboardingModal profile={profile} onDismiss={dismissOnboarding} />
      )}

      <BackToTop />
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
