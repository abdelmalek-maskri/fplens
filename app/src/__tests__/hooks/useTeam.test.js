import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const MOCK_API_RESPONSE = {
  manager: "Abdelmalek Maskri",
  team_name: "ML FC",
  overall_rank: 48201,
  overall_points: 1284,
  bank: 2.3,
  free_transfers: 1,
  picks: Array.from({ length: 15 }, (_, i) => ({
    element: i + 1,
    web_name: `Player ${i + 1}`,
    player_position: i < 2 ? "GK" : i < 7 ? "DEF" : i < 12 ? "MID" : "FWD",
    team_name: "MCI",
    predicted_points: 4 + Math.random() * 3,
    is_captain: i === 0,
    is_vice_captain: i === 1,
    multiplier: i === 0 ? 2 : i < 11 ? 1 : 0,
  })),
  transfer_suggestions: [],
};

vi.mock("../../lib/api", () => ({
  getTeam: vi.fn(() => Promise.resolve(MOCK_API_RESPONSE)),
}));

import { useTeam } from "../../hooks/useTeam";

describe("useTeam", () => {
  it("starts in loading state when fplId is provided", () => {
    const { result } = renderHook(() => useTeam(3935276));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("stays idle without fplId", () => {
    const { result } = renderHook(() => useTeam());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("resolves with team data and maps snake_case to camelCase", async () => {
    const { result } = renderHook(() => useTeam(3935276));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toHaveProperty("team");
    expect(result.current.data).toHaveProperty("transferSuggestions");

    const { team } = result.current.data;
    expect(team.manager).toBe("Abdelmalek Maskri");
    expect(team.teamName).toBe("ML FC");
    expect(team.overallRank).toBe(48201);
    expect(team.totalPoints).toBe(1284);
    expect(team.budget).toBe(2.3);
    expect(team.freeTransfers).toBe(1);
  });

  it("team has 15 picks (FPL squad size)", async () => {
    const { result } = renderHook(() => useTeam(3935276));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data.team.picks).toHaveLength(15);
  });

  it("each pick has required fields", async () => {
    const { result } = renderHook(() => useTeam(3935276));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const pick = result.current.data.team.picks[0];
    expect(pick).toHaveProperty("web_name");
    expect(pick).toHaveProperty("position");
    expect(pick).toHaveProperty("team_name");
    expect(pick).toHaveProperty("predicted_points");
  });
});
