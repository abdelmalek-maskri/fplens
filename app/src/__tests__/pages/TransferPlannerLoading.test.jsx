import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TransferPlanner from "../../pages/TransferPlanner";
import { WAKING_API } from "../../components/feedback/Loading";
import { getMultiGW, getTeam } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  getMultiGW: vi.fn(),
  getTeam: vi.fn(),
}));

describe("TransferPlanner loading", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    getMultiGW.mockReturnValue(new Promise(() => {}));
    getTeam.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it.each([
    [null, "Loading transfer data is taking longer than expected. Please wait."],
    ["123", WAKING_API],
  ])("shows the appropriate slow message for FPL ID %s", (id, message) => {
    if (id) localStorage.setItem("fpl_id", id);
    render(
      <MemoryRouter>
        <TransferPlanner />
      </MemoryRouter>
    );

    act(() => vi.advanceTimersByTime(6000));

    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(getTeam).toHaveBeenCalledTimes(id ? 1 : 0);
  });
});
