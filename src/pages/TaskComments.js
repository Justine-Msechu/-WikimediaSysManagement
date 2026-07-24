import React, { useState, useEffect, useRef } from "react";
import { listenTaskComments, addTaskComment } from "../services/taskCommentService";
import { ROLE_COLORS } from "../services/userService";

function timeAgo(ts) {
  if (!ts?.toDate) return "";
  const diff = Date.now() - ts.toDate().getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return ts.toDate().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function TaskComments({ taskId, profile }) {
  const [comments, setComments] = useState([]);
  const [open,     setOpen]     = useState(false);
  const [text,     setText]     = useState("");
  const [sending,  setSending]  = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    return listenTaskComments(taskId, setComments);
  }, [taskId, open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments, open]);

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    await addTaskComment(taskId, {
      authorName: profile.name,
      authorRole: profile.role,
      text: msg,
    });
    setText("");
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#4a9e6b", fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
      >
        <span>{open ? "▲" : "▼"}</span>
        <span>Discussion{comments.length > 0 && !open ? ` (${comments.length})` : ""}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {comments.length === 0 ? (
            <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>No messages yet. Start the conversation below.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10, maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
              {comments.map(c => {
                const isMine = c.authorName === profile.name;
                const color  = ROLE_COLORS[c.authorRole] || "#888";
                return (
                  <div key={c.id} style={{ display: "flex", flexDirection: isMine ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {c.authorName?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ maxWidth: "75%" }}>
                      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2, textAlign: isMine ? "right" : "left" }}>
                        <strong style={{ color }}>{c.authorName}</strong> · {timeAgo(c.createdAt)}
                      </div>
                      <div style={{
                        background: isMine ? "#e6f4ec" : "#f5f4f0",
                        border: `1px solid ${isMine ? "#b7e0c8" : "#e0e0d8"}`,
                        borderRadius: isMine ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                        padding: "7px 12px", fontSize: 13, color: "#333", lineHeight: 1.5,
                        wordBreak: "break-word",
                      }}>
                        {c.text}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Write a message… (Enter to send)"
              style={{ flex: 1, fontSize: 13, resize: "none" }}
            />
            <button
              className="btn btn-sm btn-primary"
              disabled={sending || !text.trim()}
              onClick={send}
              style={{ alignSelf: "flex-end" }}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
