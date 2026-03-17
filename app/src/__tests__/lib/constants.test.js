import { describe, it, expect } from "vitest";
import {
  FDR_COLORS,
  FDR_MAP,
  TEAM_COLORS,
  POSITION_COLORS,
  POSITION_BG,
} from "../../lib/constants";

describe("FDR_COLORS", () => {
  it("covers all 5 FDR levels", () => {
    expect(Object.keys(FDR_COLORS)).toHaveLength(5);
    [1, 2, 3, 4, 5].forEach((level) => {
      expect(FDR_COLORS[level]).toHaveProperty("bg");
      expect(FDR_COLORS[level]).toHaveProperty("text");
      expect(FDR_COLORS[level]).toHaveProperty("label");
    });
  });
});

describe("FDR_MAP", () => {
  it("maps all 20 Premier League teams", () => {
    expect(Object.keys(FDR_MAP)).toHaveLength(20);
  });

  it("values are between 1 and 5", () => {
    Object.values(FDR_MAP).forEach((fdr) => {
      expect(fdr).toBeGreaterThanOrEqual(1);
      expect(fdr).toBeLessThanOrEqual(5);
    });
  });
});

describe("TEAM_COLORS", () => {
  it("maps all 20 Premier League teams", () => {
    expect(Object.keys(TEAM_COLORS)).toHaveLength(20);
  });

  it("values are valid hex colors", () => {
    Object.values(TEAM_COLORS).forEach((hex) => {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

describe("POSITION_COLORS", () => {
  it("has all 4 positions", () => {
    expect(POSITION_COLORS).toHaveProperty("GK");
    expect(POSITION_COLORS).toHaveProperty("DEF");
    expect(POSITION_COLORS).toHaveProperty("MID");
    expect(POSITION_COLORS).toHaveProperty("FWD");
  });
});

describe("POSITION_BG", () => {
  it("has all 4 positions", () => {
    expect(POSITION_BG).toHaveProperty("GK");
    expect(POSITION_BG).toHaveProperty("DEF");
    expect(POSITION_BG).toHaveProperty("MID");
    expect(POSITION_BG).toHaveProperty("FWD");
  });
});
