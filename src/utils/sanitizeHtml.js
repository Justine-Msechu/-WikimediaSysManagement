// ── Safe HTML for rich text ───────────────────────────────────────────────────
// Rich text (descriptions, announcements, report answers, public form text) is
// shown as HTML. Keep only simple formatting tags so a saved value can never
// run scripts in someone's browser (stored XSS): no <script>, event handlers
// (onerror=…), styles, iframes, forms or javascript: links.

const ALLOWED = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "p", "br", "div", "span", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre", "a", "hr",
  "table", "thead", "tbody", "tr", "th", "td", "sub", "sup", "small",
]);
// Removed together with everything inside them.
const DROP = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "svg", "math",
  "template", "noscript", "form", "input", "button", "textarea", "select", "option", "link",
  "meta", "base", "title", "head", "audio", "video", "source", "track", "img", "picture", "canvas",
]);
const SAFE_HREF = /^(https?:|mailto:|tel:|#|\/(?!\/))/i;

const escapeText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sanitizeHtml(html) {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return escapeText(html);
  // DOMParser builds an inert document: nothing in it runs or loads.
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  const clean = (node) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) continue;                    // text
      if (ch.nodeType !== 1) { ch.remove(); continue; }   // comments etc.
      const tag = ch.tagName.toLowerCase();
      if (DROP.has(tag)) { ch.remove(); continue; }
      clean(ch);
      if (!ALLOWED.has(tag)) { ch.replaceWith(...ch.childNodes); continue; }
      for (const a of [...ch.attributes]) {
        if (!(tag === "a" && a.name === "href")) ch.removeAttribute(a.name);
      }
      if (tag === "a") {
        const href = (ch.getAttribute("href") || "").replace(/[\u0000- ]/g, "");
        if (href && SAFE_HREF.test(href)) {
          ch.setAttribute("href", href);
          ch.setAttribute("target", "_blank");
          ch.setAttribute("rel", "noopener noreferrer");
        } else {
          ch.removeAttribute("href");
        }
      }
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
}
