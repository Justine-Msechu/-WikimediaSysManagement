import { addDocument, updateDocument, deleteDocument, listenCollection } from "../firebase/firestore";
import { where, orderBy } from "../firebase/firestore";

export const SKILL_OPTIONS = [
  "Wikipedia editing", "Wikidata", "Commons uploads", "Training & facilitation",
  "Photography", "Translation", "Graphic design", "IT & technology",
  "Community outreach", "Research & writing", "Event organisation", "Other",
];

export const AVAILABILITY_OPTIONS = ["Weekdays", "Weekends", "Both", "Flexible"];

export function listenVolunteers(callback) {
  return listenCollection("volunteers", callback, orderBy("name", "asc"));
}

export async function addVolunteer(data) {
  return addDocument("volunteers", data);
}

export async function updateVolunteer(id, data) {
  return updateDocument("volunteers", id, data);
}

export async function deleteVolunteer(id) {
  return deleteDocument("volunteers", id);
}

// ── Volunteer Tasks ────────────────────────────────────────────────────────────

export const TASK_STATUS = ["pending", "in_progress", "completed", "cancelled"];
export const TASK_STATUS_LABELS = {
  pending:     "Pending",
  in_progress: "In progress",
  completed:   "Completed",
  cancelled:   "Cancelled",
};
export const TASK_STATUS_COLORS = {
  pending:     "#d97706",
  in_progress: "#2563eb",
  completed:   "#2d7a4f",
  cancelled:   "#888",
};

export function listenTasks(callback) {
  return listenCollection("volunteerTasks", callback, orderBy("createdAt", "desc"));
}

export function listenTasksForVolunteer(volunteerId, callback) {
  // Tasks assign volunteers via the `volunteerIds` array (current format), but
  // some older tasks still only have the legacy singular `volunteerId` field.
  // Run both queries and merge so neither format is missed. No orderBy — combining
  // where() + orderBy() on different fields requires a composite Firestore index;
  // sort client-side instead.
  let current = [];
  let legacy = [];
  const emit = () => {
    const byId = new Map();
    for (const t of [...current, ...legacy]) byId.set(t.id, t);
    callback([...byId.values()]);
  };
  const u1 = listenCollection(
    "volunteerTasks", (rows) => { current = rows; emit(); },
    where("volunteerIds", "array-contains", volunteerId)
  );
  const u2 = listenCollection(
    "volunteerTasks", (rows) => { legacy = rows; emit(); },
    where("volunteerId", "==", volunteerId)
  );
  return () => { u1(); u2(); };
}

export async function addTask(data) {
  return addDocument("volunteerTasks", { ...data, status: "pending" });
}

export async function updateTask(id, data) {
  return updateDocument("volunteerTasks", id, data);
}

export async function deleteTask(id) {
  return deleteDocument("volunteerTasks", id);
}
