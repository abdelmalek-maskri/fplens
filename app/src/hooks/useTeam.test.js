import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTeam } from "./useTeam";

describe("useTeam", () => {
  it("returns team data immediately (mock mode)", () => {
    const { result } = renderHook(() => useTeam());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toHaveProperty("team");
    expect(result.current.data).toHaveProperty("transferSuggestions");
  });

  it("team has 15 picks (FPL squad size)", () => {
    const { result } = renderHook(() => useTeam());
    expect(result.current.data.team.picks).toHaveLength(15);
  });

  it("each pick has required fields", () => {
    const { result } = renderHook(() => useTeam());
    const pick = result.current.data.team.picks[0];
    expect(pick).toHaveProperty("web_name");
    expect(pick).toHaveProperty("position");
    expect(pick).toHaveProperty("team_name");
    expect(pick).toHaveProperty("predicted_points");
  });
});
