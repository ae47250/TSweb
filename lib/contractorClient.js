const CSRF_STORAGE_KEY = "tree_dude_csrf";

function storedCsrfToken() {
  return typeof window === "undefined" ? "" : window.sessionStorage.getItem(CSRF_STORAGE_KEY) || "";
}

export function storeContractorCsrfToken(token) {
  if (typeof window !== "undefined" && token) window.sessionStorage.setItem(CSRF_STORAGE_KEY, token);
}

async function ensureCsrfToken() {
  const existing = storedCsrfToken();
  if (existing) return existing;
  const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return "";
  const session = await response.json();
  storeContractorCsrfToken(session.csrfToken);
  return session.csrfToken || "";
}

export async function contractorFetch(url, init = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  const csrfToken = mutating ? await ensureCsrfToken() : "";
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.headers || {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
  });
  if (response.status === 401 && typeof window !== "undefined") {
    window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
    window.location.assign("/login");
  }
  return response;
}

export async function contractorPostJson(url, body) {
  const response = await contractorFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
