import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const MOCK_PLAYERS = [
  { element: 1, web_name: "Haaland", team_name: "MCI", position: "FWD", predicted_points: 7.2 },
  { element: 2, web_name: "Salah", team_name: "LIV", position: "MID", predicted_points: 6.8 },
  { element: 3, web_name: "Saka", team_name: "ARS", position: "MID", predicted_points: 5.1 },
];

vi.mock("../lib/api", () => ({
  getPredictions: vi.fn(() => Promise.resolve(MOCK_PLAYERS)),
}));

import { useWatchlist } from "./useWatchlist";

beforeEach(() => {
  localStorage.clear();
});

describe("useWatchlist", () => {
  it("starts in loading state", () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.isLoading).toBe(true);
  });

  it("resolves with allPlayers from predictions", async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data.allPlayers).toHaveLength(3);
    expect(result.current.data.players).toHaveLength(0);
  });

  it("handles object response shape { predictions: [...] }", async () => {
    const { getPredictions } = await import("../lib/api");
    getPredictions.mockResolvedValueOnce({ predictions: MOCK_PLAYERS });

    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data.allPlayers).toHaveLength(3);
  });

  it("add persists to localStorage and filters watched players", async () => {
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => result.current.add(1));

    expect(result.current.watchIds).toContain(1);
    expect(result.current.data.players).toHaveLength(1);
    expect(result.current.data.players[0].web_name).toBe("Haaland");
    expect(JSON.parse(localStorage.getItem("fpl-watchlist"))).toContain(1);
  });

  it("remove persists to localStorage", async () => {
    localStorage.setItem("fpl-watchlist", JSON.stringify([1, 2]));
    const { result } = renderHook(() => useWatchlist());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data.players).toHaveLength(2);

    act(() => result.current.remove(1));

    expect(result.current.watchIds).not.toContain(1);
    expect(result.current.data.players).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("fpl-watchlist"))).toEqual([2]);
  });
});
