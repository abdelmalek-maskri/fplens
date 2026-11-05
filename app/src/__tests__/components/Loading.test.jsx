import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Loading, { WAKING_API } from "../../components/feedback/Loading";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const wait = (ms) => act(() => vi.advanceTimersByTime(ms));

describe("Loading", () => {
  it("cycles through its messages when nothing better is known", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Nice things take time");
    wait(3000);
    expect(screen.getByRole("status")).not.toHaveTextContent("Nice things take time");
  });

  // A bouncing ball claiming to scout 800 players for a minute reads as broken,
  // which is exactly how the deployed Transfers page read.
  it("explains a long wait instead of guessing at one", () => {
    render(<Loading slowMessage={WAKING_API} />);
    wait(6000);
    expect(screen.getByRole("status")).toHaveTextContent(WAKING_API);
  });

  it("stops cycling once it has something true to say", () => {
    render(<Loading slowMessage={WAKING_API} />);
    wait(6000);
    wait(9000);
    expect(screen.getByRole("status")).toHaveTextContent(WAKING_API);
  });

  it("says nothing about waking before the wait is long enough to mean it", () => {
    render(<Loading slowMessage={WAKING_API} />);
    wait(3000);
    expect(screen.getByRole("status")).not.toHaveTextContent(WAKING_API);
  });
});
