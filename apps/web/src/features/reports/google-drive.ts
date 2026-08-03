/**
 * Client-side Google Drive export utility using Google Identity Services (GIS) & Google Drive API.
 * Zero backend infrastructure required — runs entirely in the user's browser.
 */

export interface GoogleDriveExportInput {
  title: string;
  content: string;
  mimeType?: string;
  clientId?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }): {
            requestAccessToken(overrideConfig?: { prompt?: string }): void;
          };
        };
      };
    };
    gapiAccessToken?: string;
  }
}

let gisScriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

export async function requestGoogleAccessToken(clientId: string): Promise<string> {
  await loadGisScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services client is unavailable');
  }

  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google OAuth error: ${response.error}`));
        } else if (response.access_token) {
          window.gapiAccessToken = response.access_token;
          resolve(response.access_token);
        } else {
          reject(new Error('No access token returned from Google'));
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export async function saveToGoogleDrive({
  title,
  content,
  mimeType = 'text/markdown',
  clientId,
}: GoogleDriveExportInput): Promise<{ fileId: string; webViewLink?: string }> {
  let token = window.gapiAccessToken;

  // If no cached token and clientId is provided, trigger GIS consent popup
  if (!token && clientId) {
    token = await requestGoogleAccessToken(clientId);
  }

  if (!token) {
    // If no token can be obtained, attempt prompt or fallback cleanly to local file download
    let promptToken: string | null = null;
    try {
      if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        promptToken = window.prompt(
          'To save directly to your Google Drive, enter a Google OAuth Access Token (or obtain one from Google OAuth Playground):',
        );
      }
    } catch {
      // window.prompt is not supported in Electron renderers or restricted browsers
      promptToken = null;
    }

    if (promptToken && promptToken.trim()) {
      token = promptToken.trim();
      window.gapiAccessToken = token;
    } else {
      // User cancelled, prompt unsupported, or no token provided: download locally
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
      a.click();
      URL.revokeObjectURL(url);
      return { fileId: 'download-fallback' };
    }
  }

  const metadata = {
    name: `${title}.md`,
    mimeType,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: mimeType }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    // If token expired, clear cached token
    if (res.status === 401) {
      delete window.gapiAccessToken;
    }
    throw new Error(`Google Drive upload failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string; webViewLink?: string };
  return { fileId: data.id, webViewLink: data.webViewLink };
}
