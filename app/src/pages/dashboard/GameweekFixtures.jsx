import { useMemo } from "react";
import { FDR_COLORS } from "../../lib/constants";
import TeamBadge from "../../components/badges/TeamBadge";

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
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : "Date to be confirmed";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  return [...groups.entries()];
}

function kickoffTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function Fdr({ rating, team }) {
  const colors = FDR_COLORS[rating] || FDR_COLORS[3];
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-bold shrink-0 ${colors.bg} ${colors.text}`}
    >
      <span className="sr-only">{`${team} fixture difficulty `}</span>
      {rating}
    </span>
  );
}

function Match({ match }) {
  const time = kickoffTime(match.kickoff);

  return (
    <div className="flex items-center gap-2 py-2 border-b border-surface-100">
      <div className="flex-1 flex items-center justify-end gap-2">
        <Fdr rating={match.homeFdr} team={match.home} />
        <TeamBadge team={match.home} size="sm" />
      </div>

      <span className="w-14 shrink-0 text-center text-2xs font-data tabular-nums text-surface-600 bg-surface-200 rounded py-1">
        {time || "v"}
      </span>

      <div className="flex-1 flex items-center gap-2">
        <TeamBadge team={match.away} size="sm" />
        <Fdr rating={match.awayFdr} team={match.away} />
      </div>
    </div>
  );
}

// Sits above a paginated table, so days stack but their matches run two or
// three abreast: ten matches stay inside four rows rather than ten.
export default function GameweekFixtures({ fixtureData }) {
  const days = useMemo(() => groupByDay(buildMatches(fixtureData)), [fixtureData]);

  if (!days.length) return null;

  return (
    <section className="border border-surface-200 rounded-lg overflow-hidden">
      {days.map(([day, matches]) => (
        <div key={day}>
          <h3 className="bg-surface-200 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-surface-700">
            {day}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-x-8 px-3">
            {matches.map((m) => (
              <Match key={`${m.home}-${m.away}`} match={m} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
