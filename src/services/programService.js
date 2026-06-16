import {
  addDocument, updateDocument, deleteDocument,
  listenCollection, getCollection, getDocument, setDocument,
} from "../firebase/firestore";
import { orderBy } from "firebase/firestore";

export async function getPrograms() {
  return getCollection("programs", orderBy("name"));
}

export async function addProgram(data) {
  return addDocument("programs", data);
}

export async function updateProgram(id, data) {
  return updateDocument("programs", id, data);
}

export async function deleteProgram(id) {
  return deleteDocument("programs", id);
}

export function listenPrograms(callback) {
  return listenCollection("programs", callback, orderBy("name"));
}

export async function getProgramById(id) {
  return getDocument("programs", id);
}

export const PROGRAM_CATEGORIES = [
  "Content Creation", "Content Quality", "Gender Equity",
  "Capacity Building", "Health & Outreach", "Education",
  "Community", "Coordination", "Other",
];

export const DEFAULT_PROGRAMS = [
  { name: "Team Meeting",              category: "Coordination",       description: "Monthly internal coordination meeting",                                     plannedSessions: 13, plannedBudget: 0,         color: "#4a9e6b" },
  { name: "Monthly Edit-a-thon",       category: "Content Creation",   description: "Regular editing sessions for existing and new contributors",                plannedSessions: 5,  plannedBudget: 0,         color: "#2563eb" },
  { name: "Error and Fix Campaign",    category: "Content Quality",    description: "Collaborative campaign to identify and correct errors in Wikipedia articles", plannedSessions: 4,  plannedBudget: 0,         color: "#ea580c" },
  { name: "Wikimalkia — WikiQueens",   category: "Gender Equity",      description: "Dedicated program for women contributors",                                   plannedSessions: 5,  plannedBudget: 0,         color: "#9333ea" },
  { name: "Feminism and Folklore TZ",  category: "Gender Equity",      description: "Documents Tanzanian feminism and folklore",                                  plannedSessions: 4,  plannedBudget: 0,         color: "#ec4899" },
  { name: "Let's Connect",             category: "Capacity Building",  description: "Internal capacity building through training",                                plannedSessions: 2,  plannedBudget: 0,         color: "#0891b2" },
  { name: "WikiHealth",                category: "Health & Outreach",  description: "Improves health-related Wikipedia content",                                  plannedSessions: 2,  plannedBudget: 0,         color: "#d97706" },
  { name: "Community Gathering",       category: "Community",          description: "Annual celebration and community bonding",                                   plannedSessions: 1,  plannedBudget: 0,         color: "#16a34a" },
  { name: "Kiwix for Schools",         category: "Education",          description: "Offline Wikipedia access and training for schools",                          plannedSessions: 10, plannedBudget: 0,         color: "#0284c7" },
];
