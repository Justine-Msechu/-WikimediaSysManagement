import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./config";

export function uploadFile(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const ref = storageRef(storage, path);
    const task = uploadBytesResumable(ref, file);
    task.on(
      "state_changed",
      snap => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export async function deleteFile(path) {
  const ref = storageRef(storage, path);
  await deleteObject(ref);
}

export function evidencePath(activityId, fileName) {
  return `evidence/${activityId}/${Date.now()}_${fileName}`;
}
