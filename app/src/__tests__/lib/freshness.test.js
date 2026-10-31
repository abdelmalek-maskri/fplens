import { describe, it, expect } from "vitest";
import { snapshotFreshness } from "../../lib/freshness";

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
