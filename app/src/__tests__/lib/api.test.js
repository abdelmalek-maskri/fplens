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
  clearSnapshotCache,
  ApiError,
  SUPPORTED_SCHEMA_VERSION,
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
  // Snapshot reads are memoised in a module-level map, which outlives a test.
  // Without this, the second test to read manifest.json never calls fetch.
  clearSnapshotCache();
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
      predicted_gw: 4,
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

describe("snapshot memoisation", () => {
  it("reads a file once however many callers ask for it", async () => {
    await getModels();
    await getModels();
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("joins a request that is still in flight rather than starting a second", async () => {
    // Both callers start before either resolves, which is what happens on
    // first paint when two components each want the manifest.
    const [a, b] = await Promise.all([getManifest(), getManifest()]);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(a).toBe(b);
  });

  it("keeps different files apart", async () => {
    await getModels();
    await getManifest();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not remember a failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(getModels()).rejects.toThrow("offline");
    await expect(getModels()).resolves.toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used file once the cap is passed", async () => {
    // The cap is 8. models.json is read first, then kept warm, so the file
    // that goes is the oldest one nobody has touched since.
    await getModels();
    for (let i = 0; i < 7; i++) await getPredictions(`m${i}`);
    await getModels();
    await getPredictions("m7");

    mockFetch.mockClear();
    await getModels();
    expect(mockFetch).not.toHaveBeenCalled();
    await getPredictions("m0");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("is emptied by a sync, so the next read sees the new snapshot", async () => {
    await getModels();
    await refresh();
    mockFetch.mockClear();
    await getModels();
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

describe("ApiError carries the status", () => {
  // Callers used to tell "the file is absent" from "something broke" by
  // comparing the message text, which made user-facing wording a contract
  // between files. These assert the status is there to branch on instead.
  function failWith(status, statusText = "Error") {
    mockFetch.mockResolvedValue({
      ok: false,
      status,
      statusText,
      json: () => Promise.resolve({ detail: "nope" }),
      headers: { get: () => null },
    });
  }

  it.each([
    [404, "Not Found"],
    [422, "Unprocessable Entity"],
    [429, "Too Many Requests"],
    [500, "Internal Server Error"],
  ])("sets status %i on the thrown error", async (status, statusText) => {
    failWith(status, statusText);
    const err = await health().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(status);
  });

  it("is a real Error, so existing catch blocks still work", async () => {
    failWith(404, "Not Found");
    const err = await health().catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Not found.");
  });

  it("gives a player missing from the snapshot a 404 too", async () => {
    // The file was served fine; the id is not in it. Callers should not have
    // to care which layer noticed.
    mockFetch.mockResolvedValue(jsonResponse({ 42: { web_name: "Salah" } }));
    const err = await getPlayer(999).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });
});

describe("schema version", () => {
  // The committed snapshot and the frontend reading it ship in the same
  // commit, so a renamed key reaches every visitor at once. The version is
  // how a stale build notices rather than rendering blank.
  it("says nothing about a snapshot it understands", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockResolvedValue(jsonResponse({ schema_version: SUPPORTED_SCHEMA_VERSION }));
    await getManifest();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("treats a snapshot published before versioning as the oldest one", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockResolvedValue(jsonResponse({ gameweek: 11 }));
    await expect(getManifest()).resolves.toMatchObject({ gameweek: 11 });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns when the snapshot is newer than this build", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockResolvedValue(jsonResponse({ schema_version: SUPPORTED_SCHEMA_VERSION + 1 }));
    await getManifest();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain(`v${SUPPORTED_SCHEMA_VERSION + 1}`);
    warn.mockRestore();
  });

  it("still returns the manifest when the version is newer", async () => {
    // Adding fields is the compatible change, so a bump alone must not stop
    // the page rendering what it can already read.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockResolvedValue(jsonResponse({ schema_version: 99, default_model: "config_d" }));
    await expect(getManifest()).resolves.toMatchObject({ default_model: "config_d" });
    warn.mockRestore();
  });

  it("matches the version the job writes", async () => {
    // job/tests/test_snapshot.py asserts the other half of this: that the
    // committed manifest carries snapshot.SCHEMA_VERSION. Together they fail
    // if one side is bumped without the other.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const committed = await import("../../../public/data/manifest.json");
    mockFetch.mockResolvedValue(jsonResponse(committed.default));
    await getManifest();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
