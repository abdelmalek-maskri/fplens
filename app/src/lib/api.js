const BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const DEFAULT_TIMEOUT = 30_000;

async function apiFetch(path, { method = "GET", headers = {}, timeout = DEFAULT_TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: { ...(method === "POST" ? { "Content-Type": "application/json" } : {}), ...headers },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
    }

    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out: ${method} ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// --- API methods ---

export function getPredictions() {
  return apiFetch("/api/predictions");
}

export function getBestXI() {
  return apiFetch("/api/best-xi");
}

export function getBestSquad(budget = 100) {
  return apiFetch(`/api/best-squad?budget=${budget}`);
}

export function getFixtures(numGws = 6) {
  return apiFetch(`/api/fixtures?num_gws=${numGws}`);
}

export function getTeam(fplId) {
  return apiFetch(`/api/team/${fplId}`);
}

export function getPlayer(elementId) {
  return apiFetch(`/api/player/${elementId}`);
}

export function getModelInsights() {
  return apiFetch("/api/model-insights");
}

export function getNews(days = 7) {
  return apiFetch(`/api/news?days=${days}`);
}

export function getMultiGW(horizon = 6) {
  return apiFetch(`/api/predictions/multi-gw?horizon=${horizon}`);
}

export function refresh(secret = "dev-secret") {
  return apiFetch("/api/refresh", {
    method: "POST",
    headers: { "X-Refresh-Secret": secret },
  });
}

export function health() {
  return apiFetch("/api/health");
}

export function getStatus() {
  return apiFetch("/api/status");
}
