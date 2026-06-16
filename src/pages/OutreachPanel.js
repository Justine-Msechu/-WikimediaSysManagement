import React, { useState, useEffect } from "react";
import { fmt } from "../utils/helpers";

export default function OutreachPanel({ campaignUrl, title = "Outreach Dashboard: live editing stats" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  // Accept URLs with or without trailing /programs
  const baseUrl = (campaignUrl || "").replace(/\/programs\/?$/, "").trim();

  useEffect(() => {
    if (!baseUrl) return;
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch(`${baseUrl}.json`, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d.campaign || d); setLoading(false); })
      .catch(e => { if (e.name !== "AbortError") { setError(e.message); setLoading(false); } });
    return () => ctrl.abort();
  }, [baseUrl, tick]);

  if (!baseUrl) {
    return (
      <div className="panel">
        <div className="panel-title">{title}</div>
        <div className="empty">
          No Outreach Dashboard URL set.{" "}
          Go to <strong>Settings → Grant configuration</strong> and paste your campaign URL.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-sm" onClick={() => setTick(t => t + 1)} disabled={loading}>
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
          <a href={`${baseUrl}/programs`} target="_blank" rel="noreferrer" className="btn btn-sm">
            Open ↗
          </a>
        </div>
      </div>

      {loading && !data && <div className="empty">Fetching from Outreach Dashboard…</div>}

      {error && (
        <div className="empty" style={{ color: "#c0392b" }}>
          Could not load ({error}):{" "}
          <a href={`${baseUrl}/programs`} target="_blank" rel="noreferrer" style={{ color: "#4a9e6b" }}>
            View directly on Outreach Dashboard ↗
          </a>
        </div>
      )}

      {data && (
        <>
          <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))" }}>
            {data.user_count !== undefined && (
              <div className="stat-card">
                <div className="stat-label">Editors</div>
                <div className="stat-value">{fmt(data.user_count)}</div>
              </div>
            )}
            {data.article_count !== undefined && (
              <div className="stat-card">
                <div className="stat-label">Articles edited</div>
                <div className="stat-value blue">{fmt(data.article_count)}</div>
              </div>
            )}
            {data.word_count !== undefined && (
              <div className="stat-card">
                <div className="stat-label">Words added</div>
                <div className="stat-value green">{fmt(data.word_count)}</div>
              </div>
            )}
            {data.view_count !== undefined && (
              <div className="stat-card">
                <div className="stat-label">Article views</div>
                <div className="stat-value">{fmt(data.view_count)}</div>
              </div>
            )}
            {data.courses_count !== undefined && (
              <div className="stat-card">
                <div className="stat-label">Programs</div>
                <div className="stat-value">{fmt(data.courses_count)}</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#aaa" }}>
            <a href={`${baseUrl}/programs`} target="_blank" rel="noreferrer" style={{ color: "#999", fontSize: 11 }}>
              {baseUrl}/programs
            </a>
          </div>
        </>
      )}
    </div>
  );
}
