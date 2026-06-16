import React, { useState, useEffect, useMemo } from "react";
import { listenAuditLogs, AUDIT_ACTIONS } from "../services/auditService";
import { ROLE_LABELS } from "../services/userService";

function tsLabel(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ACTION_BADGE = {
  login:           { label: "Login",           cls: "badge-green" },
  logout:          { label: "Logout",          cls: "badge-gray"  },
  create:          { label: "Create",          cls: "badge-blue"  },
  update:          { label: "Update",          cls: "badge-blue"  },
  delete:          { label: "Delete",          cls: "badge-red"   },
  approve:         { label: "Approve",         cls: "badge-green" },
  reject:          { label: "Reject",          cls: "badge-red"   },
  submit:          { label: "Submit",          cls: "badge-blue"  },
  import:          { label: "Import",          cls: "badge-blue"  },
  export:          { label: "Export",          cls: "badge-gray"  },
  backup:          { label: "Backup",          cls: "badge-blue"  },
  upload_evidence: { label: "Upload",          cls: "badge-blue"  },
  delete_evidence: { label: "Delete evidence", cls: "badge-red"   },
};

export default function AuditLog({ profile }) {
  const [logs,        setLogs]        = useState([]);
  const [filterModule, setFilterModule] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [search,      setSearch]      = useState("");

  useEffect(() => { return listenAuditLogs(setLogs, 500); }, []);

  const modules = useMemo(() => ["all", ...new Set(logs.map(l => l.module).filter(Boolean))], [logs]);
  const actions = useMemo(() => ["all", ...new Set(logs.map(l => l.action).filter(Boolean))], [logs]);

  const filtered = useMemo(() => logs.filter(l => {
    if (filterModule !== "all" && l.module !== filterModule) return false;
    if (filterAction !== "all" && l.action !== filterAction) return false;
    if (search && !JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [logs, filterModule, filterAction, search]);

  return (
    <div>
      <div className="page-title">Audit log</div>
      <div className="page-sub">Every significant action is recorded here. Admin-only view.</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ flex: 1, minWidth: 180, fontSize: 13 }} />
        <select value={filterModule} onChange={e => setFilterModule(e.target.value)} style={{ fontSize: 12 }}>
          {modules.map(m => <option key={m} value={m}>{m === "all" ? "All modules" : m}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ fontSize: 12 }}>
          {actions.map(a => <option key={a} value={a}>{a === "all" ? "All actions" : a}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>{filtered.length} entries</span>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {filtered.length === 0 ? <div className="empty">No audit entries match this filter.</div> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>Module</th><th>Target</th><th>Details</th></tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => {
                  const badge = ACTION_BADGE[l.action] || { label: l.action, cls: "badge-gray" };
                  return (
                    <tr key={l.id || i}>
                      <td style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>{tsLabel(l.timestamp)}</td>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{l.userName || "—"}</td>
                      <td><span style={{ fontSize: 11, color: "#555" }}>{ROLE_LABELS[l.role] || l.role || "—"}</span></td>
                      <td><span className={`badge ${badge.cls}`} style={{ fontSize: 10 }}>{badge.label}</span></td>
                      <td style={{ fontSize: 12, color: "#555" }}>{l.module || "—"}</td>
                      <td style={{ fontSize: 12 }}>{l.recordTitle || l.targetId || "—"}</td>
                      <td style={{ fontSize: 12, color: "#888", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{l.details || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
