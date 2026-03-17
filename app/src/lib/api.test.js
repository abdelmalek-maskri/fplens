import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPredictions,
  getBestXI,
  getBestSquad,
  getFixtures,
  getTeam,
  getPlayer,
  getModelInsights,
  getMultiGW,
  refresh,
  health,
} from "./api";

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
    await getPredictions();
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/predictions");
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

  it("throws on non-2xx response with status and body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve("no such route"),
    });

    await expect(getPredictions()).rejects.toThrow("404 Not Found: no such route");
  });

  it("throws on non-2xx with empty body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve(""),
    });

    await expect(health()).rejects.toThrow("500 Internal Server Error");
  });

  it("converts AbortError to timeout message", async () => {
    mockFetch.mockImplementation(() => {
      const err = new DOMException("signal is aborted", "AbortError");
      return Promise.reject(err);
    });

    await expect(getPredictions()).rejects.toThrow("Request timed out: GET /api/predictions");
  });

  it("re-throws non-abort errors as-is", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(health()).rejects.toThrow("Failed to fetch");
  });
});

describe("GET endpoints", () => {
  it("getPredictions hits /api/predictions", async () => {
    await getPredictions();
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/predictions");
  });

  it("getBestXI hits /api/best-xi", async () => {
    await getBestXI();
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/best-xi");
  });

  it("getBestSquad passes budget query param", async () => {
    await getBestSquad(85);
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/best-squad?budget=85");
  });

  it("getBestSquad defaults to budget=100", async () => {
    await getBestSquad();
    expect(mockFetch.mock.calls[0][0]).toContain("budget=100");
  });

  it("getFixtures passes num_gws query param", async () => {
    await getFixtures(3);
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/fixtures?num_gws=3");
  });

  it("getFixtures defaults to num_gws=6", async () => {
    await getFixtures();
    expect(mockFetch.mock.calls[0][0]).toContain("num_gws=6");
  });

  it("getTeam passes fplId in path", async () => {
    await getTeam(3935276);
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/team/3935276");
  });

  it("getPlayer passes elementId in path", async () => {
    await getPlayer(42);
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/player/42");
  });

  it("getModelInsights hits /api/model-insights", async () => {
    await getModelInsights();
    expect(mockFetch.mock.calls[0][0]).toBe("http://127.0.0.1:8000/api/model-insights");
  });

  it("getMultiGW passes horizon query param", async () => {
    await getMultiGW(4);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8000/api/predictions/multi-gw?horizon=4"
    );
  });

  it("getMultiGW defaults to horizon=3", async () => {
    await getMultiGW();
    expect(mockFetch.mock.calls[0][0]).toContain("horizon=3");
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
