import { useMemo } from "react";
import { FDR_COLORS } from "../../lib/constants";

// The snapshot stores fixtures per team, so every match appears twice: once
// under the home side and once under the away side. Keeping only the home
// entries yields each match exactly once, with the sides already the right way
// round.
function buildMatches(fixtureData) {
  if (!fixtureData) return [];

  const { fixtures, currentGw } = fixtureData;
  return Object.entries(fixtures)
    .flatMap(([team, list]) =>
      (list || [])
        .filter((f) => f.gw === currentGw && f.home)
        .map((f) => ({
          home: team,
          away: f.opponent,
          kickoff: f.kickoff || null,
          homeFdr: f.atkFdr,
          awayFdr: f.defFdr,
        }))
    )
    .sort((a, b) => {
      if (a.kickoff && b.kickoff) return a.kickoff.localeCompare(b.kickoff);
      if (a.kickoff) return -1;
      if (b.kickoff) return 1;
      return a.home.localeCompare(b.home);
    });
}

// Kickoff is null for fixtures the Premier League has not scheduled yet, which
// is normal several weeks out. Those collapse into one undated group rather
// than being hidden, because an unscheduled match is still a match being played.
function groupByDay(matches) {
  const groups = new Map();

  for (const m of matches) {
    const key = m.kickoff
      ? new Date(m.kickoff).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      : "Date TBC";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  return [...groups.entries()];
}

function kickoffTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function Fdr({ rating }) {
  const colors = FDR_COLORS[rating] || FDR_COLORS[3];
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-bold shrink-0 ${colors.bg} ${colors.text}`}
    >
      {rating}
    </span>
  );
}

// Sits above a table of several hundred rows, so it has to earn its vertical
// space: a three column grid keeps ten matches to four rows instead of ten.
export default function GameweekFixtures({ fixtureData }) {
  const days = useMemo(() => groupByDay(buildMatches(fixtureData)), [fixtureData]);

  if (!days.length) return null;

  return (
    <section className="border-y border-surface-800 py-3">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {days.map(([day, matches]) => (
          <div key={day} className="min-w-0">
            <div className="text-2xs uppercase tracking-wide text-surface-500 mb-1.5">{day}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-1">
              {matches.map((m) => (
                <div
                  key={`${m.home}-${m.away}`}
                  className="flex items-center gap-1.5 text-xs text-surface-300 tabular-nums"
                >
                  <Fdr rating={m.homeFdr} />
                  <span className="text-surface-200 w-8">{m.home}</span>
                  <span className="text-surface-500 w-10 text-center">
                    {kickoffTime(m.kickoff) || "v"}
                  </span>
                  <span className="text-surface-200 w-8">{m.away}</span>
                  <Fdr rating={m.awayFdr} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
