import { getDocument, setDocument, listenDocument } from "../firebase/firestore";

const METRICS_ID = "main";

export const DEFAULT_METRICS = {
  participants:    { target: 200, result: 0 },
  allEditors:      { target: 150, result: 0 },
  newEditors:      { target: 80,  result: 0 },
  retainedEditors: { target: 60,  result: 0 },
  allOrganizers:   { target: 10,  result: 0 },
  newOrganizers:   { target: 4,   result: 0 },
  projects: [
    { name: "Wikipedia (Swahili)", tCreated: 800, tImproved: 400, rCreated: 0, rImproved: 0 },
    { name: "Wikipedia (English)", tCreated: 400, tImproved: 200, rCreated: 0, rImproved: 0 },
    { name: "Wikimedia Commons",   tCreated: 350, tImproved: 0,   rCreated: 0, rImproved: 0 },
    { name: "Wikidata",            tCreated: 250, tImproved: 0,   rCreated: 0, rImproved: 0 },
  ],
  indicators: [],
};

export async function getMetrics() {
  const m = await getDocument("metrics", METRICS_ID);
  return m || DEFAULT_METRICS;
}

export async function updateMetrics(data) {
  return setDocument("metrics", METRICS_ID, data);
}

export function listenMetrics(callback) {
  return listenDocument("metrics", METRICS_ID, doc => callback(doc || DEFAULT_METRICS));
}
