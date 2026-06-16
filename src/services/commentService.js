import { addDocument, listenCollection } from "../firebase/firestore";
import { where, orderBy } from "../firebase/firestore";

export async function addComment(docType, docId, { text, author, authorRole }) {
  if (!text?.trim()) throw new Error("Comment cannot be empty.");
  return addDocument("comments", {
    docType,
    docId,
    text: text.trim(),
    author,
    authorRole,
  });
}

export function listenComments(docType, docId, callback) {
  return listenCollection(
    "comments",
    callback,
    where("docType", "==", docType),
    where("docId",   "==", docId),
    orderBy("createdAt", "asc")
  );
}

export const ROLE_COLOR = {
  admin:           "#c0392b",
  coordinator:     "#2d7a4f",
  finance_officer: "#2563eb",
  viewer:          "#888",
};
