const BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const DEFAULT_TIMEOUT = 30_000;

function buildUrl(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null),
  );
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

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
      if (res.status === 422) throw new Error("Invalid input — check your values and try again.");
      if (res.status === 404) throw new Error("Not found.");
      const body = await res.json().catch(() => null);
      const detail = body?.detail || res.statusText;
      throw new Error(`${res.status}: ${detail}`);
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

export function getPredictions(modelId) {
  return apiFetch(buildUrl("/api/predictions", { model: modelId }));
}

export function getModels() {
  return apiFetch("/api/models");
}

export function getBestXI() {
  return apiFetch("/api/best-xi");
}

export function getBestSquad(budget = 100) {
  return apiFetch(buildUrl("/api/best-squad", { budget }));
}

export function getFixtures(numGws = 6) {
  return apiFetch(buildUrl("/api/fixtures", { num_gws: numGws }));
}

export function getTeam(fplId) {
  return apiFetch(`/api/team/${encodeURIComponent(fplId)}`);
}

export function getPlayer(elementId) {
  return apiFetch(`/api/player/${encodeURIComponent(elementId)}`);
}

export function getModelInsights() {
  return apiFetch("/api/model-insights");
}

export function getNews(days = 7) {
  return apiFetch(buildUrl("/api/news", { days }));
}

export function getMultiGW(horizon = 3) {
  return apiFetch(buildUrl("/api/predictions/multi-gw", { horizon }));
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
