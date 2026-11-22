import { getDocument, setDocument, listenDocument } from "../firebase/firestore";

const METRICS_ID = "main";

// A grant with no saved metrics starts empty — targets are set per grant on
// the Metrics page (they used to be pre-filled from an old grant's plan).
export const DEFAULT_METRICS = {
  participants:    { target: 0, result: 0 },
  allEditors:      { target: 0, result: 0 },
  newEditors:      { target: 0, result: 0 },
  retainedEditors: { target: 0, result: 0 },
  allOrganizers:   { target: 0, result: 0 },
  newOrganizers:   { target: 0, result: 0 },
  activeContributors: { target: 0, result: 0 },
  projects: [
    { name: "Wikipedia (Swahili)", tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 },
    { name: "Wikipedia (English)", tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 },
    { name: "Wikimedia Commons",   tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 },
    { name: "Wikidata",            tCreated: 0, tImproved: 0, rCreated: 0, rImproved: 0 },
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

// Per-grant metrics — document ID = grantId
export async function getMetricsByGrant(grantId) {
  const m = await getDocument("metrics", grantId);
  return m || DEFAULT_METRICS;
}

export async function updateMetricsByGrant(grantId, data) {
  return setDocument("metrics", grantId, data);
}

export function listenMetricsByGrant(grantId, callback) {
  return listenDocument("metrics", grantId, doc => callback(doc || DEFAULT_METRICS));
}
