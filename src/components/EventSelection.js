import React, { useState, useEffect, useMemo } from "react";
import { reportScope } from "../utils/wikiContribs";
import { listenCommunityMembers, listenContributorReports, addCommunityMembersBulk } from "../services/contributorService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { planEventSeats, DEFAULT_NEW_MEMBER_PCT } from "../utils/eventSelection";

function monthLabel(month) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function StatusBadge({ status }) {
  return status === "recommended"
    ? <span className="badge badge-green">Recommended</span>
    : <span className="badge badge-amber">Waiting list</span>;
}

// "Who should join" panel for one registration form (event).
export default function EventSelection({ form, registrations, profile, canEdit, showToast }) {
  const [members, setMembers] = useState([]);
  const [reports, setReports] = useState([]);
  const [busy,    setBusy]    = useState(false);

  useEffect(() => {
    const u1 = listenCommunityMembers(setMembers);
    const u2 = listenContributorReports(setReports);
    return () => { u1(); u2(); };
  }, []);

  const newPct = form.newMemberPct === "" || form.newMemberPct == null ? DEFAULT_NEW_MEMBER_PCT : Number(form.newMemberPct);
  const plan = useMemo(() => planEventSeats({
    // Ranked by whole-wiki reports: how much each member edits Wikipedia overall.
    registrations, members, reports: reports.filter(r => reportScope(r) === "all"),
    seats: form.seats || form.maxRegistrations,
    newPct,
    eventMonth: (form.date || "").slice(0, 7),
  }), [registrations, members, reports, form.seats, form.maxRegistrations, form.date, newPct]);

  // New registrants who gave a Wikipedia username can join the community list.
  const addable = plan.newcomers.filter(p => p.username);
  const noUsername = plan.newcomers.length - addable.length;

  const addNewMembers = async () => {
    if (!addable.length) return;
    if (!window.confirm(`Add ${addable.length} new registrant${addable.length === 1 ? "" : "s"} to the community list?`)) return;
    setBusy(true);
    try {
      await addCommunityMembersBulk(addable.map(p => ({
        name: (p.reg.name || "").trim() || p.username,
        wikimediaUsername: p.username,
        isActive: true,
        source: "registration",
      })));
      await addAudit(profile, AUDIT_ACTIONS.IMPORT, "contributors", {
        targetId: form.id, recordTitle: form.title,
        details: `Added ${addable.length} new member${addable.length === 1 ? "" : "s"} from registrations for "${form.title}"`,
      });
      showToast(`Added ${addable.length} to the community list.`);
    } catch (e) {
      alert(`Could not add members: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (registrations.length === 0) return null;

  const rows = [...plan.existing, ...plan.newcomers];

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-title">Who should join</div>

      <div className="card-grid">
        {[
          ["Seats",                    plan.seats,            "#1c2b1e"],
          [`For new members (${newPct}%)`, plan.newSeats,      "#2563eb"],
          ["Recommended",              plan.recommended,      "#2d7a4f"],
          ["Waiting list",             rows.length - plan.recommended, "#d97706"],
        ].map(([label, value, color]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {plan.month ? (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
          Existing members are ranked by different articles edited in <strong>{monthLabel(plan.month)}</strong> (latest saved Active contributors report{form.date ? " before the event" : ""}).
          New members fill their seats in the order they registered. Seats one group can't fill go to the other.
        </div>
      ) : (
        <div className="alert alert-warn">No saved Active contributors report yet, so existing members are listed in the order they registered. Save a monthly report on the Active contributors page to rank them by contributions.</div>
      )}

      {canEdit && plan.newcomers.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn btn-sm btn-primary" onClick={addNewMembers} disabled={busy || addable.length === 0}>
            {busy ? "Adding…" : `Add ${addable.length} new member${addable.length === 1 ? "" : "s"} to community list`}
          </button>
          {noUsername > 0 && <span style={{ fontSize: 12, color: "#888" }}>{noUsername} new registrant{noUsername === 1 ? " has" : "s have"} no Wikipedia username yet and can be added once they create an account.</span>}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Wikipedia username</th><th>Type</th><th>Articles ({plan.month ? monthLabel(plan.month) : "last month"})</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.reg.id}>
                <td style={{ fontSize: 12, color: "#888" }}>{p.rank}</td>
                <td style={{ fontWeight: 500 }}>{p.reg.name}</td>
                <td style={{ fontSize: 12 }}>{p.username || <span style={{ color: "#aaa" }}>none</span>}</td>
                <td>{p.isMember ? <span className="badge badge-green">Member</span> : <span className="badge badge-blue">New</span>}</td>
                <td>{p.isMember ? p.articles : ""}</td>
                <td><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
