import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// importOriginal keeps the real ApiError, because the hook branches on the
// class and a stand-in would make the test pass for the wrong reason.
vi.mock("../../lib/api", async (importOriginal) => ({
  ...(await importOriginal()),
  getAccuracy: vi.fn(),
  getModels: vi.fn(),
  getManifest: vi.fn(),
}));

import { getAccuracy, getModels, getManifest, ApiError } from "../../lib/api";
import { useAccuracy } from "../../hooks/useAccuracy";

const SCORED = { gameweek: 9, final: true, models: { config_d: { mae: 1.03 } } };
const MODELS = [{ id: "config_d", name: "Config D" }];
const MANIFEST = { default_model: "config_d" };

beforeEach(() => {
  getAccuracy.mockResolvedValue(SCORED);
  getModels.mockResolvedValue(MODELS);
  getManifest.mockResolvedValue(MANIFEST);
});

describe("useAccuracy", () => {
  it("merges model names and the default model into the scored results", async () => {
    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toMatchObject({
      gameweek: 9,
      names: { config_d: "Config D" },
      defaultModel: "config_d",
    });
    expect(result.current.error).toBeNull();
  });

  it("treats a missing accuracy file as no gameweek scored, not an error", async () => {
    getAccuracy.mockRejectedValue(new ApiError("Not found.", 404));
    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("reports a missing manifest as an error", async () => {
    // A 404 here means the snapshot failed to publish. Reporting it as an
    // empty season would tell the visitor something false and calm.
    getManifest.mockRejectedValue(new ApiError("Not found.", 404));
    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it("reports a missing models file as an error", async () => {
    getModels.mockRejectedValue(new ApiError("Not found.", 404));
    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });

  it("reports a non-404 failure on the accuracy file as an error", async () => {
    getAccuracy.mockRejectedValue(new ApiError("500: boom", 500));
    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error?.status).toBe(500);
  });

  it("does not mistake a plain Error reading 'Not found.' for an empty season", async () => {
    // The whole point of the status field: the wording stops being a contract.
    getAccuracy.mockRejectedValue(new Error("Not found."));
    const { result } = renderHook(() => useAccuracy());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});
