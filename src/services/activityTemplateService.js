import { listenCollection, addDocument, deleteDocument, orderBy } from "../firebase/firestore";

export function listenTemplates(callback) {
  return listenCollection("activityTemplates", callback, orderBy("name", "asc"));
}

export async function addTemplate(data) {
  return addDocument("activityTemplates", data);
}

export async function deleteTemplate(id) {
  return deleteDocument("activityTemplates", id);
}
