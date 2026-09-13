import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const MULTI_GW = [
  {
    element: 1,
    web_name: "Salah",
    team_name: "LIV",
    position: "MID",
    value: 13.0,
    status: "a",
    form: 8.0,
    predicted: [6.5, 6.0, 5.5],
    fdr: [2, 3, 2],
  },
];

const TEAM = {
  manager: "A Manager",
  bank: 4.7,
  picks: [
    {
      element: 1,
      web_name: "Salah",
      player_position: "MID",
      team_name: "LIV",
      value: 13.0,
      status: "a",
    },
  ],
};

const { getMultiGW, getTeam } = vi.hoisted(() => ({
  getMultiGW: vi.fn(),
  getTeam: vi.fn(),
}));

vi.mock("../../lib/api", () => ({ getMultiGW, getTeam }));

import { useTransfers } from "../../hooks/useTransfers";

describe("useTransfers", () => {
  beforeEach(() => {
    localStorage.clear();
    getMultiGW.mockResolvedValue(MULTI_GW);
    getTeam.mockResolvedValue(TEAM);
  });

  it("passes the manager's real bank balance through", async () => {
    // The planner used to hardcode 2.3 because the hook dropped this field,
    // so every user saw a budget built on a number that was not theirs.
    localStorage.setItem("fpl_id", "123");
    const { result } = renderHook(() => useTransfers());

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data.bank).toBe(4.7);
  });

  it("reports a zero bank as zero, not as missing", async () => {
    localStorage.setItem("fpl_id", "123");
    getTeam.mockResolvedValue({ ...TEAM, bank: 0 });
    const { result } = renderHook(() => useTransfers());

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data.bank).toBe(0);
  });

  it("gives a null bank when no squad is loaded", async () => {
    // No fpl_id, so no team is fetched. The page needs to tell this apart from
    // a real squad holding nothing, and hide the budget rather than show zero.
    const { result } = renderHook(() => useTransfers());

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data.bank).toBeNull();
    expect(result.current.data.myTeam).toEqual([]);
  });

  it("still returns transfer targets without a squad", async () => {
    const { result } = renderHook(() => useTransfers());

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.data.targets).toHaveLength(1);
    expect(result.current.data.targets[0].web_name).toBe("Salah");
  });
});
