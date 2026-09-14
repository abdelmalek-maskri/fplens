import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const MOCK_PLAYER = {
  element: 2,
  web_name: "Haaland",
  name: "Erling Haaland",
  team_name: "MCI",
  position: "FWD",
  value: 15.3,
  predicted_points: 7.2,
  form: 8.8,
};

const { getPredictions, getModels } = vi.hoisted(() => ({
  getPredictions: vi.fn(),
  getModels: vi.fn(),
}));

vi.mock("../../lib/api", () => ({ getPredictions, getModels }));

import { usePredictions } from "../../hooks/usePredictions";

beforeEach(() => {
  getPredictions.mockResolvedValue([MOCK_PLAYER]);
  getModels.mockResolvedValue([{ id: "config_d", name: "Config D", mae: 1.016 }]);
});

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

  it("loads available models", async () => {
    const { result } = renderHook(() => usePredictions());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.models.length).toBeGreaterThan(0);
    expect(result.current.models[0]).toHaveProperty("id");
    expect(result.current.models[0]).toHaveProperty("mae");
  });

  it("ignores a slow response for a model the user already switched away from", async () => {
    // Responses do not arrive in send order. Without a guard, the first model's
    // answer lands last and overwrites the one actually selected, so the
    // dropdown and the table disagree.
    let resolveFirst;
    getPredictions
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce([{ ...MOCK_PLAYER, web_name: "Salah" }]);

    const { result, rerender } = renderHook(({ id }) => usePredictions(id), {
      initialProps: { id: "config_d" },
    });

    rerender({ id: "baseline" });
    await waitFor(() => expect(result.current.data?.predictions[0].web_name).toBe("Salah"));

    resolveFirst([{ ...MOCK_PLAYER, web_name: "Haaland" }]);
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data.predictions[0].web_name).toBe("Salah");
  });
});
