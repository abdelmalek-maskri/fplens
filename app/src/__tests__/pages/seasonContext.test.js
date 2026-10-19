import { describe, it, expect } from "vitest";
import { seasonContext } from "../../pages/accuracy/seasonContext";

describe("seasonContext", () => {
  it("says only what is next when scoring is up to date", () => {
    // The heading already names the scored gameweek, so repeating it here
    // would be noise.
    expect(seasonContext(7, true, 8)).toEqual({ note: null, next: 8 });
  });

  it("calls out a gameweek that was played but not checked", () => {
    expect(seasonContext(6, true, 8)).toEqual({
      note: "Gameweek 7 has been played but not checked yet.",
      next: 8,
    });
  });

  it("ranges several unchecked gameweeks", () => {
    expect(seasonContext(5, true, 9).note).toBe(
      "Gameweeks 6-8 have been played but not checked yet."
    );
  });

  it("warns about unconfirmed bonus instead of pointing ahead", () => {
    const { note, next } = seasonContext(6, false, 8);
    expect(note).toContain("Bonus points are not confirmed yet");
    expect(next).toBeNull();
  });

  it("points nowhere when the upcoming gameweek is unknown", () => {
    // useGameweek reads the manifest separately, so it can still be loading
    // or have failed when accuracy has arrived.
    expect(seasonContext(7, true, undefined)).toEqual({ note: null, next: null });
  });

  it("points nowhere after the final gameweek of the season", () => {
    expect(seasonContext(38, true, 38)).toEqual({ note: null, next: null });
  });
});
