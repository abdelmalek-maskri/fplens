import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { POSITION_COLORS, STATUS_CONFIG } from "../lib/constants";
import TeamBadge from "../components/badges/TeamBadge";
import ErrorState from "../components/feedback/ErrorState";
import EmptyState from "../components/feedback/EmptyState";
import Loading from "../components/feedback/Loading";
import { usePlayerPool } from "../hooks";
import PlayerSelector from "./compare/PlayerSelector";
import { defaultPair } from "./compare/defaultPair";

const price = (v) => `£${v.toFixed(1)}m`;

// One row of the table. `better` says which side to bold: "high", "low", or
// null for facts with no winner, like ownership.
const ROWS = [
  {
    label: "Predicted points",
    get: (p) => p.predicted_points,
    fmt: (v) => v.toFixed(1),
    better: "high",
  },
  { label: "Form", get: (p) => p.form, fmt: (v) => v.toFixed(1), better: "high" },
  { label: "Points this season", get: (p) => p.total_points, fmt: String, better: "high" },
  { label: "Price", get: (p) => p.value, fmt: price, better: "low" },
  {
    label: "Predicted pts per £m",
    get: (p) => p.predicted_points / p.value,
    fmt: (v) => v.toFixed(2),
    better: "high",
  },
  { label: "Minutes", get: (p) => p.minutes, fmt: (v) => v.toLocaleString(), better: "high" },
  { label: "Goals", get: (p) => p.goals, fmt: String, better: "high" },
  { label: "xG", get: (p) => p.xG, fmt: (v) => v.toFixed(2), better: "high" },
  { label: "Assists", get: (p) => p.assists, fmt: String, better: "high" },
  { label: "xA", get: (p) => p.xA, fmt: (v) => v.toFixed(2), better: "high" },
  { label: "Bonus", get: (p) => p.bonus, fmt: String, better: "high" },
  { label: "Owned by", get: (p) => p.selected_by_percent, fmt: (v) => `${v}%`, better: null },
];

function winner(row, a, b) {
  if (!row.better) return null;
  const va = row.get(a);
  const vb = row.get(b);
  if (va === vb) return null;
  const aWins = row.better === "high" ? va > vb : va < vb;
  return aWins ? "a" : "b";
}

function PlayerCard({ p, onOpen }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <TeamBadge team={p.team} size="lg" />
        <div>
          <button
            onClick={onOpen}
            className="text-lg font-bold text-surface-100 hover:text-brand-400 transition-colors"
          >
            {p.web_name}
          </button>
          <p className="text-sm text-surface-500">
            {p.name} · <span className={POSITION_COLORS[p.position]}>{p.position}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-brand-400 font-data tabular-nums leading-none">
          {p.predicted_points.toFixed(1)}
        </span>
        <span className="text-xs text-surface-500">predicted</span>
      </div>
      <p className="mt-2 text-sm text-surface-400">
        {price(p.value)} · vs {p.opponent_name}
      </p>
      <p className="mt-1 text-xs">
        <span className={STATUS_CONFIG[p.status]?.cls}>{STATUS_CONFIG[p.status]?.label}</span>
        <span className="text-surface-500"> · owned by {p.selected_by_percent}%</span>
      </p>
    </div>
  );
}

