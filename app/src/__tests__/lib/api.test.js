import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPredictions,
  getModels,
  getManifest,
  getBestSquad,
  getFixtures,
  getTeam,
  getPlayer,
  getModelInsights,
  getNews,
  getMultiGW,
  getStatus,
  refresh,
  health,
} from "../../lib/api";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(jsonResponse({ ok: true }));
});

describe("apiFetch shared behavior", () => {
  it("calls correct URL with BASE_URL prefix", async () => {
    await getTeam(123);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/team/123");
  });

  it("defaults to GET method", async () => {
    await health();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("GET");
  });

  it("passes AbortController signal for timeout", async () => {
    await health();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws friendly message on 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ detail: "not found" }),
    });

    await expect(getTeam(123)).rejects.toThrow("Not found.");
  });

  it("throws friendly message on 422", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: () => Promise.resolve({ detail: "validation error" }),
    });

    await expect(health()).rejects.toThrow("Invalid input");
  });

  it("includes detail from response body on other errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ detail: "something broke" }),
    });

    await expect(health()).rejects.toThrow("500: something broke");
  });

  it("falls back to statusText when body has no detail", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: () => Promise.reject(new Error("not json")),
    });

    await expect(health()).rejects.toThrow("502: Bad Gateway");
  });

  it("converts AbortError to timeout message", async () => {
    mockFetch.mockImplementation(() => {
      const err = new DOMException("signal is aborted", "AbortError");
      return Promise.reject(err);
    });

    await expect(getTeam(123)).rejects.toThrow("Request timed out: GET /api/team/123");
  });

  it("re-throws non-abort errors as-is", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(health()).rejects.toThrow("Failed to fetch");
  });
});

describe("GET endpoints", () => {
  it("getNews stays a live call, not a snapshot file", async () => {
    // The Guardian forbids retaining content past 24h and the snapshot is
    // committed, so headlines must never be written to a file.
    await getNews();
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/news");
  });

  it("getTeam passes fplId in path", async () => {
    await getTeam(3935276);
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/team/3935276");
  });
});

describe("snapshot files", () => {
  it("getModels reads the static file, not the API", async () => {
    await getModels();
    expect(mockFetch.mock.calls[0][0]).toBe("/data/models.json");
  });

  it("getManifest reads the static file", async () => {
    await getManifest();
    expect(mockFetch.mock.calls[0][0]).toBe("/data/manifest.json");
  });

  it("getPredictions reads the file for the model it was given", async () => {
    await getPredictions("baseline_tweedie");
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toBe("/data/predictions_baseline_tweedie.json");
  });

  it("getPredictions asks the manifest which model is default", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ default_model: "config_d" }))
      .mockResolvedValueOnce(jsonResponse([]));

    await getPredictions();
    expect(mockFetch.mock.calls[0][0]).toBe("/data/manifest.json");
    expect(mockFetch.mock.calls[1][0]).toBe("/data/predictions_config_d.json");
  });

  it("treats the sentinel 'default' the same as no model", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ default_model: "config_d" }))
      .mockResolvedValueOnce(jsonResponse([]));

    await getPredictions("default");
    expect(mockFetch.mock.calls[1][0]).toBe("/data/predictions_config_d.json");
  });

  it("getBestSquad reads the static file and takes no budget", async () => {
    // The budget is fixed at £100m, so the squad is the same for everyone.
    await getBestSquad();
    expect(mockFetch.mock.calls[0][0]).toBe("/data/best_squad.json");
    expect(getBestSquad.length).toBe(0);
  });

  it("getModelInsights reads the static file", async () => {
    await getModelInsights();
    expect(mockFetch.mock.calls[0][0]).toBe("/data/model_insights.json");
  });

  it("getFixtures reads one file and narrows it locally", async () => {
    const grid = { gw: 4, fixtures: { ARS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] } };
    mockFetch.mockResolvedValue(jsonResponse(grid));

    const six = await getFixtures(6);
    expect(mockFetch.mock.calls[0][0]).toBe("/data/fixtures.json");
    expect(six.fixtures.ARS).toEqual([1, 2, 3, 4, 5, 6]);
    expect(six.gw).toBe(4);
  });

  it("getPlayer looks the player up in the one players file", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ 42: { web_name: "Salah" } }));
    await expect(getPlayer(42)).resolves.toEqual({ web_name: "Salah" });
    expect(mockFetch.mock.calls[0][0]).toBe("/data/players.json");
  });

  it("getPlayer throws for an id the snapshot does not have", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ 42: { web_name: "Salah" } }));
    await expect(getPlayer(999)).rejects.toThrow("Not found.");
  });

  it("getMultiGW reads the static file and takes no horizon", async () => {
    await getMultiGW();
    expect(mockFetch.mock.calls[0][0]).toBe("/data/multi_gw.json");
    expect(getMultiGW.length).toBe(0);
  });

  it("getStatus reshapes the manifest instead of calling the API", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ gameweek: 4, deadline: "2026-09-12T17:30:00Z" }));
    await expect(getStatus()).resolves.toEqual({
      current_gw: 4,
      deadline: "2026-09-12T17:30:00Z",
    });
    expect(mockFetch.mock.calls[0][0]).toBe("/data/manifest.json");
  });

  it("getFixtures leaves a snapshot with no fixtures alone", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ gw: 4 }));
    await expect(getFixtures()).resolves.toEqual({ gw: 4, fixtures: {} });
  });
});

describe("refresh (POST)", () => {
  it("uses POST method", async () => {
    await refresh();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("POST");
  });

  it("sends X-Refresh-Secret header", async () => {
    await refresh();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["X-Refresh-Secret"]).toBe("dev-secret");
  });

  it("sends Content-Type for POST", async () => {
    await refresh();
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("accepts custom secret", async () => {
    await refresh("my-prod-secret");
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["X-Refresh-Secret"]).toBe("my-prod-secret");
  });
});
