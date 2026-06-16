import { getDocument, setDocument, listenDocument } from "../firebase/firestore";

const SETTINGS_ID = "main";

export async function getSettings() {
  return getDocument("settings", SETTINGS_ID);
}

export async function updateSettings(data) {
  return setDocument("settings", SETTINGS_ID, data);
}

export function listenSettings(callback) {
  return listenDocument("settings", SETTINGS_ID, callback);
}

export const DEFAULT_SETTINGS = {
  org: {
    name: "Wikimedia Community Kilimanjaro",
    country: "Tanzania",
    type: "Wikimedia User Group",
    metaPage: "",
    website: "",
    contactEmail: "",
  },
  grant: {
    title: "",
    id: "",
    cycle: "2026–2027",
    startDate: "",
    endDate: "",
    totalUSD: 0,
    conversionRate: 0.000413,
    odCampaignUrl: "",
    status: "active",
  },
  team: [],
  reportAnswers: {
    q1: "", q2: "", q3: "", q4: "", q5: "",
    q6_1: "", q6_2: "", q6_3: "",
    q12: "", q13: "",
    q17: "", q18: "", q19: "",
  },
};