function Verdict({ a, b }) {
  if (a.predicted_points === b.predicted_points) {
    return (
      <p className="text-sm text-surface-300">
        Too close to call. Both are predicted {a.predicted_points.toFixed(1)}.
      </p>
    );
  }
  const [w, l] = a.predicted_points > b.predicted_points ? [a, b] : [b, a];

  const support = [];
  if (w.form > l.form) support.push(`better form, ${w.form} vs ${l.form}`);
  if (w.total_points > l.total_points)
    support.push(`more points this season, ${w.total_points} vs ${l.total_points}`);
  if (w.xG + w.xA > l.xG + l.xA)
    support.push(
      `more expected goals and assists, ${(w.xG + w.xA).toFixed(1)} vs ${(l.xG + l.xA).toFixed(1)}`
    );

  const edge = [];
  if (l.value < w.value) edge.push(`cheaper, ${price(l.value)} vs ${price(w.value)}`);
  if (l.form > w.form) edge.push(`better form, ${l.form} vs ${w.form}`);

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-surface-100">
        <span className="font-semibold">{w.web_name}</span> is the stronger pick,{" "}
        <span className="font-data tabular-nums">
          {w.predicted_points.toFixed(1)} vs {l.predicted_points.toFixed(1)}
        </span>{" "}
        predicted.
      </p>
      {support.length > 0 && (
        <p className="text-xs text-surface-400">Also {support.slice(0, 2).join(", and ")}.</p>
      )}
      {edge.length > 0 && (
        <p className="text-xs text-surface-500">
          {l.web_name} is {edge.join(", and ")}.
        </p>
      )}
    </div>
  );
}

export default function PlayerComparison() {
  const navigate = useNavigate();
  const { data: poolData, isLoading, error } = usePlayerPool();
  const [chosenA, setChosenA] = useState(null);
  const [chosenB, setChosenB] = useState(null);

  const players = poolData?.players;
  const [defaultA, defaultB] = useMemo(() => defaultPair(players ?? []), [players]);
  const allPlayers = players ?? [];

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load player data." />;
  if (!poolData) return null;

  const idA = chosenA ?? defaultA;
  const idB = chosenB ?? defaultB;
  const a = allPlayers.find((p) => p.id === idA);
  const b = allPlayers.find((p) => p.id === idB);

  const swap = () => {
    setChosenA(idB);
    setChosenB(idA);
  };

  return (
    <div className="space-y-8 stagger">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <PlayerSelector
          selected={idA}
          onChange={setChosenA}
          label="Player A"
          excludeId={idB}
          allPlayers={allPlayers}
        />
        <button
          onClick={swap}
          className="mb-1 p-2 rounded-md bg-surface-800 border border-surface-700 hover:border-brand-500 transition-colors"
          title="Swap players"
          aria-label="Swap players"
        >
          <svg
            className="w-5 h-5 text-surface-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
            />
          </svg>
        </button>
        <PlayerSelector
          selected={idB}
          onChange={setChosenB}
          label="Player B"
          excludeId={idA}
          allPlayers={allPlayers}
        />
      </div>

      {a && b ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PlayerCard p={a} onOpen={() => navigate(`/player/${a.id}`)} />
            <PlayerCard p={b} onOpen={() => navigate(`/player/${b.id}`)} />
          </div>

          <div className="border-y border-surface-800 py-4">
            <Verdict a={a} b={b} />
          </div>

          <div className="max-w-xl">
            <div className="grid grid-cols-[1fr_6rem_6rem] items-center py-1 text-xs text-surface-500">
              <span />
              <span className="text-right font-semibold text-surface-300">{a.web_name}</span>
              <span className="text-right font-semibold text-surface-300">{b.web_name}</span>
            </div>
            {ROWS.map((row) => {
              const w = winner(row, a, b);
              const cell = (p, side) =>
                `text-right font-data tabular-nums ${
                  w === side
                    ? "text-brand-400 font-bold"
                    : w
                      ? "text-surface-500"
                      : "text-surface-200"
                }`;
              return (
                <div
                  key={row.label}
                  className="grid grid-cols-[1fr_6rem_6rem] items-center py-1.5 text-sm border-t border-surface-800/60"
                >
                  <span className="text-surface-400">{row.label}</span>
                  <span className={cell(a, "a")}>{row.fmt(row.get(a))}</span>
                  <span className={cell(b, "b")}>{row.fmt(row.get(b))}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          title="No players selected"
          message="Select two players above to compare them."
        />
      )}
    </div>
  );
}
