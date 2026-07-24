import React, { useRef, useState } from "react";

// Convert \n to <br> in text segments only (not inside HTML tags)
export function renderHtml(html) {
  if (!html) return "";
  return html.split(/(<[^>]+>)/).map((part, i) =>
    i % 2 === 0 ? part.replace(/\n/g, "<br>") : part
  ).join("");
}

function makeList(tag, selected) {
  const lines = selected.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) lines.push("item");
  return `<${tag}>\n${lines.map(l => `  <li>${l}</li>`).join("\n")}\n</${tag}>`;
}

const TOOLS = [
  { label: "B",       title: "Bold",          wrap: ["<strong>", "</strong>"],  style: { fontWeight: "bold" } },
  { label: "I",       title: "Italic",        wrap: ["<em>",     "</em>"],      style: { fontStyle: "italic" } },
  { label: "U",       title: "Underline",     wrap: ["<u>",      "</u>"],       style: { textDecoration: "underline" } },
  { label: "• List",  title: "Bullet list",   list: "ul",                       style: {} },
  { label: "1. List", title: "Numbered list", list: "ol",                       style: {} },
];

function applyTool(ta, tool, onChange) {
  const s    = ta.selectionStart;
  const e    = ta.selectionEnd;
  const v    = ta.value;
  const sel  = v.slice(s, e) || "text";

  let replacement;
  if (tool.list) {
    replacement = makeList(tool.list, sel || "item");
  } else {
    replacement = tool.wrap[0] + sel + tool.wrap[1];
  }

  const newVal = v.slice(0, s) + replacement + v.slice(e);
  onChange(newVal);
  setTimeout(() => {
    ta.focus();
    ta.setSelectionRange(s, s + replacement.length);
  }, 0);
}

export default function RichTextEditor({ value, onChange, placeholder, rows = 4 }) {
  const taRef   = useRef(null);
  const [preview, setPreview] = useState(false);

  return (
    <div style={{ border: "2px solid #d8d8d4", borderRadius: 7, overflow: "hidden", background: "#fff" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", gap: 4, padding: "6px 10px",
        background: "#1c2b1e", borderBottom: "1px solid #2d7a4f",
        flexWrap: "wrap", alignItems: "center",
      }}>
        {TOOLS.map(t => (
          <button
            key={t.label}
            type="button"
            title={t.title}
            onClick={() => applyTool(taRef.current, t, onChange)}
            style={{
              padding: "3px 10px", fontSize: 12,
              background: "#2d7a4f", border: "1px solid #4a9e6b",
              borderRadius: 4, cursor: "pointer", color: "#fff",
              lineHeight: 1.6, ...t.style,
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview(p => !p)}
          style={{
            marginLeft: "auto", padding: "3px 10px", fontSize: 11,
            background: preview ? "#4a9e6b" : "transparent",
            border: "1px solid #4a9e6b", borderRadius: 4,
            cursor: "pointer", color: "#fff", lineHeight: 1.6,
          }}
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Edit or Preview */}
      {preview ? (
        <div
          style={{ minHeight: `${rows * 1.6}em`, padding: "8px 10px", fontSize: 13, lineHeight: 1.7, color: "#1c2b1e" }}
          dangerouslySetInnerHTML={{ __html: renderHtml(value) || `<span style="color:#aaa">${placeholder || ""}</span>` }}
        />
      ) : (
        <textarea
          ref={taRef}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{
            width: "100%", boxSizing: "border-box",
            border: "none", borderRadius: 0, resize: "vertical",
            padding: "8px 10px", fontSize: 13, lineHeight: 1.7,
            outline: "none", fontFamily: "inherit",
          }}
        />
      )}
    </div>
  );
}
