export const ROLES = {
  ADMIN:          "admin",
  COORDINATOR:    "coordinator",
  FINANCE_OFFICER: "finance_officer",
  VIEWER:         "viewer",
};

export const ROLE_LABELS = {
  admin:           "Admin",
  coordinator:     "Coordinator",
  finance_officer: "Finance Officer",
  viewer:          "Viewer",
};

export const ROLE_DESCRIPTIONS = {
  admin:           "Full system access — grant, users, settings, audit log",
  coordinator:     "Log activities, submit proposals, update metrics and reports",
  finance_officer: "Manage budget entries, approve expenses, generate financial reports",
  viewer:          "Read-only access to all data and reports",
};

export const ROLE_COLORS = {
  admin:           "#c0392b",
  coordinator:     "#2563eb",
  finance_officer: "#d97706",
  viewer:          "#888",
};

// Role hierarchy for access checks (higher index = more permission)
const ROLE_RANK = { viewer: 0, finance_officer: 1, coordinator: 1, admin: 3 };

export function roleAtLeast(userRole, minRole) {
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[minRole] ?? 99);
}

export function canEditActivity(currentUser, activity) {
  if (!currentUser) return false;
  if (currentUser.role === ROLES.ADMIN) return true;
  if (currentUser.role === ROLES.COORDINATOR) {
    return !activity || activity.createdBy === currentUser.id;
  }
  return false;
}

export function canDeleteActivity(currentUser) {
  return currentUser?.role === ROLES.ADMIN;
}

export function canApproveBudget(currentUser) {
  return currentUser?.role === ROLES.ADMIN || currentUser?.role === ROLES.FINANCE_OFFICER;
}

export function canEditBudget(currentUser) {
  return [ROLES.ADMIN, ROLES.COORDINATOR, ROLES.FINANCE_OFFICER].includes(currentUser?.role);
}

export function canApproveProposal(currentUser) {
  return currentUser?.role === ROLES.ADMIN;
}

export function canSubmitProposal(currentUser) {
  return [ROLES.ADMIN, ROLES.COORDINATOR].includes(currentUser?.role);
}

export function canEditMetrics(currentUser) {
  return [ROLES.ADMIN, ROLES.COORDINATOR].includes(currentUser?.role);
}

export function canManageUsers(currentUser) {
  return currentUser?.role === ROLES.ADMIN;
}

export function canViewAuditLog(currentUser) {
  return currentUser?.role === ROLES.ADMIN;
}

export function canManageRisks(currentUser) {
  return [ROLES.ADMIN, ROLES.COORDINATOR].includes(currentUser?.role);
}

const SALT = "wkgsf-v1-auth";

export async function hashPassword(pwd) {
  const encoder = new TextEncoder();
  const data = encoder.encode(SALT + pwd);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(pwd, storedHash) {
  if (!storedHash) return false;
  return (await hashPassword(pwd)) === storedHash;
}
