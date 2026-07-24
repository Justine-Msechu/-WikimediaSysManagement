/**
 * Evidence service — Firestore-only, no Firebase Storage required.
 * Team members add links to files hosted on Google Drive, Dropbox,
 * OneDrive, Meta-Wiki, or any public URL.
 */
import { addEvidence, deleteEvidence } from "./activityService";
import { addAudit, AUDIT_ACTIONS } from "./auditService";

export const EVIDENCE_TYPES = [
  "Photo / gallery link",
  "Video link",
  "Attendance sheet",
  "Report document",
  "Outreach Dashboard link",
  "Meta-Wiki page",
  "Other",
];

export async function addEvidenceLink(activityId, { url, title, evidenceType, description }, profile) {
  if (!url?.trim()) throw new Error("URL is required.");

  const evidenceId = await addEvidence({
    activityId,
    url:          url.trim(),
    title:        title?.trim() || url.trim(),
    evidenceType: evidenceType || "Other",
    description:  description?.trim() || "",
    addedBy:      profile?.name || "",
    addedById:    profile?.id   || "",
    addedAt:      new Date().toISOString(),
  });

  await addAudit(profile, AUDIT_ACTIONS.UPLOAD_EVIDENCE, "activities", {
    targetId:    activityId,
    recordTitle: title || url,
    details:     `Added ${evidenceType}: ${title || url}`,
  });

  return evidenceId;
}

export async function removeEvidenceLink(evidence, profile) {
  await deleteEvidence(evidence.id);
  await addAudit(profile, AUDIT_ACTIONS.DELETE_EVIDENCE, "activities", {
    targetId:    evidence.activityId,
    recordTitle: evidence.title || evidence.url,
    details:     `Removed evidence link: ${evidence.title || evidence.url}`,
  });
}
