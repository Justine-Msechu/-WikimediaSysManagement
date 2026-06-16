import {
  addDocument, updateDocument, deleteDocument,
  listenCollection, getCollection,
} from "../firebase/firestore";
import { orderBy } from "firebase/firestore";

export const BUDGET_STATUSES = ["draft", "submitted", "approved", "rejected"];

export const BUDGET_STATUS_BADGE = {
  draft:     { label: "Draft",     cls: "badge-gray"  },
  submitted: { label: "Submitted", cls: "badge-blue"  },
  approved:  { label: "Approved",  cls: "badge-green" },
  rejected:  { label: "Rejected",  cls: "badge-red"   },
};

export const BUDGET_GROUPS = {
  "Office":      ["Rent & utilities", "Office expenses", "Internet & computers", "Marketing & communication", "International travel"],
  "Activities":  ["Local transportation", "Venue rentals", "Merchandise & prizes", "Food & refreshments", "Volunteer support"],
  "Personnel":   ["Salaries", "Pension plans", "Insurance"],
  "Financing":   ["Fiscal sponsor", "Bank fees"],
  "Other":       ["Taxes", "Other"],
};

// Flat list for dropdowns (grouped by optgroup in UI)
export const BUDGET_CATS = Object.values(BUDGET_GROUPS).flat();

export const FISCAL_MONTHS = [
  "July", "August", "September", "October", "November", "December",
  "January", "February", "March", "April", "May", "June",
];

export const DEFAULT_PERSONNEL = [
  { id: "1", name: "Executive Director", monthlySalary: 2160000 },
  { id: "2", name: "Program Manager",    monthlySalary: 200000  },
  { id: "3", name: "Lead Designer",      monthlySalary: 0       },
  { id: "4", name: "Admin Associate",    monthlySalary: 0       },
  { id: "5", name: "Office Staff",       monthlySalary: 0       },
];

// Maps a category string to its group (handles legacy categories too)
export function getGroup(category) {
  for (const [group, cats] of Object.entries(BUDGET_GROUPS)) {
    if (cats.includes(category)) return group;
  }
  if (category === "Personnel")   return "Personnel";
  if (category === "Operational") return "Office";
  if (category === "Programmatic") return "Activities";
  return "Other";
}

export async function getBudgetEntries() {
  return getCollection("budgetEntries", orderBy("createdAt", "desc"));
}

export async function addBudgetEntry(data) {
  return addDocument("budgetEntries", data);
}

export async function updateBudgetEntry(id, data) {
  return updateDocument("budgetEntries", id, data);
}

export async function deleteBudgetEntry(id) {
  return deleteDocument("budgetEntries", id);
}

export function listenBudgetEntries(callback) {
  return listenCollection("budgetEntries", callback, orderBy("createdAt", "desc"));
}
