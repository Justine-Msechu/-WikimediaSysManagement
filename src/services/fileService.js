import { storage } from "../firebase/config";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

const MAX_MB = 10;

export async function uploadFile(file, storagePath, onProgress) {
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`File is too large. Maximum size is ${MAX_MB} MB.`);
  }
  return new Promise((resolve, reject) => {
    const fileRef = ref(storage, storagePath);
    const task    = uploadBytesResumable(fileRef, file);
    task.on(
      "state_changed",
      snap => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, storagePath });
        } catch (err) { reject(err); }
      }
    );
  });
}

export async function deleteFile(storagePath) {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (_) { /* best-effort — file may already be gone */ }
}

export function activityFilePath(activityId, fileName) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `activities/${activityId}/${Date.now()}_${safe}`;
}

export function budgetFilePath(entryId, fileName) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `budget/${entryId}/${Date.now()}_${safe}`;
}

export function fileIcon(mimeType = "") {
  if (mimeType.startsWith("image/")) return "🖼";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  return "📎";
}
