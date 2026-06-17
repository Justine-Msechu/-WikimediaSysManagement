// Google Drive file upload service using Google Identity Services (GIS).
// Requires REACT_APP_GOOGLE_CLIENT_ID in .env

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const FOLDER_ID = process.env.REACT_APP_GOOGLE_DRIVE_FOLDER_ID || null;
const SCOPE     = "https://www.googleapis.com/auth/drive.file";
const MAX_MB    = 10;

let tokenClient  = null;
let cachedToken  = null;
let tokenExpiry  = 0;

function loadGIS() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    if (document.getElementById("gsi-script")) {
      // Script is loading — wait for it
      const check = setInterval(() => {
        if (window.google?.accounts?.oauth2) { clearInterval(check); resolve(); }
      }, 100);
      return;
    }
    const s = document.createElement("script");
    s.id      = "gsi-script";
    s.src     = "https://accounts.google.com/gsi/client";
    s.async   = true;
    s.onload  = resolve;
    s.onerror = () => reject(new Error("Failed to load Google Identity Services."));
    document.head.appendChild(s);
  });
}

async function getToken() {
  if (!CLIENT_ID) {
    throw new Error(
      "Google Drive is not configured. Add REACT_APP_GOOGLE_CLIENT_ID to your .env file."
    );
  }

  // Return cached token if still valid (with 60-second buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  await loadGIS();

  return new Promise((resolve, reject) => {
    const callback = (resp) => {
      if (resp.error) {
        reject(new Error(`Google authorisation failed: ${resp.error}`));
        return;
      }
      cachedToken = resp.access_token;
      tokenExpiry = Date.now() + resp.expires_in * 1000;
      resolve(cachedToken);
    };

    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id:      CLIENT_ID,
        scope:          SCOPE,
        callback,
        error_callback: (err) => reject(new Error(err.message || "Authorisation error")),
      });
    } else {
      tokenClient.callback = callback;
    }

    // Prompt-less attempt first; a popup appears only when consent is needed
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

// Upload a File object to Google Drive.
// onProgress(0-100) is called during the upload.
// Returns { fileId, name, url, mimeType, size }
export async function uploadToDrive(file, onProgress) {
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`File is too large. Maximum ${MAX_MB} MB allowed.`);
  }

  const token    = await getToken();
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._\- ]/g, "_")}`;
  const metadata = FOLDER_ID ? { name: safeName, parents: [FOLDER_ID] } : { name: safeName };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const fileData = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType"
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 400) {
        reject(new Error(`Upload failed (HTTP ${xhr.status}). Please try again.`));
        return;
      }
      resolve(JSON.parse(xhr.responseText));
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(form);
  });

  // Make the file viewable by anyone who has the link
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ role: "reader", type: "anyone" }),
    });
  } catch (_) { /* sharing is best-effort */ }

  return {
    fileId:   fileData.id,
    name:     file.name,
    url:      fileData.webViewLink,
    mimeType: file.type,
    size:     file.size,
  };
}

// Delete a Drive file by ID.  Best-effort — only works if the current user
// owns the file (i.e. they were the one who uploaded it).
export async function deleteFromDrive(fileId) {
  if (!fileId) return;
  try {
    const token = await getToken();
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (_) { /* ignore — file may be gone or owned by another user */ }
}

export function fileIcon(mimeType = "") {
  if (mimeType.startsWith("image/"))               return "🖼";
  if (mimeType === "application/pdf")               return "📄";
  if (mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      mimeType === "text/csv")                      return "📊";
  if (mimeType.includes("word") ||
      mimeType.includes("document"))                return "📝";
  return "📎";
}
