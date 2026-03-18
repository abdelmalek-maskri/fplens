import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TeamBadge from "../components/badges/TeamBadge";
import { useTransfers } from "../hooks";
import Loading from "../components/feedback/Loading";
import ErrorState from "../components/feedback/ErrorState";

function computeSuggestions(squad, targets, horizon, maxTransfers = 1) {
  const suggestions = [];
  const candidates = squad
    .map((p) => {
      const sum = p.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
      const avgFdr = p.fdr.slice(0, horizon).reduce((s, v) => s + v, 0) / horizon;
      let reason = null;
      if (p.status === "i") reason = "Injured";
      else if (p.status === "d") reason = "Doubtful";
      else if (sum / horizon < 3.0 && avgFdr >= 3) reason = "Low pts + tough run";
      else if (sum / horizon < 2.5) reason = "Low predicted";
      return { ...p, sum, avgFdr, reason };
    })
    .filter((p) => p.reason)
    .sort((a, b) => a.sum - b.sum);

  for (const out of candidates) {
    const squadIds = new Set(squad.map((p) => p.element));
    const usedIds = new Set(suggestions.map((s) => s.in.element));
    const options = targets
      .filter(
        (t) =>
          t.position === out.position &&
          t.value <= out.selling_price + 2.3 &&
          !squadIds.has(t.element) &&
          !usedIds.has(t.element)
      )
      .map((t) => ({
        ...t,
        sum: t.predicted.slice(0, horizon).reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.sum - a.sum);

    if (options.length > 0) {
      suggestions.push({
        out,
        in: options[0],
        points_gain: options[0].sum - out.sum,
        reason: out.reason,
      });
    }
  }
  return suggestions.slice(0, maxTransfers);
}

export default function TransferPlanner() {
  const navigate = useNavigate();
  const { data: transferData, isLoading, error } = useTransfers();
  const [horizon, setHorizon] = useState(3);
  const [transfers, setTransfers] = useState([]);
  const [freeTransfers, setFreeTransfers] = useState(1);

  const myTeam = transferData?.myTeam || [];
  const targets = transferData?.targets || [];

  const bankBalance = 2.3;

  const budget = useMemo(() => {
    const savings = transfers.reduce((s, t) => {
      const out = myTeam.find((p) => p.element === t.out);
      const inP = targets.find((p) => p.element === t.in);
      return s + ((out?.selling_price || 0) - (inP?.value || 0));
    }, 0);
    return bankBalance + savings;
  }, [myTeam, targets, transfers]);

  const hitCost = Math.max(0, transfers.length - freeTransfers) * 4;

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
    () => computeSuggestions(myTeam, targets, horizon, freeTransfers >= 5 ? 15 : freeTransfers),
    [myTeam, targets, horizon, freeTransfers]
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
            <div className="flex items-center border border-surface-700/50 rounded overflow-hidden">
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
                      ? "bg-surface-200 text-surface-800"
                      : "text-surface-400 hover:text-surface-200"
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
              className="bg-transparent border border-surface-700/50 rounded px-2 py-1.5 text-xs font-data text-surface-200 focus:border-brand-500 focus:outline-none cursor-pointer"
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
              <span className="text-surface-400">{transfers.length} made</span>
              {hitCost > 0 && <span className="text-danger-400 font-medium">-{hitCost} hit</span>}
              <span className="text-surface-400">£{budget.toFixed(1)}m ITB</span>
              <span className="font-data font-bold text-brand-400">
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
          {transfers.length === 0 && (
            <span className="font-data text-surface-300">
              {teamTotal.toFixed(1)} pts ({horizon} GW)
            </span>
          )}
        </div>
      </div>

      {noTeam && (
        <div className="py-12 text-center">
          <p className="text-surface-400 text-sm">
            Enter your FPL ID on the{" "}
            <span
              className="text-brand-400 cursor-pointer hover:underline"
              onClick={() => navigate("/my-team")}
            >
              My Team
            </span>{" "}
            page to plan transfers.
          </p>
        </div>
      )}

      {suggestions.length > 0 && !noTeam && (
        <div className="border border-surface-700/50 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface-800/50">
            <span className="text-xs font-medium text-surface-300">
              ML Suggested Transfers ({horizon} GW horizon)
            </span>
          </div>
          <div className="divide-y divide-surface-800/40">
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
                      <span
                        className="text-sm text-surface-100 cursor-pointer hover:text-brand-400 transition-colors truncate"
                        onClick={() => navigate(`/player/${s.out.element}`)}
                      >
                        {s.out.web_name}
                      </span>
                      <span className="text-xs text-surface-500">{s.out.sum.toFixed(1)} pts</span>
                    </div>
                    <span className="text-[10px] text-surface-600 mt-0.5">{s.reason}</span>
                  </div>

                  <div className="text-center shrink-0">
                    <span className="text-xs text-surface-600">→</span>
                    <div className="text-xs font-semibold text-success-400 font-data">
                      +{s.points_gain.toFixed(1)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase text-success-400 font-medium">Buy</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TeamBadge team={s.in.team} size="sm" />
                      <span className="text-sm text-surface-100 truncate">{s.in.web_name}</span>
                      <span className="text-xs text-surface-500">
                        {s.in.sum.toFixed(1)} pts · £{s.in.value}m
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => applySuggestion(s)}
                    disabled={alreadyApplied}
                    className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors disabled:pointer-events-none shrink-0 px-2 py-1 border border-brand-500/30 rounded hover:bg-brand-500/5"
                  >
                    {alreadyApplied ? "Applied" : "Apply"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
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
                className="flex items-center gap-3 px-3 py-2 border border-surface-700/50 rounded"
              >
                <TeamBadge team={out.team} size="sm" />
                <span className="text-sm text-danger-400 line-through">{out.web_name}</span>
                <span className="text-surface-600">→</span>
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
                  className="text-xs text-surface-600 hover:text-danger-400 transition-colors"
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
    </div>
  );
}
