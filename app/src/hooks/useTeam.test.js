import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock the API to return snake_case response matching real API shape
vi.mock("../lib/api", () => ({
  getTeam: vi.fn(() =>
    import("../mocks/team").then((m) => ({
      manager: m.mockUserTeam.manager,
      team_name: m.mockUserTeam.teamName,
      overall_rank: m.mockUserTeam.overallRank,
      overall_points: m.mockUserTeam.totalPoints,
      bank: m.mockUserTeam.budget,
      free_transfers: m.mockUserTeam.freeTransfers,
      picks: m.mockUserTeam.picks.map((p) => ({
        ...p,
        player_position: p.position,
      })),
      transfer_suggestions: m.mockTransferSuggestions,
    }))
  ),
}));

import { useTeam } from "./useTeam";

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
