import React, { useState } from "react";
import { fmt, today, ACTIVITY_TYPES, BUDGET_CATS } from "../utils/helpers";

const empty = () => ({
  name: "", type: "Edit-a-thon", date: today(), location: "", reportedBy: "",
  participants: "", women: "", newEditors: "", youth: "", pwd: "",
  created: "", improved: "", commons: "", wikidata: "",
  cost: "", budgetCat: "Programmatic costs", link: "",
  summary: "", challenges: "", lessons: "", stories: "", nextSteps: "",
});

export default function Activities({ state, update, onViewActivity }) {
  const [form, setForm] = useState(empty());
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleAdd = () => {
    if (!form.name.trim()) { alert("Please enter an activity name."); return; }
    const acts = [...(state.activities || []), { ...form, id: Date.now() }];
    update({ activities: acts });
    setForm(empty());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDelete = (i) => {
    if (!window.confirm("Delete this activity?")) return;
    const acts = state.activities.filter((_, idx) => idx !== i);
    update({ activities: acts });
  };

  const acts = state.activities || [];

  return (
    <div>
      <div className="page-title">Activities</div>
      <div className="page-sub">Log each event. Every activity gets its own downloadable report.</div>

      {/* ── Log form ── */}
      <div className="panel">
        <div className="panel-title">Log new activity</div>

        <div className="form-grid">
          <div className="field">
            <label>Activity name <span className="req">★</span></label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Monthly Edit-a-thon #8" />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => set("type", e.target.value)}>
              {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-grid three">
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="field">
            <label>Location</label>
            <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Moshi, Kilimanjaro" />
          </div>
          <div className="field">
            <label>Reported by</label>
            <input value={form.reportedBy} onChange={(e) => set("reportedBy", e.target.value)} placeholder="Your name / username" />
          </div>
        </div>

        <hr className="sep" />
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "10px" }}>Participation</div>

        <div className="form-grid three">
          <div className="field">
            <label>Total participants <span className="req">★</span></label>
            <input type="number" value={form.participants} onChange={(e) => set("participants", e.target.value)} placeholder="0" min="0" />
          </div>
          <div className="field">
            <label>Women</label>
            <input type="number" value={form.women} onChange={(e) => set("women", e.target.value)} placeholder="0" min="0" />
          </div>
          <div className="field">
            <label>New editors</label>
            <input type="number" value={form.newEditors} onChange={(e) => set("newEditors", e.target.value)} placeholder="0" min="0" />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Youth (under 30)</label>
            <input type="number" value={form.youth} onChange={(e) => set("youth", e.target.value)} placeholder="0" min="0" />
          </div>
          <div className="field">
            <label>Persons with disability</label>
            <input type="number" value={form.pwd} onChange={(e) => set("pwd", e.target.value)} placeholder="0" min="0" />
          </div>
        </div>

        <hr className="sep" />
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "10px" }}>Content contributions</div>

        <div className="form-grid">
          <div className="field">
            <label>Wikipedia articles created</label>
            <input type="number" value={form.created} onChange={(e) => set("created", e.target.value)} placeholder="0" min="0" />
          </div>
          <div className="field">
            <label>Wikipedia articles improved</label>
            <input type="number" value={form.improved} onChange={(e) => set("improved", e.target.value)} placeholder="0" min="0" />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Wikimedia Commons uploads</label>
            <input type="number" value={form.commons} onChange={(e) => set("commons", e.target.value)} placeholder="0" min="0" />
          </div>
          <div className="field">
            <label>Wikidata items</label>
            <input type="number" value={form.wikidata} onChange={(e) => set("wikidata", e.target.value)} placeholder="0" min="0" />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Outreach Dashboard link</label>
            <input value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://outreachdashboard.wmflabs.org/..." />
          </div>
          <div className="field">
            <label>Cost (TZS)</label>
            <input type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} placeholder="0" min="0" />
          </div>
        </div>

        <hr className="sep" />
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "10px" }}>Narrative (for report)</div>

        <div className="form-grid one">
          <div className="field">
            <label>Activity summary <span className="req">★</span></label>
            <textarea rows={4} value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="What happened? What did participants do and learn? Describe the key moments." />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Challenges faced</label>
            <textarea rows={3} value={form.challenges} onChange={(e) => set("challenges", e.target.value)} placeholder="What obstacles did you encounter? How did you handle them?" />
          </div>
          <div className="field">
            <label>Lessons learned</label>
            <textarea rows={3} value={form.lessons} onChange={(e) => set("lessons", e.target.value)} placeholder="What would you do differently? What worked well?" />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Impact stories</label>
            <textarea rows={3} value={form.stories} onChange={(e) => set("stories", e.target.value)} placeholder="Quote a participant. Share a standout story or transformation." />
          </div>
          <div className="field">
            <label>Next steps</label>
            <textarea rows={3} value={form.nextSteps} onChange={(e) => set("nextSteps", e.target.value)} placeholder="What follow-up actions are planned from this activity?" />
          </div>
        </div>

        {saved && <div className="alert alert-success">Activity saved successfully!</div>}

        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleAdd}>+ Save activity</button>
          <button className="btn" onClick={() => setForm(empty())}>Clear form</button>
        </div>
      </div>

      {/* ── Activity list ── */}
      <div className="panel">
        <div className="panel-title">All activities ({acts.length})</div>
        {acts.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">◈</div>
            No activities yet. Log your first one above.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Date</th>
                <th>Participants</th>
                <th>Articles</th>
                <th>Cost TZS</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {acts.map((a, i) => (
                <tr key={a.id || i}>
                  <td>
                    <strong>{a.name}</strong>
                    <br />
                    <span className="badge badge-purple" style={{ marginTop: 3 }}>{a.type}</span>
                  </td>
                  <td>{a.date}<br /><span style={{ fontSize: "11px", color: "#888" }}>{a.location}</span></td>
                  <td>
                    {a.participants || 0}
                    <span style={{ color: "#888", fontSize: "11px" }}> total</span>
                    <br />
                    <span style={{ color: "#2d7a4f", fontSize: "11px" }}>{a.women || 0} women</span>
                  </td>
                  <td>
                    <span style={{ color: "#2d7a4f" }}>+{fmt(a.created || 0)}</span>{" "}
                    created
                    <br />
                    <span style={{ color: "#1a5fa8" }}>~{fmt(a.improved || 0)}</span>{" "}
                    improved
                  </td>
                  <td>{fmt(a.cost || 0)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-sm" onClick={() => onViewActivity(i)}>
                        Report
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(i)}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
