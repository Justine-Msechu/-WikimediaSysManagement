import { addDocument, listenCollection, updateDocument, getCollection } from "../firebase/firestore";
import { where, orderBy } from "../firebase/firestore";

export async function createNotification({ type, title, body, forRoles, link = "" }) {
  return addDocument("notifications", {
    type,
    title,
    body,
    forRoles: forRoles || ["admin", "finance_officer"],
    link,
    read: false,
  });
}

export function listenNotifications(role, callback) {
  return listenCollection(
    "notifications",
    callback,
    where("forRoles", "array-contains", role),
    orderBy("createdAt", "desc")
  );
}

export async function markRead(id) {
  return updateDocument("notifications", id, { read: true });
}

export async function markAllRead(ids) {
  return Promise.all(ids.map(id => markRead(id)));
}

export async function getAdminEmails() {
  const users = await getCollection("users");
  return users
    .filter(u => ["admin", "finance_officer"].includes(u.role) && u.isActive !== false && u.email)
    .map(u => u.email);
}

// Sends email via EmailJS if configured in env vars. Silently skips if not.
export async function sendEmailNotification({ toEmails, subject, body }) {
  const serviceId  = process.env.REACT_APP_EMAILJS_SERVICE_ID;
  const templateId = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;
  if (!serviceId || !templateId || !publicKey) return;

  const recipients = Array.isArray(toEmails) ? toEmails : [toEmails];
  await Promise.allSettled(
    recipients.map(email =>
      fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id:      serviceId,
          template_id:     templateId,
          user_id:         publicKey,
          template_params: { to_email: email, subject, message: body },
        }),
      })
    )
  );
}

// Helper: notify admins + send email when something is submitted for review
export async function notifySubmission({ submitterName, itemType, itemTitle, itemId }) {
  const title = `${itemType} submitted for review`;
  const body  = `${submitterName} submitted "${itemTitle}" for review.`;

  await createNotification({ type: "submission", title, body, link: "review" });

  try {
    const emails = await getAdminEmails();
    await sendEmailNotification({ toEmails: emails, subject: title, body });
  } catch (_) { /* email is best-effort */ }
}

// Helper: notify submitter when their item is approved or rejected
export async function notifyDecision({ recipientRole, itemType, itemTitle, decision, comment = "" }) {
  const title = `${itemType} ${decision}`;
  const body  = comment
    ? `"${itemTitle}" was ${decision}. Note: ${comment}`
    : `"${itemTitle}" was ${decision}.`;

  await createNotification({ type: "decision", title, body, forRoles: [recipientRole, "admin"], link: "review" });
}
