const CLIENT_ID_KEY = 'wkgsf_drive_client_id';
const FILE_ID_KEY = 'wkgsf_drive_file_id';
const FILE_NAME = 'wkgsf-data.json';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient = null;
let accessToken = null;

function waitFor(check) {
  return new Promise((resolve) => {
    if (check()) { resolve(); return; }
    const t = setInterval(() => { if (check()) { clearInterval(t); resolve(); } }, 100);
  });
}

export function getStoredClientId() {
  return localStorage.getItem(CLIENT_ID_KEY) || '';
}

export function storeClientId(id) {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
}

export async function initDriveClient(clientId) {
  await waitFor(() => !!window.gapi);
  await waitFor(() => !!window.google?.accounts);

  await new Promise((resolve, reject) =>
    window.gapi.load('client', { callback: resolve, onerror: reject })
  );

  await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {},
  });
}

export function isSignedIn() {
  return !!accessToken;
}

export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('Drive not initialized — save your Client ID first')); return; }
    tokenClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
      accessToken = resp.access_token;
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

export function signOut() {
  if (accessToken) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
    accessToken = null;
  }
  localStorage.removeItem(FILE_ID_KEY);
}

async function findFileId() {
  const cached = localStorage.getItem(FILE_ID_KEY);
  if (cached) return cached;

  const resp = await window.gapi.client.drive.files.list({
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  const files = resp.result.files;
  if (files && files.length > 0) {
    localStorage.setItem(FILE_ID_KEY, files[0].id);
    return files[0].id;
  }
  return null;
}

export async function saveToDrive(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const fileId = await findFileId();
  const metadata = { name: FILE_NAME, mimeType: 'application/json' };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  let resp;
  if (fileId) {
    resp = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
      { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
    );
  } else {
    resp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
    );
    if (resp.ok) {
      const data = await resp.clone().json();
      localStorage.setItem(FILE_ID_KEY, data.id);
    }
  }

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Drive save failed');
  }
}

export async function loadFromDrive() {
  const fileId = await findFileId();
  if (!fileId) return null;

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (resp.status === 404) {
    localStorage.removeItem(FILE_ID_KEY);
    return null;
  }
  if (!resp.ok) throw new Error('Drive load failed');
  return await resp.json();
}
