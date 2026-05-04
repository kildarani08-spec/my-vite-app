export const API_BASE = "/ecommerce";

export function getAuthToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

export function getStoredUser() {
  const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function adminFetch(path, options = {}) {
  const token = getAuthToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const response = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Server returned invalid JSON");
    }
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
  }

  return payload;
}

export async function logoutUser() {
  const token = getAuthToken();

  if (token) {
    try {
      await fetch(`${API_BASE}/logout.php`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch {
      // Clear local session even if backend is unreachable.
    }
  }

  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
}
