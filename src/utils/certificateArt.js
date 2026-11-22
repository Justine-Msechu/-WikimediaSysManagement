// Wikimedia project logos used as certificate watermarks.
// Official SVGs from Wikimedia Commons (Wikimedia Foundation trademarks — used
// by the affiliate for its own community certificates). They live in
// public/certificate/ (served as-is) because some contain editor markup that
// the bundler's SVG-to-React loader can't compile.
const FILES = ["wikipedia", "commons", "wikidata", "wiktionary", "wikisource", "wikiquote"];

// The print window is a separate document, so image URLs must be absolute.
export function certificateArt(origin = window.location.origin, base = process.env.PUBLIC_URL || "") {
  const url = (name) => `${origin}${base}/certificate/${name}.svg`;
  return { center: url("wikimedia"), icons: FILES.map(url) };
}
