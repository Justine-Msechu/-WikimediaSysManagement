import React, { useState } from "react";
import { login, sendReset } from "../firebase/auth";
import { touchLastLogin } from "../services/userService";
import { addAudit, AUDIT_ACTIONS } from "../services/auditService";
import { getDocument, setDocument } from "../firebase/firestore";
import logo from "../assets/logo.png";

export default function Login() {
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error,      setError]      = useState("");
  const [resetSent,  setResetSent]  = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [mode,       setMode]       = useState("login");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setBusy(true);
    try {
      const cred = await login(email.trim().toLowerCase(), password, rememberMe);
      const profile = await getDocument("users", cred.user.uid);
      if (!profile) {
        // Auth account exists but no Firestore profile — register as pending activation
        try {
          await setDocument("pendingActivations", cred.user.uid, {
            uid:         cred.user.uid,
            email:       cred.user.email,
            requestedAt: new Date().toISOString(),
          });
        } catch (_) { /* best-effort */ }
        setError("Your account has not been fully set up yet. Your administrator has been notified and will activate your access shortly.");
        setBusy(false);
        return;
      }
      if (profile.isActive === false) { setError("Your account is deactivated. Contact your administrator."); setBusy(false); return; }
      try { await touchLastLogin(cred.user.uid); } catch (_) { /* non-fatal — non-admin users can't update their own doc */ }
      await addAudit({ ...profile, id: cred.user.uid }, AUDIT_ACTIONS.LOGIN, "auth", { details: "Signed in" });
    } catch (err) {
      const msg = {
        "auth/user-not-found":     "No account found with this email.",
        "auth/wrong-password":     "Incorrect password.",
        "auth/invalid-email":      "Invalid email address.",
        "auth/too-many-requests":  "Too many attempts. Try again later.",
        "auth/invalid-credential": "Incorrect email or password.",
      }[err.code] || "Login failed. Check your credentials.";
      setError(msg);
      setBusy(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setBusy(true);
    try {
      await sendReset(email.trim().toLowerCase());
      setResetSent(true);
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img src={logo} alt="Wikimedia Community Kilimanjaro" className="auth-logo" />
        <div className="auth-title">WikiKilimanjaro GSF</div>
        <div className="auth-sub">
          {mode === "login" ? "Sign in to your account" : "Reset your password"}
        </div>

        {error && <div className="auth-error">{error}</div>}

        {mode === "reset" && resetSent ? (
          <div style={{ background: "#e8f5ec", border: "1px solid #4a9e6b44", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#2d7a4f", marginBottom: 14 }}>
            Password reset email sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={mode === "login" ? handleLogin : handleReset} noValidate>
            <div className="field">
              <label>Email address</label>
              <input type="email" value={email} autoComplete="email"
                onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
            </div>
            {mode === "login" && (
              <div className="field">
                <label>Password</label>
                <input type="password" value={password} autoComplete="current-password"
                  onChange={e => setPassword(e.target.value)} placeholder="Your password" />
              </div>
            )}
            {mode === "login" && (
              <label className="auth-remember">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                Stay signed in for 30 days
              </label>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={busy}>
              {busy ? (mode === "login" ? "Signing in…" : "Sending…") : (mode === "login" ? "Sign in" : "Send reset email")}
            </button>
          </form>
        )}

        <div style={{ marginTop: 14, textAlign: "center" }}>
          {mode === "login" ? (
            <button onClick={() => { setMode("reset"); setError(""); setResetSent(false); }}
              style={{ background: "none", border: "none", color: "#4a9e6b", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
              Forgot password?
            </button>
          ) : (
            <button onClick={() => { setMode("login"); setError(""); }}
              style={{ background: "none", border: "none", color: "#4a9e6b", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#bbb", marginTop: 14, textAlign: "center" }}>
        Wikimedians of Kilimanjaro · Youth Technology
      </div>
    </div>
  );
}
