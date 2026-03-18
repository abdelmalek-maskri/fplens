import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FDR_COLORS, POSITION_COLORS, STATUS_CONFIG } from "../lib/constants";
import TeamBadge from "../components/badges/TeamBadge";
import TabBar from "../components/ui/TabBar";
import RadarChart from "../components/charts/RadarChart";
import ErrorState from "../components/feedback/ErrorState";
import EmptyState from "../components/feedback/EmptyState";
import Loading from "../components/feedback/Loading";
import { usePlayerPool } from "../hooks";
import PlayerSelector from "./compare/PlayerSelector";
import ComparisonBar from "./compare/ComparisonBar";

export default function PlayerComparison() {
  const navigate = useNavigate();
  const { data: poolData, isLoading, error } = usePlayerPool();
  const [playerA, setPlayerA] = useState(2); // Haaland default
  const [playerB, setPlayerB] = useState(50); // Isak default
  const [viewMode, setViewMode] = useState("bars");

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load player data." />;
  if (!poolData) return null;
  const allPlayers = poolData.players;

  const a = allPlayers.find((p) => p.id === playerA);
  const b = allPlayers.find((p) => p.id === playerB);

  // Quick swap
  const handleSwap = () => {
    setPlayerA(playerB);
    setPlayerB(playerA);
  };

  // Value metrics (points per million)
  const valA = a ? (a.predicted_points / a.value).toFixed(2) : 0;
  const valB = b ? (b.predicted_points / b.value).toFixed(2) : 0;

  // Determine winner count
  const metrics =
    a && b
      ? [
          {
            better:
              a.predicted_points > b.predicted_points
                ? "a"
                : a.predicted_points < b.predicted_points
                  ? "b"
                  : "tie",
          },
          { better: a.form > b.form ? "a" : a.form < b.form ? "b" : "tie" },
          {
            better:
              a.total_points > b.total_points ? "a" : a.total_points < b.total_points ? "b" : "tie",
          },
          {
            better:
              parseFloat(valA) > parseFloat(valB)
                ? "a"
                : parseFloat(valA) < parseFloat(valB)
                  ? "b"
                  : "tie",
          },
          {
            better:
              a.opponent_fdr < b.opponent_fdr ? "a" : a.opponent_fdr > b.opponent_fdr ? "b" : "tie",
          },
          { better: a.xG > b.xG ? "a" : a.xG < b.xG ? "b" : "tie" },
          { better: a.xA > b.xA ? "a" : a.xA < b.xA ? "b" : "tie" },
        ]
      : [];

  const winsA = metrics.filter((m) => m.better === "a").length;
  const winsB = metrics.filter((m) => m.better === "b").length;

  return (
    <div className="space-y-6 stagger">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <PlayerSelector
          selected={playerA}
          onChange={setPlayerA}
          label="Player A"
          excludeId={playerB}
          allPlayers={allPlayers}
        />
        <button
          onClick={handleSwap}
          className="mb-1 p-2 rounded-md bg-surface-800 border border-surface-700 hover:border-brand-500 transition-colors"
          title="Swap players"
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
          selected={playerB}
          onChange={setPlayerB}
          label="Player B"
          excludeId={playerA}
          allPlayers={allPlayers}
        />
      </div>

      {a && b ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[a, b].map((p, idx) => {
              const isWinner = idx === 0 ? winsA > winsB : winsB > winsA;
              return (
                <div key={p.id} className={`${isWinner ? "ring-1 ring-brand-500/50" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <TeamBadge team={p.team} size="lg" />
                      <div>
                        <p
                          className="text-lg font-bold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                          onClick={() => navigate(`/player/${p.id}`)}
                        >
                          {p.web_name}
                        </p>
                        <p className="text-sm text-surface-500">
                          {p.name} ·{" "}
                          <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                        </p>
                      </div>
                    </div>
                    {isWinner && (
                      <span className="badge bg-brand-500/20 text-brand-400">Favoured</span>
                    )}
                  </div>

                  <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
                    <div>
                      <span className="text-xl font-bold text-surface-100">
                        {p.predicted_points.toFixed(1)}
                      </span>
                      <span className="text-xs text-surface-500 ml-1.5">predicted</span>
                    </div>
                    <div className="w-px h-5 bg-surface-700" />
                    <div>
                      <span className="text-xl font-bold text-surface-100">£{p.value}m</span>
                      <span className="text-xs text-surface-500 ml-1.5">price</span>
                    </div>
                    <div className="w-px h-5 bg-surface-700" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold text-surface-100">{p.opponent}</span>
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${
                          FDR_COLORS[p.opponent_fdr]?.bg
                        } ${FDR_COLORS[p.opponent_fdr]?.text}`}
                      >
                        {p.opponent_fdr}
                      </span>
                      <span className="text-xs text-surface-500 ml-0.5">fixture</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className={`text-xs font-medium ${STATUS_CONFIG[p.status]?.cls}`}>
                      {STATUS_CONFIG[p.status]?.label}
                    </span>
                    <span className="text-xs text-surface-600">·</span>
                    <span className="text-xs text-surface-500">
                      Owned by {p.selected_by_percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-b border-surface-800 py-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${winsA > winsB ? "bg-brand-500" : winsB > winsA ? "bg-brand-500" : "bg-surface-500"}`}
              />
              <div>
                <p className="text-sm font-semibold text-surface-100">
                  {winsA > winsB
                    ? `${a.web_name} wins ${winsA} of 7 key metrics`
                    : winsB > winsA
                      ? `${b.web_name} wins ${winsB} of 7 key metrics`
                      : "Dead heat across key metrics"}
                </p>
                <p className="text-xs text-surface-500 mt-0.5">
                  Based on predicted points, form, season total, value, fixture difficulty, xG, and
                  xA
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className={winsA >= winsB ? "text-brand-400" : "text-surface-500"}>
                {winsA}
              </span>
              <span className="text-surface-600">–</span>
              <span className={winsB >= winsA ? "text-brand-400" : "text-surface-500"}>
                {winsB}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between border-b border-surface-800 mb-4">
              <TabBar
                tabs={[
                  { id: "bars", label: "Stats" },
                  { id: "radar", label: "Radar" },
                ]}
                active={viewMode}
                onChange={setViewMode}
                id="compare-view"
              />
            </div>

            {viewMode === "bars" ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-surface-300">{a.web_name}</span>
                  <span className="text-sm font-semibold text-surface-300">{b.web_name}</span>
                </div>

                <ComparisonBar
                  label="Predicted Points"
                  valueA={a.predicted_points}
                  valueB={b.predicted_points}
                />
                <ComparisonBar label="Form" valueA={a.form} valueB={b.form} />
                <ComparisonBar
                  label="Total Points"
                  valueA={a.total_points}
                  valueB={b.total_points}
                />
                <ComparisonBar
                  label="Price"
                  valueA={a.value}
                  valueB={b.value}
                  format="price"
                  higherIsBetter={false}
                />
                <ComparisonBar
                  label="Pts / £m"
                  valueA={parseFloat(valA)}
                  valueB={parseFloat(valB)}
                />
                <ComparisonBar
                  label="Ownership"
                  valueA={a.selected_by_percent}
                  valueB={b.selected_by_percent}
                  format="pct"
                />
                <ComparisonBar label="xG" valueA={a.xG} valueB={b.xG} />
                <ComparisonBar label="xA" valueA={a.xA} valueB={b.xA} />
                <ComparisonBar label="Goals" valueA={a.goals} valueB={b.goals} format="int" />
                <ComparisonBar label="Assists" valueA={a.assists} valueB={b.assists} format="int" />
                <ComparisonBar label="Bonus" valueA={a.bonus} valueB={b.bonus} format="int" />
                <ComparisonBar label="ICT Index" valueA={a.ict_index} valueB={b.ict_index} />
                <ComparisonBar label="Minutes" valueA={a.minutes} valueB={b.minutes} format="int" />
                <ComparisonBar
                  label="Fixture Difficulty"
                  valueA={a.opponent_fdr}
                  valueB={b.opponent_fdr}
                  higherIsBetter={false}
                />
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <RadarChart playerA={a} playerB={b} allPlayers={allPlayers} />
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: "rgb(var(--brand-400))" }}
                    />
                    <span className="text-sm text-surface-300">{a.web_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: "rgb(var(--info-400))" }}
                    />
                    <span className="text-sm text-surface-300">{b.web_name}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {(() => {
            const winner = a.predicted_points > b.predicted_points ? a : b;
            const loser = winner === a ? b : a;

            // Build reasons
            const reasons = [];
            if (winner.predicted_points > loser.predicted_points)
              reasons.push(
                `Higher predicted: ${winner.predicted_points.toFixed(1)} vs ${loser.predicted_points.toFixed(1)} pts`
              );
            if (winner.form > loser.form)
              reasons.push(`Better form: ${winner.form} vs ${loser.form}`);
            if (winner.total_points > loser.total_points)
              reasons.push(`More season points: ${winner.total_points} vs ${loser.total_points}`);
            if (winner.value < loser.value)
              reasons.push(`Cheaper: £${winner.value}m vs £${loser.value}m`);
            if (winner.total_points / winner.value > loser.total_points / loser.value)
              reasons.push(
                `Better value: ${(winner.total_points / winner.value).toFixed(1)} vs ${(loser.total_points / loser.value).toFixed(1)} pts/£m`
              );

            // Build caveats for the loser
            const caveats = [];
            if (loser.form > winner.form)
              caveats.push(`Better recent form (${loser.form} vs ${winner.form})`);
            if (loser.value < winner.value)
              caveats.push(`Cheaper (£${loser.value}m vs £${winner.value}m)`);
            if (loser.goals - loser.xG > winner.goals - winner.xG)
              caveats.push("Outperforming xG more");

            return (
              <div className="border-t border-surface-800 pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-400" />
                  <span className="text-sm text-surface-100">
                    <span className="font-semibold">{winner.web_name}</span> is the stronger pick
                  </span>
                </div>
                {reasons.length > 0 && (
                  <div className="pl-4 space-y-1">
                    {reasons.slice(0, 3).map((r, i) => (
                      <p key={i} className="text-xs text-surface-400">
                        · {r}
                      </p>
                    ))}
                  </div>
                )}
                {caveats.length > 0 && (
                  <div className="pl-4">
                    <p className="text-xs text-surface-500">
                      {loser.web_name} edge: {caveats.join(", ").toLowerCase()}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
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
