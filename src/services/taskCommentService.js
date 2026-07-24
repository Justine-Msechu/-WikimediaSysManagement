import { addDocument, listenCollection } from "../firebase/firestore";
import { where } from "../firebase/firestore";

export function listenTaskComments(taskId, callback) {
  // No orderBy to avoid composite index requirement; sort client-side.
  return listenCollection(
    "taskComments",
    (docs) => callback(
      [...docs].sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0))
    ),
    where("taskId", "==", taskId)
  );
}

export async function addTaskComment(taskId, { authorName, authorRole, text }) {
  return addDocument("taskComments", { taskId, authorName, authorRole, text });
}
