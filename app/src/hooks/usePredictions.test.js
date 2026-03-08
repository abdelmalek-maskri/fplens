import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock the API to return mock data
vi.mock("../lib/api", () => ({
  getPredictions: vi.fn(() => import("../mocks/predictions").then((m) => m.mockPredictions)),
}));

import { usePredictions } from "./usePredictions";

describe("usePredictions", () => {
  it("starts in loading state", () => {
    const { result } = renderHook(() => usePredictions());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("resolves with prediction data", async () => {
    const { result } = renderHook(() => usePredictions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
    expect(result.current.data).toHaveProperty("predictions");
    expect(result.current.data).toHaveProperty("localShap");
    expect(result.current.data).toHaveProperty("modelOptions");
  });

  it("predictions array is non-empty", async () => {
    const { result } = renderHook(() => usePredictions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data.predictions.length).toBeGreaterThan(0);
  });

  it("each prediction has required fields", async () => {
    const { result } = renderHook(() => usePredictions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const player = result.current.data.predictions[0];
    expect(player).toHaveProperty("web_name");
    expect(player).toHaveProperty("predicted_points");
    expect(player).toHaveProperty("position");
    expect(player).toHaveProperty("team_name");
  });
});
