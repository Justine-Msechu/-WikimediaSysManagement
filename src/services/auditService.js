import { addDocument, listenCollection, orderBy, limit } from "../firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { collection, addDoc } from "firebase/firestore";

export const AUDIT_ACTIONS = {
  LOGIN:             "login",
  LOGOUT:            "logout",
  CREATE:            "create",
  UPDATE:            "update",
  DELETE:            "delete",
  APPROVE:           "approve",
  REJECT:            "reject",
  SUBMIT:            "submit",
  IMPORT:            "import",
  EXPORT:            "export",
  RESET_PASSWORD:    "reset_password",
  ACTIVATE_USER:     "activate_user",
  DEACTIVATE_USER:   "deactivate_user",
  UPLOAD_EVIDENCE:   "upload_evidence",
  DELETE_EVIDENCE:   "delete_evidence",
  BACKUP:            "backup",
};

export async function addAudit(profile, action, module, details = {}) {
  if (!profile) return;
  try {
    await addDoc(collection(db, "auditLogs"), {
      userId:    profile.id || profile.uid || "",
      userName:  profile.name || "",
      role:      profile.role || "",
      action,
      module,
      targetId:    details.targetId || "",
      recordTitle: details.recordTitle || "",
      details:     details.details || "",
      timestamp:   serverTimestamp(),
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

export function listenAuditLogs(callback, maxEntries = 200) {
  return listenCollection("auditLogs", callback, orderBy("timestamp", "desc"), limit(maxEntries));
}
