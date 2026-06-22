import { addDocument, deleteDocument, listenCollection } from "../firebase/firestore";
import { where, orderBy } from "../firebase/firestore";

export function listenActivityFiles(activityId, callback) {
  // No orderBy — where(activityId) + orderBy(createdAt) requires a composite index. Sort client-side.
  return listenCollection("activityFiles", callback, where("activityId", "==", activityId));
}

export async function addActivityFile(activityId, { fileId, name, url, mimeType, size, uploadedBy }) {
  return addDocument("activityFiles", { activityId, fileId, name, url, mimeType, size, uploadedBy });
}

export async function removeActivityFile(docId) {
  return deleteDocument("activityFiles", docId);
}
