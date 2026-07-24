// Africa's Talking SMS service.
// Credentials are stored in Firestore settings (admin-only) and read at call time.
// Note: AT's API requires credentials in-request headers, same pattern as EmailJS.

const AT_API = "https://api.africastalking.com/version1/messaging";
const AT_SANDBOX = "https://api.sandbox.africastalking.com/version1/messaging";

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 10) return `+255${digits.slice(1)}`;
  if (!digits.startsWith("255") && digits.length === 9) return `+255${digits}`;
  return digits.startsWith("+") ? phone.replace(/\D/g, "+").replace("++", "+") : `+${digits}`;
}

export async function sendSMS(smsSettings, { to, message }) {
  const cfg = smsSettings || {};
  if (!cfg.enabled || !cfg.atApiKey || !cfg.atUsername) return { ok: false, reason: "SMS not configured" };

  const phone = normalizePhone(to);
  if (!phone) return { ok: false, reason: "Invalid phone number" };

  const endpoint = cfg.sandbox ? AT_SANDBOX : AT_API;

  try {
    const body = new URLSearchParams({ username: cfg.atUsername, to: phone, message });
    if (cfg.atSenderId) body.set("from", cfg.atSenderId);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apiKey: cfg.atApiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = await res.json().catch(() => ({}));
    const entry = json?.SMSMessageData?.Recipients?.[0];
    if (!res.ok || entry?.status !== "Success") {
      console.warn("AT SMS failed:", entry?.status || res.status);
      return { ok: false, reason: entry?.status || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    // Likely a CORS error in dev — will work when deployed or via a Cloud Function proxy.
    console.warn("SMS send error:", err.message);
    return { ok: false, reason: err.message };
  }
}

export async function sendSMSBulk(smsSettings, recipients) {
  const results = await Promise.allSettled(
    recipients.map(r => sendSMS(smsSettings, r))
  );
  return results.map(r => r.status === "fulfilled" ? r.value : { ok: false });
}
