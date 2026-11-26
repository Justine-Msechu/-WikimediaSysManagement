import React, { useState, useEffect, useMemo } from "react";
import { reportScope } from "../utils/wikiContribs";
import { listenCommunityMembers, listenContributorReports, addCommunityMembersBulk } from "../services/contributorService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { setSeatChoice } from "../services/registrationService";
import { planEventSeats, DEFAULT_NEW_MEMBER_PCT } from "../utils/eventSelection";

function monthLabel(month) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function StatusBadge({ status, choice }) {
  const byHand = choice ? <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>(chosen)</span> : null;
  return status === "recommended"
    ? <><span className="badge badge-green">{choice ? "Seat given" : "Recommended"}</span>{byHand}</>
    : <><span className="badge badge-amber">Waiting list</span>{byHand}</>;
}

// "Who should join" panel for one registration form (event).
export default function EventSelection({ form, registrations, profile, canEdit, showToast, grantId = "", firstGrantId = "", onPlan }) {
  const [members, setMembers] = useState([]);
  const [reports, setReports] = useState([]);
  const [busy,    setBusy]    = useState(false);
  const [saving,  setSaving]  = useState("");   // registration id whose seat is being saved

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

  // Share each registration's type and seat with the registrations table.
  useEffect(() => {
    if (!onPlan) return;
    const byReg = {};
    [...plan.existing, ...plan.newcomers].forEach(p => { byReg[p.reg.id] = { isMember: p.isMember, status: p.status, choice: p.choice }; });
    plan.repeats.forEach(reg => { byReg[reg.id] = { repeat: true }; });
    onPlan(byReg);
  }, [plan, onPlan]);

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
      })), { grantId, firstGrantId, existing: members });
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

  // Coordinator decides a seat by hand: "in", "out" or "" (back to automatic).
  const chooseSeat = async (p, seat) => {
    setSaving(p.reg.id);
    try {
      await setSeatChoice(p.reg.id, seat);
      const what = seat === "in" ? "Gave a seat to" : seat === "out" ? "Moved to the waiting list:" : "Seat back to automatic for";
      await addAudit(profile, AUDIT_ACTIONS.UPDATE, "registrations", {
        targetId: p.reg.id, recordTitle: form.title,
        details: `${what} ${p.reg.name || p.username} ("${form.title}")`,
      });
      showToast(`${what} ${p.reg.name || p.username}.`);
    } catch (e) {
      alert(`Could not save the seat: ${e.message}`);
    } finally {
      setSaving("");
    }
  };

  if (registrations.length === 0) return null;

  const rows = [...plan.existing, ...plan.newcomers];
  const noUser = plan.newcomers.filter(p => !p.username).length;
  const wait = (list) => list.filter(p => p.status !== "recommended").length;
  const groups = [
    { key: "m", list: plan.existing,  title: `Existing community members (${plan.existing.length})`, note: "ranked by articles edited" },
    { key: "n", list: plan.newcomers, title: `New — not on the community list yet (${plan.newcomers.length})`, note: "in the order they registered" },
  ].filter(g => g.list.length);

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

      <div className="alert alert-info" style={{ marginBottom: 10 }}>
        <strong>{registrations.length}</strong> registration{registrations.length === 1 ? "" : "s"}:{" "}
        <strong>{plan.existing.length}</strong> existing member{plan.existing.length === 1 ? "" : "s"}
        {plan.existing.length > 0 && ` (${plan.existing.length - wait(plan.existing)} recommended${wait(plan.existing) ? `, ${wait(plan.existing)} waiting` : ""})`}
        {" · "}<strong>{plan.newcomers.length}</strong> new
        {plan.newcomers.length > 0 && ` (${plan.newcomers.length - wait(plan.newcomers)} recommended${wait(plan.newcomers) ? `, ${wait(plan.newcomers)} waiting` : ""}${noUser ? `; ${noUser} without a username` : ""})`}
        {plan.repeats.length > 0 && <>{" · "}<strong>{plan.repeats.length}</strong> registered twice, counted once ({plan.repeats.map(r => r.name || r.wikimediaUsername).join(", ")})</>}.
        {" "}Numbers restart in each group below.
      </div>

      {plan.month ? (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
          Existing members are ranked by different articles edited in <strong>{monthLabel(plan.month)}</strong> (latest saved Active contributors report{form.date ? " before the event" : ""}).
          New members fill their seats in the order they registered. Seats one group can't fill go to the other.
        </div>
      ) : (
        <div className="alert alert-warn">No saved Active contributors report yet, so existing members are listed in the order they registered. Save a monthly report on the Active contributors page to rank them by contributions.</div>
      )}

      {canEdit && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
          To choose someone yourself, click <strong>Give seat</strong>: the lowest-ranked person who wasn't chosen moves to the waiting list. <strong>Move to waiting list</strong> frees a seat for the next in line. <strong>Undo</strong> lets the ranking decide again.
        </div>
      )}

      {plan.overBooked > 0 && (
        <div className="alert alert-warn">More people were given a seat by hand than there are seats: <strong>{plan.overBooked}</strong> over the {plan.seats} seats. Move someone to the waiting list, or raise the seats on the form.</div>
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
          <thead><tr><th>#</th><th>Name</th><th>Wikipedia username</th><th>Type</th><th>Articles ({plan.month ? monthLabel(plan.month) : "last month"})</th><th>Status</th>{canEdit && <th>Change seat</th>}</tr></thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.key}>
              <tr><td colSpan={canEdit ? 7 : 6} style={{ background: "#f5f4f0", fontWeight: 600, fontSize: 13 }}>{g.title} <span style={{ fontWeight: 400, color: "#888" }}>— {g.note}</span></td></tr>
            {g.list.map(p => (
              <tr key={p.reg.id}>
                <td style={{ fontSize: 12, color: "#888" }}>{p.rank}</td>
                <td style={{ fontWeight: 500 }}>{p.reg.name}</td>
                <td style={{ fontSize: 12 }}>{p.username || <span style={{ color: "#aaa" }}>none</span>}</td>
                <td>{p.isMember ? <span className="badge badge-green">Member</span> : <span className="badge badge-blue">New</span>}</td>
                <td>{p.isMember ? p.articles : ""}</td>
                <td><StatusBadge status={p.status} choice={p.choice} /></td>
                {canEdit && (
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.status === "recommended"
                        ? <button className="btn btn-sm" disabled={saving === p.reg.id} onClick={() => chooseSeat(p, "out")}>Move to waiting list</button>
                        : <button className="btn btn-sm btn-primary" disabled={saving === p.reg.id} onClick={() => chooseSeat(p, "in")}>Give seat</button>}
                      {p.choice && <button className="btn btn-sm" disabled={saving === p.reg.id} onClick={() => chooseSeat(p, "")} title="Let the ranking decide again">Undo</button>}
                    </div>
                  </td>
                )}
              </tr>
            ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
