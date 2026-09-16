import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { getPlayer } = vi.hoisted(() => ({ getPlayer: vi.fn() }));
vi.mock("../../lib/api", () => ({ getPlayer }));

import { usePlayer } from "../../hooks/usePlayer";

const PLAYER = {
  element: 426,
  web_name: "B.Fernandes",
  name: "Bruno B.Fernandes",
  team_name: "MUN",
  position: "MID",
  value: 12.0,
  predicted_points: 6.9,
  predicted_range_low: 3.6,
  predicted_range_high: 10.3,
  // A strong club's opponents all find it hard, so defFdr is 4 every week.
  // Averaging that in made every fixture render as 4.
  fixtures: [
    { gw: 5, opponent: "FUL", home: false, atkFdr: 3, defFdr: 4 },
    { gw: 6, opponent: "CHE", home: false, atkFdr: 4, defFdr: 4 },
    { gw: 7, opponent: "BHA", home: true, atkFdr: 2, defFdr: 4 },
  ],
};

beforeEach(() => {
  getPlayer.mockResolvedValue(PLAYER);
});

describe("usePlayer", () => {
  it("shows the team's own difficulty for each fixture, not an average", async () => {
    const { result } = renderHook(() => usePlayer("426"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.data.fixtures.map((f) => f.fdr)).toEqual([3, 4, 2]);
  });

  it("keeps an explicit fdr if the snapshot ever provides one", async () => {
    getPlayer.mockResolvedValue({
      ...PLAYER,
      fixtures: [{ gw: 5, opponent: "FUL", home: false, atkFdr: 3, defFdr: 4, fdr: 5 }],
    });
    const { result } = renderHook(() => usePlayer("426"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.data.fixtures[0].fdr).toBe(5);
  });

  it("builds the prediction range from the two snapshot fields", async () => {
    const { result } = renderHook(() => usePlayer("426"));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.data.predicted_range).toEqual([3.6, 10.3]);
  });
});
