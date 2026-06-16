import { addDocument, deleteDocument, listenCollection } from "../firebase/firestore";
import { where, orderBy } from "../firebase/firestore";

export function listenActivityFiles(activityId, callback) {
  return listenCollection(
    "activityFiles",
    callback,
    where("activityId", "==", activityId),
    orderBy("createdAt", "asc")
  );
}

export async function addActivityFile(activityId, { fileId, name, url, mimeType, size, uploadedBy }) {
  return addDocument("activityFiles", { activityId, fileId, name, url, mimeType, size, uploadedBy });
}

export async function removeActivityFile(docId) {
  return deleteDocument("activityFiles", docId);
}
