import { describe, it, expect } from "vitest";
import { defaultPair } from "../../pages/compare/defaultPair";

const p = (id, position, predicted_points) => ({ id, position, predicted_points });

describe("defaultPair", () => {
  it("opens on the top predicted player against the next best in his position", () => {
    // The page used to hardcode element IDs 2 and 50, which FPL reassigns
    // every season. This year they resolved to a backup keeper and a
    // midfielder with no minutes.
    const pool = [
      p(2, "GK", 0.5),
      p(50, "MID", 0.2),
      p(426, "MID", 6.9),
      p(7, "FWD", 6.0),
      p(9, "MID", 4.9),
    ];
    expect(defaultPair(pool)).toEqual([426, 9]);
  });

  it("falls back to the second best overall when nobody shares the position", () => {
    const pool = [p(1, "GK", 5.0), p(2, "FWD", 4.0), p(3, "MID", 3.0)];
    expect(defaultPair(pool)).toEqual([1, 2]);
  });

  it("copes with an empty pool", () => {
    expect(defaultPair([])).toEqual([null, null]);
  });
});
