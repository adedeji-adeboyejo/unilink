// Small wrapper around fetch for talking to the FastAPI backend.
// During dev, vite proxies /api to localhost:8000 (see vite.config.js).
// Set VITE_API_URL if you want to hit the backend directly instead.
const BASE = import.meta.env.VITE_API_URL || "/api";

// sessionStorage can throw (private mode, blocked cookies etc.) so wrap it
const store = {
  get() {
    try {
      return JSON.parse(sessionStorage.getItem("unilink.session"));
    } catch {
      return null;
    }
  },

  set(v) {
    try {
      if (v) sessionStorage.setItem("unilink.session", JSON.stringify(v));
      else sessionStorage.removeItem("unilink.session");
    } catch {
      // if storage is blocked we just keep the session in memory
    }
  },
};

let session = store.get();
let onExpired = () => {};

export const getSession = () => session;

export const setSession = (s) => {
  session = s;
  store.set(s);
};

export const onSessionExpired = (fn) => {
  onExpired = fn;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, query } = {}) {
  let url = BASE + path;

  if (query) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== "" && v != null) q.set(k, v);
    }
    const s = q.toString();
    if (s) url += "?" + s;
  }

  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the UniLink server. Check that the backend is running on port 8000.", 0);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // token expired / invalid -> kick back to login (but not for a bad login attempt)
    if (res.status === 401 && path !== "/login") {
      setSession(null);
      onExpired();
    }
    throw new ApiError(data.detail || `Request failed (${res.status})`, res.status);
  }

  return data;
}

// course codes have a space in them ("COMP 3150") so they need encoding in urls
export const enc = encodeURIComponent;
