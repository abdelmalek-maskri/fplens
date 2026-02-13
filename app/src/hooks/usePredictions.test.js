import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePredictions } from "./usePredictions";

describe("usePredictions", () => {
  it("returns data immediately (mock mode)", () => {
    const { result } = renderHook(() => usePredictions());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).not.toBeNull();
    expect(result.current.data).toHaveProperty("predictions");
    expect(result.current.data).toHaveProperty("localShap");
    expect(result.current.data).toHaveProperty("modelOptions");
  });

  it("predictions array is non-empty", () => {
    const { result } = renderHook(() => usePredictions());
    expect(result.current.data.predictions.length).toBeGreaterThan(0);
  });

  it("each prediction has required fields", () => {
    const { result } = renderHook(() => usePredictions());
    const player = result.current.data.predictions[0];
    expect(player).toHaveProperty("web_name");
    expect(player).toHaveProperty("predicted_points");
    expect(player).toHaveProperty("position");
    expect(player).toHaveProperty("team_name");
  });
});
