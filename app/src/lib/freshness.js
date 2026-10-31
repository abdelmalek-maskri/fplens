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
