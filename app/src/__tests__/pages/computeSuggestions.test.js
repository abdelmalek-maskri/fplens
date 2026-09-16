import { describe, it, expect } from "vitest";
import { computeSuggestions } from "../../pages/transfers/suggestions";

const player = (over = {}) => ({
  element: 1,
  web_name: "P",
  team: "ARS",
  position: "MID",
  value: 5.0,
  selling_price: 5.0,
  status: "a",
  predicted: [1.0, 1.0, 1.0],
  fdr: [3, 3, 3],
  ...over,
});

// Two squad players flagged for replacement: both predicted low enough to
// qualify, cheapest sale first.
const squad = [
  player({ element: 1, value: 5.0, selling_price: 5.0, predicted: [0, 0, 0] }),
  player({ element: 2, value: 6.0, selling_price: 6.0, predicted: [0, 0, 0] }),
];

describe("computeSuggestions", () => {
  it("does not let two affordable transfers overspend together", () => {
    // £1m bank. Each upgrade costs £0.8m, so one fits and two do not.
    const targets = [
      player({ element: 10, value: 5.8, predicted: [9, 9, 9] }),
      player({ element: 11, value: 6.8, predicted: [9, 9, 9] }),
    ];

    const out = computeSuggestions(squad, targets, 3, 2, 1.0);
    const spend = out.reduce((s, t) => s + (t.in.value - t.out.selling_price), 0);

    expect(spend).toBeLessThanOrEqual(1.0);
    expect(out).toHaveLength(1);
  });

  it("allows both when the bank genuinely covers them", () => {
    const targets = [
      player({ element: 10, value: 5.8, predicted: [9, 9, 9] }),
      player({ element: 11, value: 6.8, predicted: [9, 9, 9] }),
    ];

    const out = computeSuggestions(squad, targets, 3, 2, 2.0);
    expect(out).toHaveLength(2);
  });

  it("will not take a fourth player from one club", () => {
    // Three Chelsea players held, all better than the only target, so the
    // only move with a gain is selling an Arsenal player for a fourth
    // Chelsea player. That is illegal, so nothing is suggested.
    const held = [
      ...squad,
      player({ element: 3, team: "CHE", predicted: [9, 9, 9] }),
      player({ element: 4, team: "CHE", predicted: [9, 9, 9] }),
      player({ element: 5, team: "CHE", predicted: [9, 9, 9] }),
    ];
    const targets = [player({ element: 10, team: "CHE", value: 5.0, predicted: [8, 8, 8] })];

    expect(computeSuggestions(held, targets, 3, 2, 10.0)).toHaveLength(0);
  });

  it("picks the biggest gain, not the worst player", () => {
    // A £4.5m bench forward is the worst player in the squad, but the best
    // £4.5m forward is barely better. The injured £6.2m midfielder has a real
    // upgrade available. The old order sold the forward for +0.4.
    const held = [
      player({
        element: 1,
        position: "FWD",
        value: 4.5,
        selling_price: 4.5,
        predicted: [0.1, 0, 0],
      }),
      player({
        element: 2,
        position: "MID",
        value: 6.2,
        selling_price: 6.2,
        status: "i",
        predicted: [1, 0, 0],
      }),
    ];
    const targets = [
      player({ element: 10, position: "FWD", value: 4.5, predicted: [0.5, 0, 0], team: "LIV" }),
      player({ element: 11, position: "MID", value: 6.1, predicted: [3.4, 0, 0], team: "BOU" }),
    ];

    const out = computeSuggestions(held, targets, 1, 1, 0.2);
    expect(out).toHaveLength(1);
    expect(out[0].out.element).toBe(2);
    expect(out[0].points_gain).toBeCloseTo(2.4);
    expect(out[0].reason).toBe("Injured");
  });

  it("stops when no move gains anything", () => {
    const targets = [player({ element: 10, value: 5.0, predicted: [0, 0, 0] })];
    expect(computeSuggestions(squad, targets, 3, 2, 10.0)).toHaveLength(0);
  });

  it("frees a club slot when selling from that club", () => {
    // Three Chelsea players, and one of them is the one being sold.
    const held = [
      player({ element: 1, team: "CHE", selling_price: 5.0, predicted: [0, 0, 0] }),
      player({ element: 3, team: "CHE", predicted: [5, 5, 5] }),
      player({ element: 4, team: "CHE", predicted: [5, 5, 5] }),
    ];
    const targets = [player({ element: 10, team: "CHE", value: 5.0, predicted: [9, 9, 9] })];

    const out = computeSuggestions(held, targets, 3, 1, 0);
    expect(out).toHaveLength(1);
    expect(out[0].in.team).toBe("CHE");
  });

  it("never suggests the same player twice", () => {
    const targets = [player({ element: 10, value: 5.0, predicted: [9, 9, 9] })];
    const out = computeSuggestions(squad, targets, 3, 2, 10.0);
    expect(new Set(out.map((t) => t.in.element)).size).toBe(out.length);
  });

  it("stops at the transfer limit", () => {
    const targets = [
      player({ element: 10, value: 5.0, predicted: [9, 9, 9] }),
      player({ element: 11, value: 5.0, predicted: [9, 9, 9], team: "LIV" }),
    ];
    expect(computeSuggestions(squad, targets, 3, 1, 10.0)).toHaveLength(1);
  });
});
