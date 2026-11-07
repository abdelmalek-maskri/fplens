// The snapshot job runs once a day, so anything inside a day is normal and
// anything past it means the numbers on screen are no longer current.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * How current the snapshot is.
 *
 * The sidebar used to show a green dot and the word "Live" unconditionally,
 * which stayed green whether the snapshot was minutes or weeks old. This
 * reads the generated_at the job already ships in manifest.json.
 */
export function snapshotFreshness(generatedAt, now = Date.now()) {
  if (!generatedAt) return { level: "unknown", label: "No data", detail: null };

  const age = now - new Date(generatedAt).getTime();
  if (Number.isNaN(age)) return { level: "unknown", label: "No data", detail: null };

  // A clock behind the server's reads as a negative age rather than an error.
  const detail = `Updated ${relative(Math.max(age, 0))}`;
  if (age < DAY) return { level: "live", label: "Live", detail };
  if (age < 3 * DAY) return { level: "stale", label: "Stale", detail };
  return { level: "stale", label: "Outdated", detail };
}

/**
 * Whether the gameweek the snapshot predicted is still open.
 *
 * The manifest ships one gameweek number, chosen when the job ran, and the job
 * runs on a daily timer. Once that gameweek's deadline passes the squad is
 * frozen, so the predictions on screen can no longer be acted on, and they stay
 * on screen until the next run. On 2026-11-07 that left GW10 predictions up for
 * 20 hours after GW10 had kicked off, with the header still presenting the
 * deadline as if it were ahead.
 *
 * The deadline is already in the manifest, so the page can work this out
 * itself rather than waiting to be told.
 */
export function gameweekPhase(gameweek, deadline, now = Date.now()) {
  const at = deadline ? new Date(deadline).getTime() : NaN;
  if (gameweek == null || Number.isNaN(at)) {
    return { gw: gameweek ?? null, locked: false, deadlineAt: null };
  }
  return { gw: gameweek, locked: now >= at, deadlineAt: new Date(at) };
}

function relative(age) {
  if (age < HOUR) {
    const mins = Math.floor(age / 60_000);
    return mins < 1 ? "just now" : `${mins} min ago`;
  }
  if (age < DAY) {
    const hours = Math.round(age / HOUR);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  const days = Math.round(age / DAY);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
