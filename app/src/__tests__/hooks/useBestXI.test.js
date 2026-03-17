import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock the API to return snake_case response matching backend /best-xi shape
vi.mock("../../lib/api", () => ({
  getBestXI: vi.fn(() =>
    Promise.resolve({
      formation: "3-4-3",
      total_points: 62.5,
      total_with_captain: 69.3,
      captain_id: 2,
      vice_id: 3,
      starters: [
        { element: 20, web_name: "Raya", position: "GK", predicted_points: 4.2 },
        { element: 15, web_name: "TAA", position: "DEF", predicted_points: 5.4 },
        { element: 12, web_name: "Gabriel", position: "DEF", predicted_points: 5.1 },
        { element: 30, web_name: "Saliba", position: "DEF", predicted_points: 4.8 },
        { element: 3, web_name: "Salah", position: "MID", predicted_points: 6.8 },
        { element: 7, web_name: "Palmer", position: "MID", predicted_points: 6.1 },
        { element: 40, web_name: "Mbeumo", position: "MID", predicted_points: 4.5 },
        { element: 5, web_name: "Saka", position: "MID", predicted_points: 4.2 },
        { element: 2, web_name: "Haaland", position: "FWD", predicted_points: 7.2 },
        { element: 50, web_name: "Isak", position: "FWD", predicted_points: 5.5 },
        { element: 63, web_name: "Archer", position: "FWD", predicted_points: 2.1 },
      ],
      bench: [
        { element: 60, web_name: "Flekken", position: "GK", predicted_points: 3.6 },
        { element: 61, web_name: "Mykolenko", position: "DEF", predicted_points: 3.1 },
        { element: 62, web_name: "Wharton", position: "MID", predicted_points: 2.8 },
        { element: 10, web_name: "Watkins", position: "FWD", predicted_points: 1.8 },
      ],
    })
  ),
}));

import { useBestXI } from "../../hooks/useBestXI";

describe("useBestXI", () => {
  it("starts in loading state", () => {
    const { result } = renderHook(() => useBestXI());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("resolves with mapped data", async () => {
    const { result } = renderHook(() => useBestXI());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data.starters).toHaveLength(11);
    expect(result.current.data.bench).toHaveLength(4);
    expect(result.current.data.captainId).toBe(2);
    expect(result.current.data.viceId).toBe(3);
    expect(result.current.data.formation).toBe("3-4-3");
    expect(result.current.data.totalPoints).toBe(62.5);
    expect(result.current.data.totalWithCaptain).toBe(69.3);
  });

  it("each starter has required fields", async () => {
    const { result } = renderHook(() => useBestXI());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const starter = result.current.data.starters[0];
    expect(starter).toHaveProperty("element");
    expect(starter).toHaveProperty("web_name");
    expect(starter).toHaveProperty("position");
    expect(starter).toHaveProperty("predicted_points");
  });
});
