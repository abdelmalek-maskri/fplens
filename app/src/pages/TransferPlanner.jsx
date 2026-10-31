import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import TeamBadge from "../components/badges/TeamBadge";
import PlayerLink from "../components/ui/PlayerLink";
import { useTransfers } from "../hooks";
import { computeSuggestions, WILDCARD, SQUAD_SIZE } from "./transfers/suggestions";
import Loading from "../components/feedback/Loading";
import ErrorState from "../components/feedback/ErrorState";

export default function TransferPlanner() {
  const navigate = useNavigate();
  const { data: transferData, isLoading, error } = useTransfers();
  const [horizon, setHorizon] = useState(3);
  const [transfers, setTransfers] = useState([]);
  const [freeTransfers, setFreeTransfers] = useState(1);

  const myTeam = useMemo(() => transferData?.myTeam || [], [transferData]);
  const targets = useMemo(() => transferData?.targets || [], [transferData]);

  const bank = transferData?.bank ?? null;

  const budget = useMemo(() => {
    if (bank === null) return null;
    const savings = transfers.reduce((s, t) => {
      const out = myTeam.find((p) => p.element === t.out);
      const inP = targets.find((p) => p.element === t.in);
      return s + ((out?.selling_price || 0) - (inP?.value || 0));
    }, 0);
    return bank + savings;
  }, [bank, myTeam, targets, transfers]);

  // The dropdown uses 5 as the Wildcard sentinel. A Wildcard is unlimited
  // transfers with no points penalty, so treating it as "five free" would
  // charge a hit from the sixth move onwards.
  const isWildcard = freeTransfers >= WILDCARD;
  const hitCost = isWildcard ? 0 : Math.max(0, transfers.length - freeTransfers) * 4;

  const currentTeam = useMemo(() => {
    return myTeam.map((p) => {
      const transfer = transfers.find((t) => t.out === p.element);
      if (transfer) {
        const replacement = targets.find((t) => t.element === transfer.in);
        return replacement ? { ...replacement, isTransferIn: true } : p;
      }
      return p;
    });
  }, [myTeam, targets, transfers]);

  const teamTotal = useMemo(() => {
    return currentTeam.reduce(
      (sum, p) => sum + (p.predicted?.slice(0, horizon).reduce((s, v) => s + v, 0) || 0),
      0
    );
  }, [currentTeam, horizon]);

  const suggestions = useMemo(
    () =>
      computeSuggestions(
        myTeam,
        targets,
        horizon,
        isWildcard ? SQUAD_SIZE : freeTransfers,
        bank ?? 0
      ),
    [myTeam, targets, horizon, freeTransfers, isWildcard, bank]
  );

  const removeTransfer = (outId) => {
    setTransfers((prev) => prev.filter((t) => t.out !== outId));
  };

  const applySuggestion = (s) => {
    if (transfers.some((t) => t.out === s.out.element)) return;
    setTransfers((prev) => [...prev, { out: s.out.element, in: s.in.element }]);
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load transfer data." />;
  if (!transferData) return null;

  const noTeam = myTeam.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500">Plan ahead</span>
            <div className="flex items-center border border-surface-300/50 rounded overflow-hidden">
              {[
                { value: 1, label: "1 week" },
                { value: 2, label: "2 weeks" },
                { value: 3, label: "3 weeks" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setHorizon(value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    horizon === value
                      ? "bg-surface-800 text-surface-200"
                      : "text-surface-600 hover:text-surface-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500">Free transfers</span>
            <select
              value={freeTransfers}
              onChange={(e) => setFreeTransfers(Number(e.target.value))}
              className="bg-transparent border border-surface-300/50 rounded px-2 py-1.5 text-xs font-data text-surface-800 focus:border-brand-600 focus:outline-none cursor-pointer"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={5}>Wildcard</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {transfers.length > 0 && (
            <>
              <span className="text-surface-600">{transfers.length} made</span>
              {hitCost > 0 && <span className="text-danger-400 font-medium">-{hitCost} hit</span>}
              {budget !== null && (
                <span className="text-surface-600">£{budget.toFixed(1)}m in the bank</span>
              )}
              <span className="font-data font-bold text-brand-700">
                {(teamTotal - hitCost).toFixed(1)} pts
              </span>
              <button
                onClick={() => setTransfers([])}
                className="text-surface-500 hover:text-danger-400 transition-colors"
              >
                Reset
              </button>
            </>
          )}
          {transfers.length === 0 && !noTeam && (
            <span className="text-surface-600">
              Squad <span className="font-data text-surface-800">{teamTotal.toFixed(1)} pts</span>{" "}
              over {horizon} GW{horizon > 1 ? "s" : ""}
              {bank !== null && ` · £${bank.toFixed(1)}m in the bank`}
            </span>
          )}
        </div>
      </div>

      {noTeam && (
        <div className="py-20 max-w-md mx-auto text-center">
          <h2 className="text-lg font-bold text-surface-900">Load your squad first</h2>
          <p className="text-sm text-surface-600 mt-2">
            This page suggests transfers by comparing the players you own against every other
            player, over the next one to three gameweeks. It needs to know who you own.
          </p>
          <Link
            to="/my-team"
            className="inline-block mt-4 px-4 py-2 rounded bg-brand-700 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            Enter your FPL ID
          </Link>
          <p className="text-xs text-surface-500 mt-3">
            Any manager&apos;s ID works, not only your own.
          </p>
        </div>
      )}

      {suggestions.length > 0 && !noTeam && (
        <div className="border border-surface-300/50 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface-200/50">
            <span className="text-xs font-medium text-surface-700">
              Suggested, judged over the next {horizon} gameweek{horizon > 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-surface-200/40">
            {suggestions.map((s) => {
              const alreadyApplied = transfers.some((t) => t.out === s.out.element);
              return (
                <div
                  key={s.out.element}
                  className={`flex items-center gap-4 px-4 py-3 ${alreadyApplied ? "opacity-40" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase text-danger-400 font-medium">Sell</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TeamBadge team={s.out.team} size="sm" />
                      <PlayerLink
                        element={s.out.element}
                        className="text-sm text-surface-900 truncate"
                      >
                        {s.out.web_name}
                      </PlayerLink>
                      <span className="text-xs text-surface-500">{s.out.sum.toFixed(1)} pts</span>
                    </div>
                    <span className="text-[10px] text-surface-400 mt-0.5">{s.reason}</span>
                  </div>

                  <div className="text-center shrink-0">
                    <span className="text-xs text-surface-400">→</span>
                    <div className="text-xs font-semibold text-success-400 font-data">
                      +{s.points_gain.toFixed(1)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase text-success-400 font-medium">Buy</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TeamBadge team={s.in.team} size="sm" />
                      <span className="text-sm text-surface-900 truncate">{s.in.web_name}</span>
                      <span className="text-xs text-surface-500">
                        {s.in.sum.toFixed(1)} pts · £{s.in.value.toFixed(1)}m
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => applySuggestion(s)}
                    disabled={alreadyApplied}
                    className="link-action text-xs disabled:pointer-events-none shrink-0 px-2 py-1 border border-brand-600/30 rounded hover:bg-brand-600/5"
                  >
                    {alreadyApplied ? "Applied" : "Apply"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {suggestions.length === 0 && !noTeam && transfers.length === 0 && (
        <p className="text-sm text-surface-500">
          No transfer improves the squad with £{(bank ?? 0).toFixed(1)}m in the bank. Keep the free
          transfer.
        </p>
      )}

      {transfers.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-wider text-surface-500 font-medium">
            Applied
          </span>
          {transfers.map((t) => {
            const out = myTeam.find((p) => p.element === t.out);
            const inP = targets.find((p) => p.element === t.in);
            if (!out || !inP) return null;
            const outSum = out.predicted?.slice(0, horizon).reduce((s, v) => s + v, 0) || 0;
            const inSum = inP.predicted?.slice(0, horizon).reduce((s, v) => s + v, 0) || 0;
            const delta = inSum - outSum;
            return (
              <div
                key={t.out}
                className="flex items-center gap-3 px-3 py-2 border border-surface-300/50 rounded"
              >
                <TeamBadge team={out.team} size="sm" />
                <span className="text-sm text-danger-400 line-through">{out.web_name}</span>
                <span className="text-surface-400">→</span>
                <TeamBadge team={inP.team} size="sm" />
                <span className="text-sm text-success-400 font-medium">{inP.web_name}</span>
                <span
                  className={`text-xs font-data font-semibold ml-auto ${
                    delta > 0 ? "text-success-400" : "text-danger-400"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} pts
                </span>
                <button
                  onClick={() => removeTransfer(t.out)}
                  className="text-xs text-surface-400 hover:text-danger-400 transition-colors"
                >
                  Undo
                </button>
              </div>
            );
          })}
          {hitCost > 0 && (
            <div className="text-xs text-danger-400 px-3">
              -{hitCost} pts hit · Net gain:{" "}
              {(
                transfers.reduce((s, t) => {
                  const out = myTeam.find((p) => p.element === t.out);
                  const inP = targets.find((p) => p.element === t.in);
                  const outSum = out?.predicted?.slice(0, horizon).reduce((a, b) => a + b, 0) || 0;
                  const inSum = inP?.predicted?.slice(0, horizon).reduce((a, b) => a + b, 0) || 0;
                  return s + (inSum - outSum);
                }, 0) - hitCost
              ).toFixed(1)}{" "}
              pts
            </div>
          )}
        </div>
      )}
      {!noTeam && (
        <div>
          <span className="section-label">Your squad, as the planner sees it</span>
          <div className="mt-3 max-w-xl">
            <div className="grid grid-cols-[1fr_4rem_5rem_6rem] gap-3 py-1 text-2xs text-surface-500 uppercase tracking-wide">
              <span>Player</span>
              <span className="text-right">Price</span>
              <span className="text-right">Next GW</span>
              <span className="text-right">{horizon} GW total</span>
            </div>
            {currentTeam
              // "u" is a player who has left the club. Still in the squad and
              // still a sell candidate, but not worth a row here.
              .filter((p) => p.status !== "u")
              .sort((a, b) => {
                const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
                return (
                  order[a.position] - order[b.position] ||
                  b.predicted.slice(0, horizon).reduce((s, v) => s + v, 0) -
                    a.predicted.slice(0, horizon).reduce((s, v) => s + v, 0)
                );
              })
              .map((p) => {
                const sum = p.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
                return (
                  <div
                    key={p.element}
                    className={`grid grid-cols-[1fr_4rem_5rem_6rem] gap-3 items-center py-1.5 text-sm border-t border-surface-200/60 ${
                      p.isTransferIn ? "bg-brand-600/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamBadge team={p.team} size="sm" />
                      <button
                        onClick={() => navigate(`/player/${p.element}`)}
                        className="text-surface-900 hover:text-brand-700 transition-colors truncate"
                      >
                        {p.web_name}
                      </button>
                      <span className={`text-2xs ${POSITION_COLORS[p.position]}`}>
                        {p.position}
                      </span>
                      {p.status === "i" && (
                        <span className="text-2xs text-danger-400">injured</span>
                      )}
                      {p.status === "d" && (
                        <span className="text-2xs text-warning-400">doubtful</span>
                      )}
                      {p.isTransferIn && <span className="text-2xs text-brand-700">in</span>}
                    </div>
                    <span className="text-right text-surface-600 font-data tabular-nums">
                      £{p.value.toFixed(1)}m
                    </span>
                    <span className="text-right text-surface-700 font-data tabular-nums">
                      {(p.predicted[0] ?? 0).toFixed(1)}
                    </span>
                    <span className="text-right font-data tabular-nums font-medium text-surface-900">
                      {sum.toFixed(1)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
