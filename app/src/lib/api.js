const BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// Predictions are identical for every visitor and change once per gameweek, so
// the job writes them to app/public/data and they are served as static files
// from this app's own origin. No API, no CORS, no model in memory.
const SNAPSHOT_BASE = "/data";

const DEFAULT_TIMEOUT = 30_000;

async function request(
  base,
  path,
  { method = "GET", headers = {}, timeout = DEFAULT_TIMEOUT } = {}
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${base}${path}`, {
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

const apiFetch = (path, opts) => request(BASE_URL, path, opts);
const snapshotFetch = (path, opts) => request(SNAPSHOT_BASE, path, opts);

export function getManifest() {
  return snapshotFetch("/manifest.json");
}

/**
 * Predicted points for every player, from the current snapshot.
 *
 * Without a modelId this reads the manifest first to learn the default, which
 * costs a second round trip. The manifest is ~500 bytes and browser-cached, and
 * the alternative is hardcoding a model name the job already knows.
 */
export async function getPredictions(modelId) {
  const id = modelId && modelId !== "default" ? modelId : (await getManifest()).default_model;
  return snapshotFetch(`/predictions_${encodeURIComponent(id)}.json`);
}

export function getModels() {
  return snapshotFetch("/models.json");
}

// The budget is fixed at £100m, so the optimal squad is the same for everyone
// and the job solves it once rather than per request.
export function getBestSquad() {
  return snapshotFetch("/best_squad.json");
}

/**
 * Team x gameweek fixture grid with difficulty ratings.
 *
 * The snapshot holds the maximum window the API used to allow, so narrowing it
 * is a slice here rather than a different request.
 */
export async function getFixtures(numGws = 6) {
  const data = await snapshotFetch("/fixtures.json");
  const fixtures = Object.fromEntries(
    Object.entries(data.fixtures ?? {}).map(([team, list]) => [team, list.slice(0, numGws)])
  );
  return { ...data, fixtures };
}

export function getTeam(fplId) {
  return apiFetch(`/api/team/${encodeURIComponent(fplId)}`);
}

/**
 * Full detail for one player: prediction, history, fixtures, SHAP.
 *
 * All 654 live in one file. Gzipped that is ~100KB, paid once, so clicking
 * through players after the first costs nothing. A file each would be a smaller
 * first click but would rewrite 654 files every gameweek.
 */
export async function getPlayer(elementId) {
  const players = await snapshotFetch("/players.json");
  const player = players[elementId];
  if (!player) throw new Error("Not found.");
  return player;
}

export function getModelInsights() {
  return snapshotFetch("/model_insights.json");
}

// Not in the snapshot. The Guardian's licence forbids retaining content beyond
// 24 hours, and the snapshot is committed, so this stays a live call.
export function getNews() {
  return apiFetch("/api/news");
}

// The snapshot always covers GW+1 through GW+3, and the planner narrows it
// locally, so there is no horizon param.
export function getMultiGW() {
  return snapshotFetch("/multi_gw.json");
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

export async function getStatus() {
  const { gameweek, deadline } = await getManifest();
  return { current_gw: gameweek, deadline };
}
