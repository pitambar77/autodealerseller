// Small client for the AutoDealer API (autodealer-api). Every request carries the signed-in
// user's token. Errors are thrown as ApiError with the server's message, so screens can show it.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'autodealer-token';

export class ApiError extends Error {
  constructor(status, message, details, body) {
    super(message);
    this.status = status;
    this.details = details;
    this.body = body;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session lasts until the tab closes */
  }
}

/**
 * api('GET', '/bootstrap') · api('POST', '/vehicles', body)
 * Resolves with the parsed JSON. Statuses listed in `opts.accept` (e.g. [422]) resolve instead of throwing.
 * `opts.passive`: a background request (doesn't count as activity for the admin idle sign-out).
 */
export async function api(method, path, body, opts = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.passive ? { 'X-Passive': '1' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, "Can't reach AutoDealer right now. Check your connection and try again.");
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (res.ok || opts.accept?.includes(res.status)) return data;
  throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.details, data);
}

/** Read a browser File as a data URL (what the upload endpoints accept). */
export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
