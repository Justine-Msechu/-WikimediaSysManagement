import { addDocument, listenCollection, deleteDocument, updateDocument } from "../firebase/firestore";
import { orderBy } from "../firebase/firestore";

export function listenAnnouncements(callback) {
  return listenCollection("announcements", callback, orderBy("createdAt", "desc"));
}
export async function addAnnouncement(data)      { return addDocument("announcements", data); }
export async function deleteAnnouncement(id)     { return deleteDocument("announcements", id); }
export async function updateAnnouncement(id, d)  { return updateDocument("announcements", id, d); }
