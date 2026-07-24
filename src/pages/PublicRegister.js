import React, { useState, useEffect } from "react";
import { getForm, submitRegistration } from "../services/registrationService";
import { renderHtml } from "../components/RichTextEditor";
import logo from "../assets/logo.png";

// ─── Sanitizers ────────────────────────────────────────────────────────────────

function sanitizeName(v) {
  return v.replace(/[^\p{L}\p{M}\s'\-\.]/gu, "").replace(/\s+/g, " ");
}

function sanitizeWikiUsername(v) {
  // Only strip leading whitespace — NOT trailing. If we also trim the end,
  // the onChange handler kills the space mid-typing (e.g. "Justine " → "Justine")
  // so the user can never type a two-word username like "Justine Msechu".
  // The submit handler does a final .trim() after the value is complete.
  let s = v.replace(/^\s+/, "");
  // Strip full Wikipedia URLs (any language: en, sw, fr, de, …)
  const urlMatch = s.match(/^https?:\/\/[a-z\-]+\.wikipedia\.org\/wiki\//i);
  if (urlMatch) {
    s = s.slice(urlMatch[0].length); // leaves e.g. "Mtumiaji:JustineMsechu"
  } else {
    s = s.replace(/^https?:\/\/\S+/i, "");
  }
  // Strip any namespace prefix (User:, Mtumiaji:, Utilisateur:, Benutzer:, …)
  // A namespace is a single word (no spaces) followed by a colon.
  s = s.replace(/^\w+:/, "");
  // Decode URI encoding (e.g. %20 → space, underscores stay as underscores)
  try { s = decodeURIComponent(s); } catch (_) {}
  // Do NOT replace underscores with spaces; Wikipedia treats them as equivalent
  // but we preserve what the user typed.
  return s.replace(/^\s+/, ""); // strip any leading space left after namespace strip
}

function sanitizeEmail(v) {
  return v.trim().toLowerCase().replace(/\s/g, "");
}

function sanitizePhone(v) {
  return v.replace(/[^\d\s\+\-\(\)]/g, "").replace(/\s+/g, " ").trim();
}

function sanitizeText(v) {
  return v.replace(/[<>]/g, "").trimStart();
}

// ─── Validators ────────────────────────────────────────────────────────────────

function validateName(v) {
  if (!v.trim()) return "Full name is required.";
  if (v.trim().length < 2) return "Name must be at least 2 characters.";
  return null;
}

function validateWikiUsername(v) {
  if (!v) return null; // optional
  if (v.length > 255) return "Username is too long.";
  return null;
}

function validateEmail(v) {
  if (!v) return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
  return null;
}

function validatePhone(v) {
  if (!v) return "Phone number is required.";
  const digits = v.replace(/\D/g, "");
  if (digits.length < 6) return "Phone number looks too short.";
  return null;
}

function validateAge(v) {
  if (!v) return null;
  const n = Number(v);
  if (isNaN(n) || n < 10 || n > 120) return "Enter a realistic age (10–120).";
  return null;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="field-err-msg" style={{ color: "#c0392b", fontSize: 12, marginTop: 3 }}>{msg}</div>;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PublicRegister({ formId }) {
  const [form,      setForm]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [closed,    setClosed]    = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [errors,    setErrors]    = useState({});

  const [vals, setVals] = useState({
    name: "", wikimediaUsername: "", email: "", phone: "", age: "", skills: "", wikistatus: "",
  });

  useEffect(() => {
    if (!formId) { setNotFound(true); setLoading(false); return; }
    getForm(formId).then(f => {
      if (!f) { setNotFound(true); }
      else if (f.status === "closed") { setForm(f); setClosed(true); }
      else {
        setForm(f);
        // Check registration limit using counter stored on the form document (no auth needed)
        if (f.maxRegistrations && (f.registrationCount || 0) >= Number(f.maxRegistrations)) {
          setClosed(true);
        }
      }
      setLoading(false);
      if (f?.title) document.title = `${f.title} — Wikimedians of Kilimanjaro`;
    });
    return () => { document.title = "Wiki Kilimanjaro — GSF Manager"; };
  }, [formId]);

  // setV: apply sanitizer. For wikimediaUsername we skip sanitization on onChange
  // (so typing "Justine Msechu" keeps the space); sanitization happens only on blur/submit.
  const setV = (key, raw, { sanitize = true } = {}) => {
    const sanitizers = { name: sanitizeName, wikimediaUsername: sanitizeWikiUsername, email: sanitizeEmail, phone: sanitizePhone, age: v => v.replace(/\D/g, ""), skills: sanitizeText, wikistatus: v => v };
    const val = sanitize ? (sanitizers[key] || (v => v))(raw) : raw;
    setVals(v => ({ ...v, [key]: val }));
    setErrors(e => ({ ...e, [key]: null }));
  };

  const submit = async (e) => {
    e.preventDefault();
    // Re-sanitize at submit time (catches autofill) and fully trim
    const cleanUsername = sanitizeWikiUsername(vals.wikimediaUsername).trim();
    setVals(v => ({ ...v, wikimediaUsername: cleanUsername }));

    const newErrors = {
      name:              validateName(vals.name),
      wikimediaUsername: validateWikiUsername(cleanUsername),
      wikistatus:        vals.wikistatus ? null : "Please select one.",
      email:             validateEmail(vals.email),
      phone:             validatePhone(vals.phone),
      age:               validateAge(vals.age),
    };
    setErrors(newErrors);
    const firstError = Object.values(newErrors).find(Boolean);
    if (firstError) {
      const el = document.querySelector(".field-err-msg");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try {
      await submitRegistration(formId, {
        name:              vals.name.trim(),
        wikimediaUsername: cleanUsername,
        email:             vals.email.trim().toLowerCase(),
        phone:             vals.phone.trim(),
        age:               vals.age ? Number(vals.age) : null,
        skills:            vals.skills.trim(),
        isNew:             vals.wikistatus === "no",
        programId:         form?.programId || "",
      });
      setSubmitted(true);
    } catch (err) {
      alert("Registration failed: " + (err.message || "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (loading)  return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: "#555" }}>Loading…</div>;

  const containerStyle = { maxWidth: 520, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1c2b1e" };
  const panelStyle = { background: "#fff", borderRadius: 14, boxShadow: "0 2px 20px rgba(0,0,0,0.08)", padding: "32px 28px" };
  const fieldStyle = { marginBottom: 18 };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 6 };
  const inputStyle = { width: "100%", padding: "10px 12px", fontSize: 14, border: "1.5px solid #d0d0c8", borderRadius: 7, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" };
  const reqStyle  = { color: "#c0392b", marginLeft: 2 };

  if (notFound) return (
    <div style={containerStyle}><div style={panelStyle}>
      <img src={logo} alt="logo" style={{ width: 48, marginBottom: 16 }} />
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Form not found</div>
      <div style={{ fontSize: 14, color: "#888" }}>This registration link is invalid or has been removed.</div>
    </div></div>
  );

  if (closed) return (
    <div style={containerStyle}><div style={panelStyle}>
      <img src={logo} alt="logo" style={{ width: 48, marginBottom: 16 }} />
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{form?.title}</div>
      {form?.maxRegistrations
        ? <div style={{ fontSize: 14, color: "#c0392b", fontWeight: 600 }}>This event has reached its maximum number of registrations ({form.maxRegistrations} spots). Registration is now closed.</div>
        : <div style={{ fontSize: 14, color: "#888" }}>Registration for this event is now closed.</div>
      }
    </div></div>
  );

  if (submitted) return (
    <div style={containerStyle}><div style={{ ...panelStyle, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#2d7a4f" }}>You're registered!</div>
      <div style={{ fontSize: 15, color: "#555", marginBottom: 20 }}>
        Thank you for registering for <strong>{form?.title}</strong>.
        {form?.date && <span> We look forward to seeing you on {form.date}.</span>}
      </div>
      {form?.wikiEventUrl && (
        vals.wikimediaUsername ? (
          <div style={{ background: "#f0f8f3", border: "2px solid #4a9e6b", borderRadius: 10, padding: "16px 20px", textAlign: "left", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "#2d7a4f" }}>Join the event on Wikipedia — required</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>
              You provided your Wikipedia username (<strong>{vals.wikimediaUsername}</strong>). Please sign up on the Wikipedia Event Platform so your contributions during this event are tracked and counted.
            </div>
            <a href={form.wikiEventUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#2d7a4f", color: "#fff", borderRadius: 7, padding: "9px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Join on Wikipedia Event Platform
            </a>
          </div>
        ) : (
          <div style={{ background: "#f0f8f3", border: "1px solid #b7e0c8", borderRadius: 10, padding: "16px 20px", textAlign: "left", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>New to Wikipedia? Create an account</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>
              You can create a free Wikipedia account and join this event so your contributions are tracked. This step is optional but encouraged.
            </div>
            <a href={form.wikiEventUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#2d7a4f", color: "#fff", borderRadius: 7, padding: "9px 18px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Join on Wikipedia Event Platform 
            </a>
          </div>
        )
      )}
      <button
        onClick={() => {
          window.close();
          // window.close() is blocked by most browsers when the page was opened via a link.
          // Navigate to a blank thank-you state so the user isn't left on a broken button.
          setTimeout(() => {
            if (!window.closed) {
              document.body.innerHTML = '<div style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;color:#555;font-size:15px;">You are registered! You may now close this tab.</div>';
            }
          }, 400);
        }}
        style={{ marginTop: 8, padding: "10px 28px", background: "#f5f4f0", color: "#333", fontSize: 14, fontWeight: 600, border: "1.5px solid #d0d0c8", borderRadius: 8, cursor: "pointer" }}
      >
        Close this page
      </button>
    </div></div>
  );

  return (
    <div style={containerStyle}>
      <div style={panelStyle}>
        <img src={logo} alt="Wikimedians of Kilimanjaro" style={{ width: 48, marginBottom: 16 }} />
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{form?.title || "Event registration"}</div>
        {form?.date     && <div style={{ fontSize: 13, color: "#888", marginBottom: 2 }}>📅 {form.date}</div>}
        {form?.location && <div style={{ fontSize: 13, color: "#888", marginBottom: 2 }}>📍 {form.location}</div>}
        {form?.description && <div style={{ fontSize: 14, color: "#555", margin: "12px 0" }} dangerouslySetInnerHTML={{ __html: renderHtml(form.description) }} />}
        <div style={{ borderTop: "1px solid #eee", margin: "16px 0" }} />

        <form onSubmit={submit} noValidate>
          <div style={fieldStyle}>
            <label style={labelStyle}>Full name <span style={reqStyle}>*</span></label>
            <input style={{ ...inputStyle, borderColor: errors.name ? "#c0392b" : undefined }} value={vals.name} onChange={e => setV("name", e.target.value)} placeholder="Your full name" autoComplete="name" />
            <FieldError msg={errors.name} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Wikipedia username</label>
            <input
              style={{ ...inputStyle, borderColor: errors.wikimediaUsername ? "#c0392b" : undefined }}
              value={vals.wikimediaUsername}
              onChange={e => { const val = e.target.value; setVals(v => ({ ...v, wikimediaUsername: val })); }}
              placeholder="e.g. Justine Msechu"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <FieldError msg={errors.wikimediaUsername} />
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
              Enter your Wikipedia username only, without "User:" prefix. You can paste your full Wikipedia profile URL and it will be cleaned automatically. Leave blank if you don't have an account yet.
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Have you edited Wikipedia before? <span style={reqStyle}>*</span></label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
              {[
                { value: "no",  label: "No this will be my first time editing Wikipedia" },
                { value: "yes", label: "Yes I have edited Wikipedia before" },
              ].map(opt => (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, padding: "10px 14px", border: `1.5px solid ${vals.wikistatus === opt.value ? "#2d7a4f" : "#d0d0c8"}`, borderRadius: 8, background: vals.wikistatus === opt.value ? "#f0f8f3" : "#fff" }}>
                  <input type="radio" name="wikistatus" value={opt.value} checked={vals.wikistatus === opt.value} onChange={e => setV("wikistatus", e.target.value)} style={{ accentColor: "#2d7a4f" }} />
                  {opt.label}
                </label>
              ))}
            </div>
            {errors.wikistatus && <FieldError msg={errors.wikistatus} />}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Email address <span style={reqStyle}>*</span></label>
            <input type="email" style={{ ...inputStyle, borderColor: errors.email ? "#c0392b" : undefined }} value={vals.email} onChange={e => setV("email", e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <FieldError msg={errors.email} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Phone number <span style={reqStyle}>*</span></label>
            <input type="tel" style={{ ...inputStyle, borderColor: errors.phone ? "#c0392b" : undefined }} value={vals.phone} onChange={e => setV("phone", e.target.value)} placeholder="+255 …" autoComplete="tel" />
            <FieldError msg={errors.phone} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Age</label>
            <input type="number" min="10" max="120" style={{ ...inputStyle, borderColor: errors.age ? "#c0392b" : undefined }} value={vals.age} onChange={e => setV("age", e.target.value)} placeholder="e.g. 24" />
            <FieldError msg={errors.age} />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Skills or areas of interest</label>
            <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} value={vals.skills} onChange={e => setV("skills", e.target.value)} placeholder="e.g. Writing, Photography, Local history, Biology…" />
          </div>

          <button type="submit" disabled={busy} style={{ width: "100%", padding: "13px", background: "#2d7a4f", color: "#fff", fontSize: 16, fontWeight: 700, border: "none", borderRadius: 9, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, marginTop: 8 }}>
            {busy ? "Submitting…" : "Register for this event"}
          </button>
        </form>
      </div>
    </div>
  );
}
