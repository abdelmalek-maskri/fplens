import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FDR_COLORS, POSITION_COLORS } from "../lib/constants";
import MiniSparkline from "../components/MiniSparkline";
import TeamBadge from "../components/TeamBadge";
import StatusBadge from "../components/StatusBadge";
import { useTransfers } from "../hooks";
import { SkeletonStatStrip, SkeletonTable } from "../components/skeletons";
import ErrorState from "../components/ErrorState";

// ============================================================
// SUGGESTED TRANSFERS — model-driven recommendations
// Pairs each "problem" player with the best available replacement
// ============================================================
function computeSuggestions(squad, targets, horizon) {
  const suggestions = [];

  // Find starters worth selling: injured, doubtful, low predicted, or tough fixtures
  const candidates = squad
    .map((p) => {
      const sum = p.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
      const avgFdr = p.fdr.slice(0, horizon).reduce((s, v) => s + v, 0) / horizon;
      let reason = null;
      if (p.status === "i") reason = "Injured";
      else if (p.status === "d") reason = "Doubtful";
      else if (sum / horizon < 3.0 && avgFdr >= 3) reason = "Low predicted + tough fixtures";
      else if (sum / horizon < 2.5) reason = "Low predicted";
      return { ...p, sum, avgFdr, reason };
    })
    .filter((p) => p.reason)
    .sort((a, b) => a.sum - b.sum);

  for (const out of candidates) {
    // Find best replacement: same position, affordable, not already in squad
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
      const best = options[0];
      suggestions.push({
        out,
        in: best,
        points_gain: best.sum - out.sum,
        cost_saving: out.selling_price - best.value,
        reason: out.reason,
      });
    }
  }

  return suggestions;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function TransferPlanner() {
  const navigate = useNavigate();
  const { data: transferData, isLoading, error } = useTransfers();
  const [horizon, setHorizon] = useState(3);
  const [transfers, setTransfers] = useState([]);
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [showTargets, setShowTargets] = useState(false);
  const [transferOutId, setTransferOutId] = useState(null);
  const [posFilter, setPosFilter] = useState("ALL");

  const mockMyTeam = transferData ? transferData.myTeam : [];
  const mockTransferTargets = transferData ? transferData.targets : [];
  const GW_LABELS = transferData ? transferData.gwLabels : [];

  const bankBalance = 2.3; // ITB from MyTeam

  const budget = useMemo(() => {
    const transferSavings = transfers.reduce((s, t) => {
      const out = mockMyTeam.find((p) => p.element === t.out);
      const inP = mockTransferTargets.find((p) => p.element === t.in);
      return s + ((out?.selling_price || 0) - (inP?.value || 0));
    }, 0);
    return (bankBalance + transferSavings).toFixed(1);
  }, [mockMyTeam, mockTransferTargets, transfers]);

  const hitCost = Math.max(0, transfers.length - freeTransfers) * 4;

  const currentTeam = useMemo(() => {
    return mockMyTeam.map((p) => {
      const transfer = transfers.find((t) => t.out === p.element);
      if (transfer) {
        const replacement = mockTransferTargets.find((t) => t.element === transfer.in);
        return { ...replacement, isTransferIn: true };
      }
      return p;
    });
  }, [mockMyTeam, mockTransferTargets, transfers]);

  const teamPredicted = useMemo(() => {
    return GW_LABELS.slice(0, horizon).map((_, gwIdx) => {
      return currentTeam.reduce((sum, p) => sum + (p.predicted[gwIdx] || 0), 0);
    });
  }, [GW_LABELS, currentTeam, horizon]);

  const totalPredicted = teamPredicted.reduce((s, v) => s + v, 0) - hitCost;

  const suggestions = useMemo(
    () => computeSuggestions(mockMyTeam, mockTransferTargets, horizon),
    [mockMyTeam, mockTransferTargets, horizon]
  );

  if (isLoading)
    return (
      <div className="space-y-6">
        <SkeletonStatStrip items={6} />
        <SkeletonTable rows={15} cols={7} />
      </div>
    );

  if (error) return <ErrorState message="Failed to load transfer data." />;

  if (!transferData) return null;

  const handleTransferOut = (elementId) => {
    setTransferOutId(elementId);
    setPosFilter("ALL");
    setShowTargets(true);
  };

  const handleTransferIn = (targetId) => {
    setTransfers((prev) => [...prev, { out: transferOutId, in: targetId }]);
    setShowTargets(false);
    setTransferOutId(null);
  };

  const applySuggestion = (suggestion) => {
    if (transfers.some((t) => t.out === suggestion.out.element)) return;
    setTransfers((prev) => [...prev, { out: suggestion.out.element, in: suggestion.in.element }]);
  };

  const removeTransfer = (outId) => {
    setTransfers((prev) => prev.filter((t) => t.out !== outId));
  };

  const resetAll = () => {
    setTransfers([]);
    setShowTargets(false);
    setTransferOutId(null);
  };

  const outPlayer = transferOutId ? mockMyTeam.find((p) => p.element === transferOutId) : null;

  const availableTargets = mockTransferTargets
    .filter(
      (t) =>
        !transfers.some((tr) => tr.in === t.element) &&
        (outPlayer ? t.position === outPlayer.position : true) &&
        (posFilter === "ALL" || t.position === posFilter)
    )
    .map((t) => ({
      ...t,
      sum: t.predicted.slice(0, horizon).reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.sum - a.sum);

  const filteredTeam = currentTeam.filter((p) => posFilter === "ALL" || p.position === posFilter);

  return (
    <div className="space-y-6 stagger">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500">Horizon</span>
          {[1, 2, 3].map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
                horizon === h
                  ? "bg-surface-700 text-surface-100"
                  : "text-surface-500 hover:text-surface-300"
              }`}
            >
              {h} GW{h > 1 ? "s" : ""}
            </button>
          ))}
        </div>
        <button onClick={resetAll} className="btn-ghost text-xs">
          Reset
        </button>
      </div>

      {/* Summary Strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500">FTs</span>
          <select
            value={freeTransfers}
            onChange={(e) => setFreeTransfers(Number(e.target.value))}
            className="bg-surface-900 border border-surface-700 rounded px-2 py-1 text-lg font-bold text-surface-100 font-data focus:border-brand-500 focus:outline-none cursor-pointer"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={5}>WC</option>
          </select>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            {transfers.length}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">made</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span
            className={`text-lg font-bold font-data tabular-nums ${
              hitCost > 0 ? "text-danger-400" : "text-success-400"
            }`}
          >
            {hitCost > 0 ? `-${hitCost}` : "0"}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">hit</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span
            className={`text-lg font-bold font-data tabular-nums ${
              Number(budget) >= 0 ? "text-surface-100" : "text-danger-400"
            }`}
          >
            £{budget}m
          </span>
          <span className="text-xs text-surface-500 ml-1.5">ITB</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-brand-400 font-data tabular-nums">
            {totalPredicted.toFixed(1)}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">net pts ({horizon} GW)</span>
          {hitCost > 0 && <span className="text-2xs text-surface-500 ml-1">after hit</span>}
        </div>
      </div>

      {/* Suggested Transfers */}
      {suggestions.length > 0 && transfers.length === 0 && (
        <div className="space-y-2">
          <span className="section-label">Suggested transfers</span>
          {suggestions.map((s) => {
            const alreadyApplied = transfers.some((t) => t.out === s.out.element);
            return (
              <div
                key={s.out.element}
                className="flex items-center gap-4 p-3 bg-surface-800/50 border border-surface-700 rounded-md"
              >
                {/* Out */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-2xs text-danger-400 font-medium uppercase">Sell</span>
                    <span className="text-2xs text-surface-600">{s.reason}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TeamBadge team={s.out.team} size="sm" />
                    <span
                      className="text-sm font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer truncate"
                      onClick={() => navigate(`/player/${s.out.element}`)}
                    >
                      {s.out.web_name}
                    </span>
                    <span className="text-xs text-surface-500 shrink-0">
                      {s.out.sum.toFixed(1)} pts
                    </span>
                  </div>
                </div>

                {/* Arrow + gain */}
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <svg
                    className="w-4 h-4 text-brand-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                  <span className="text-xs font-semibold text-success-400">
                    +{s.points_gain.toFixed(1)}
                  </span>
                </div>

                {/* In */}
                <div className="flex-1 min-w-0">
                  <span className="text-2xs text-success-400 font-medium uppercase">Buy</span>
                  <div className="flex items-center gap-2">
                    <TeamBadge team={s.in.team} size="sm" />
                    <span className="text-sm font-medium text-surface-100 truncate">
                      {s.in.web_name}
                    </span>
                    <span className="text-xs text-surface-500 shrink-0">
                      {s.in.sum.toFixed(1)} pts · £{s.in.value}m
                    </span>
                  </div>
                </div>

                {/* Apply */}
                <button
                  onClick={() => applySuggestion(s)}
                  disabled={alreadyApplied}
                  className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0"
                >
                  Apply
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* GW Prediction Breakdown */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-surface-500">Predicted by GW:</span>
        {teamPredicted.map((pts, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-surface-400">{GW_LABELS[i]}</span>
            <span className="text-sm font-bold text-surface-100 font-data tabular-nums">
              {pts.toFixed(1)}
            </span>
          </div>
        ))}
        {hitCost > 0 && <span className="text-xs text-danger-400 ml-auto">Hit: -{hitCost}</span>}
      </div>

      {/* Position filter */}
      {!showTargets && (
        <div className="flex gap-1">
          {["ALL", "GK", "DEF", "MID", "FWD"].map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                posFilter === pos
                  ? "bg-surface-700 text-surface-100"
                  : "text-surface-500 hover:text-surface-300"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      )}

      {/* Team Table */}
      {!showTargets && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Player
                </th>
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Price
                </th>
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Form
                </th>
                {GW_LABELS.slice(0, horizon).map((gw) => (
                  <th key={gw} scope="col" className="table-header text-center py-2.5 px-3">
                    {gw}
                  </th>
                ))}
                <th scope="col" className="table-header text-center py-2.5 px-3">
                  Total
                </th>
                <th scope="col" className="table-header text-center py-2.5 px-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTeam.map((p) => {
                const sum = p.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
                const isNew = p.isTransferIn;
                const isTransferred = transfers.some((t) => t.out === p.element);
                return (
                  <tr
                    key={p.element}
                    className={`border-t border-surface-800/60 hover:bg-surface-800/40 transition-colors ${
                      isNew ? "bg-success-500/5" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        {isNew && <div className="w-1 h-8 rounded-full bg-success-400" />}
                        <TeamBadge team={p.team} />
                        <div>
                          <p
                            className={`text-sm font-medium cursor-pointer transition-colors ${
                              isNew
                                ? "text-success-400 hover:text-success-300"
                                : "text-surface-100 hover:text-brand-400"
                            }`}
                            onClick={() => navigate(`/player/${p.element}`)}
                          >
                            {p.web_name}
                          </p>
                          <p className="text-xs text-surface-500">
                            <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                            {" · "}
                            {p.team}
                            {p.status && p.status !== "a" && (
                              <span className="ml-1">
                                <StatusBadge status={p.status} chance={0} compact />
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-surface-100 font-data tabular-nums">
                      £{p.value}m
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-surface-300 font-data tabular-nums">{p.form}</span>
                        <MiniSparkline pts={p.pts_last5} />
                      </div>
                    </td>
                    {p.predicted.slice(0, horizon).map((pts, gwIdx) => (
                      <td key={gwIdx} className="py-2.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`text-sm font-bold font-data tabular-nums ${
                              pts >= 5
                                ? "text-brand-400"
                                : pts >= 3
                                  ? "text-surface-100"
                                  : "text-surface-500"
                            }`}
                          >
                            {pts.toFixed(1)}
                          </span>
                          <span
                            className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-bold ${
                              FDR_COLORS[p.fdr[gwIdx]].bg
                            } ${FDR_COLORS[p.fdr[gwIdx]].text}`}
                          >
                            {p.fdr[gwIdx]}
                          </span>
                        </div>
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-sm font-bold text-surface-100 font-data tabular-nums">
                        {sum.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isNew ? (
                        <button
                          onClick={() =>
                            removeTransfer(transfers.find((t) => t.in === p.element)?.out)
                          }
                          className="text-xs text-danger-400 hover:text-danger-300 transition-colors"
                        >
                          Undo
                        </button>
                      ) : !isTransferred ? (
                        <button
                          onClick={() => handleTransferOut(p.element)}
                          className="text-xs text-surface-400 hover:text-warning-400 transition-colors"
                        >
                          Sell
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer Target Selector */}
      {showTargets && outPlayer && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-surface-100">
                Replace <span className="font-semibold">{outPlayer.web_name}</span>
              </span>
              <span className="text-xs text-surface-500">
                £{(Number(budget) + outPlayer.selling_price).toFixed(1)}m available
              </span>
            </div>
            <button
              onClick={() => {
                setShowTargets(false);
                setTransferOutId(null);
              }}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
          </div>

          {/* Target table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th scope="col" className="table-header text-left py-2.5 px-3">
                    Player
                  </th>
                  <th scope="col" className="table-header text-left py-2.5 px-3">
                    Price
                  </th>
                  <th scope="col" className="table-header text-left py-2.5 px-3">
                    Form
                  </th>
                  {GW_LABELS.slice(0, horizon).map((gw) => (
                    <th key={gw} className="table-header text-center py-2.5 px-3">
                      {gw}
                    </th>
                  ))}
                  <th scope="col" className="table-header text-center py-2.5 px-3">
                    Total
                  </th>
                  <th scope="col" className="table-header text-center py-2.5 px-3">
                    vs {outPlayer.web_name}
                  </th>
                  <th scope="col" className="table-header text-center py-2.5 px-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {availableTargets.map((t) => {
                  const outSum = outPlayer.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
                  const gain = t.sum - outSum;
                  const affordable = t.value <= Number(budget) + outPlayer.selling_price;
                  return (
                    <tr
                      key={t.element}
                      className={`border-t border-surface-800/60 transition-colors ${
                        affordable ? "hover:bg-surface-800/40 cursor-pointer" : "opacity-40"
                      }`}
                      onClick={() => affordable && handleTransferIn(t.element)}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <TeamBadge team={t.team} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-surface-100">{t.web_name}</p>
                              {t.price_trend === "rise" && (
                                <span className="text-2xs text-success-400">↑</span>
                              )}
                            </div>
                            <p className="text-xs text-surface-500">
                              <span className={POSITION_COLORS[t.position]}>{t.position}</span>
                              {" · "}
                              {t.team}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-surface-100 font-data tabular-nums">
                        £{t.value}m
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-surface-300 font-data tabular-nums">{t.form}</span>
                          <MiniSparkline pts={t.pts_last5} />
                        </div>
                      </td>
                      {t.predicted.slice(0, horizon).map((pts, gwIdx) => (
                        <td key={gwIdx} className="py-2.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`text-sm font-bold font-data tabular-nums ${
                                pts >= 5
                                  ? "text-brand-400"
                                  : pts >= 3
                                    ? "text-surface-100"
                                    : "text-surface-500"
                              }`}
                            >
                              {pts.toFixed(1)}
                            </span>
                            <span
                              className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-bold ${
                                FDR_COLORS[t.fdr[gwIdx]].bg
                              } ${FDR_COLORS[t.fdr[gwIdx]].text}`}
                            >
                              {t.fdr[gwIdx]}
                            </span>
                          </div>
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-sm font-bold text-surface-100 font-data tabular-nums">
                          {t.sum.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-xs font-semibold font-data tabular-nums ${
                            gain > 0 ? "text-success-400" : "text-danger-400"
                          }`}
                        >
                          {gain > 0 ? "+" : ""}
                          {gain.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {affordable ? (
                          <span className="text-xs text-brand-400">Select</span>
                        ) : (
                          <span className="text-2xs text-surface-600">Over budget</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transfer Impact Summary */}
      {transfers.length > 0 && (
        <div className="border-t border-surface-800 pt-4">
          <span className="section-label">Transfer summary</span>
          <div className="space-y-2 mt-3">
            {transfers.map((t) => {
              const out = mockMyTeam.find((p) => p.element === t.out);
              const inP = mockTransferTargets.find((p) => p.element === t.in);
              if (!out || !inP) return null;
              const outSum = out.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
              const inSum = inP.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
              const delta = inSum - outSum;
              return (
                <div
                  key={t.out}
                  className="flex items-center gap-3 py-2 border-b border-surface-800/60 last:border-0"
                >
                  <div className="flex-1 flex items-center gap-2">
                    <TeamBadge team={out.team} size="sm" />
                    <span
                      className="text-sm text-danger-400 line-through cursor-pointer hover:text-danger-300 transition-colors"
                      onClick={() => navigate(`/player/${out.element}`)}
                    >
                      {out.web_name}
                    </span>
                    <span className="text-surface-600">→</span>
                    <TeamBadge team={inP.team} size="sm" />
                    <span
                      className="text-sm text-success-400 font-medium cursor-pointer hover:text-success-300 transition-colors"
                      onClick={() => navigate(`/player/${inP.element}`)}
                    >
                      {inP.web_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-surface-400 font-data tabular-nums">
                      £{out.selling_price}m → £{inP.value}m
                    </span>
                    <span
                      className={`font-bold font-data tabular-nums ${
                        delta > 0 ? "text-success-400" : "text-danger-400"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(1)} pts
                    </span>
                  </div>
                  <button
                    onClick={() => removeTransfer(t.out)}
                    className="text-xs text-surface-500 hover:text-danger-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-800">
            <span className="text-sm text-surface-400">Net point gain</span>
            <span
              className={`text-sm font-bold font-data tabular-nums ${(() => {
                const gain =
                  transfers.reduce((s, t) => {
                    const out = mockMyTeam.find((p) => p.element === t.out);
                    const inP = mockTransferTargets.find((p) => p.element === t.in);
                    return (
                      s +
                      ((inP?.predicted.slice(0, horizon).reduce((a, b) => a + b, 0) || 0) -
                        (out?.predicted.slice(0, horizon).reduce((a, b) => a + b, 0) || 0))
                    );
                  }, 0) - hitCost;
                return gain > 0 ? "text-success-400" : "text-danger-400";
              })()}`}
            >
              {(() => {
                const gain =
                  transfers.reduce((s, t) => {
                    const out = mockMyTeam.find((p) => p.element === t.out);
                    const inP = mockTransferTargets.find((p) => p.element === t.in);
                    return (
                      s +
                      ((inP?.predicted.slice(0, horizon).reduce((a, b) => a + b, 0) || 0) -
                        (out?.predicted.slice(0, horizon).reduce((a, b) => a + b, 0) || 0))
                    );
                  }, 0) - hitCost;
                return `${gain > 0 ? "+" : ""}${gain.toFixed(1)} pts (after ${
                  hitCost > 0 ? `-${hitCost} hit` : "no hit"
                })`;
              })()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
