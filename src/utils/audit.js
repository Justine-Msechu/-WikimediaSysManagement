import { uid } from "../data/store";

export const AUDIT_ACTIONS = {
  // Auth
  USER_LOGIN:         "User logged in",
  USER_LOGOUT:        "User logged out",
  USER_CREATED:       "User account created",
  USER_UPDATED:       "User account updated",
  USER_DELETED:       "User account deleted",
  PASSWORD_CHANGED:   "Password changed",

  // Grant
  GRANT_UPDATED:      "Grant settings updated",

  // Programs & Proposals
  PROPOSAL_CREATED:   "Proposal created",
  PROPOSAL_SUBMITTED: "Proposal submitted",
  PROPOSAL_REVIEWED:  "Proposal reviewed",
  PROPOSAL_APPROVED:  "Proposal approved",
  PROPOSAL_REJECTED:  "Proposal rejected",
  PROPOSAL_RETURNED:  "Proposal returned for revision",
  PROGRAM_CREATED:    "Program created",
  PROGRAM_UPDATED:    "Program updated",
  PROGRAM_DELETED:    "Program deleted",

  // Activities
  ACTIVITY_CREATED:   "Activity created",
  ACTIVITY_UPDATED:   "Activity updated",
  ACTIVITY_DELETED:   "Activity deleted",
  REPORT_GENERATED:   "Activity report generated",

  // Budget
  BUDGET_CREATED:     "Budget entry created",
  BUDGET_SUBMITTED:   "Budget entry submitted for approval",
  BUDGET_APPROVED:    "Budget entry approved",
  BUDGET_REJECTED:    "Budget entry rejected",
  BUDGET_DELETED:     "Budget entry deleted",

  // Participants
  PARTICIPANT_CREATED: "Participant registered",
  PARTICIPANT_UPDATED: "Participant record updated",
  PARTICIPANT_DELETED: "Participant removed",

  // Evidence
  EVIDENCE_ADDED:     "Evidence/document added",
  EVIDENCE_DELETED:   "Evidence/document removed",

  // Metrics
  METRICS_UPDATED:    "Metrics updated",

  // Risks
  RISK_CREATED:       "Risk registered",
  RISK_UPDATED:       "Risk updated",
  RISK_CLOSED:        "Risk closed",

  // Settings
  SETTINGS_CHANGED:   "Settings updated",

  // Backup
  BACKUP_CREATED:     "Manual backup created",
  DATA_IMPORTED:      "Data imported from backup",
  DATA_RESET:         "All data reset",

  // Reports
  FINAL_REPORT_DOWNLOADED: "Final report downloaded",
};

const MAX_LOG = 2000;

/**
 * Returns the updated auditLog array. Call like:
 *   update({ ..., auditLog: addAudit(state.auditLog, currentUser, { ... }) })
 */
export function addAudit(currentLog = [], currentUser, entry) {
  const record = {
    id: uid(),
    timestamp: new Date().toISOString(),
    userId:   currentUser?.id   || "system",
    userName: currentUser?.name || "System",
    userRole: currentUser?.role || "unknown",
    action:      entry.action      || "Unknown action",
    module:      entry.module      || "system",
    recordId:    entry.recordId    || null,
    recordTitle: entry.recordTitle || null,
    details:     entry.details     || null,
  };
  return [record, ...currentLog].slice(0, MAX_LOG);
}

export function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
