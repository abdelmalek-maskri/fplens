import { describe, it, expect } from "vitest";
import { gameweekPhase, snapshotFreshness } from "../../lib/freshness";

const NOW = new Date("2026-10-31T12:00:00Z").getTime();
const ago = (ms) => new Date(NOW - ms).toISOString();

describe("snapshotFreshness", () => {
  it("is live within a day of the job running", () => {
    const { level, label } = snapshotFreshness(ago(4 * 3_600_000), NOW);
    expect(level).toBe("live");
    expect(label).toBe("Live");
  });

  it("goes stale once a daily run has been missed", () => {
    const { level, label } = snapshotFreshness(ago(30 * 3_600_000), NOW);
    expect(level).toBe("stale");
    expect(label).toBe("Stale");
  });

  it("says outdated past three days", () => {
    expect(snapshotFreshness(ago(5 * 86_400_000), NOW).label).toBe("Outdated");
  });

  it("reports unknown when the manifest has no timestamp", () => {
    expect(snapshotFreshness(undefined, NOW)).toEqual({
      level: "unknown",
      label: "No data",
      detail: null,
    });
  });

  it("reports unknown rather than NaN on an unparseable timestamp", () => {
    expect(snapshotFreshness("not a date", NOW).level).toBe("unknown");
  });

  it("describes the age in the largest useful unit", () => {
    expect(snapshotFreshness(ago(30_000), NOW).detail).toBe("Updated just now");
    expect(snapshotFreshness(ago(20 * 60_000), NOW).detail).toBe("Updated 20 min ago");
    expect(snapshotFreshness(ago(3_600_000), NOW).detail).toBe("Updated 1 hour ago");
    expect(snapshotFreshness(ago(5 * 3_600_000), NOW).detail).toBe("Updated 5 hours ago");
    expect(snapshotFreshness(ago(2 * 86_400_000), NOW).detail).toBe("Updated 2 days ago");
  });

  it("treats a clock ahead of the server as current, not negative", () => {
    expect(snapshotFreshness(ago(-60_000), NOW).detail).toBe("Updated just now");
  });
});

// The real state on 2026-11-07: the snapshot predicted GW10 at 14:28 on the
// 6th, GW10's deadline passed at 18:30 that evening, and the site kept serving
// GW10 predictions with the deadline shown as if it were still ahead.
const GW10_DEADLINE = "2026-11-06T18:30:00Z";

describe("gameweekPhase", () => {
  it("is open while the deadline is ahead", () => {
    const before = new Date("2026-11-06T14:28:00Z").getTime();
    expect(gameweekPhase(10, GW10_DEADLINE, before)).toEqual({
      gw: 10,
      locked: false,
      deadlineAt: new Date(GW10_DEADLINE),
    });
  });

  it("locks once the deadline has passed", () => {
    const after = new Date("2026-11-07T13:00:00Z").getTime();
    expect(gameweekPhase(10, GW10_DEADLINE, after).locked).toBe(true);
  });

  it("locks at the deadline itself, not a moment later", () => {
    expect(gameweekPhase(10, GW10_DEADLINE, new Date(GW10_DEADLINE).getTime()).locked).toBe(true);
  });

  it("stays open with no deadline rather than claiming one passed", () => {
    expect(gameweekPhase(10, null)).toEqual({ gw: 10, locked: false, deadlineAt: null });
  });

  it("stays open on an unparseable deadline", () => {
    expect(gameweekPhase(10, "not a date").locked).toBe(false);
  });

  it("reports no gameweek while the manifest is still loading", () => {
    expect(gameweekPhase(undefined, undefined)).toEqual({
      gw: null,
      locked: false,
      deadlineAt: null,
    });
  });
});
