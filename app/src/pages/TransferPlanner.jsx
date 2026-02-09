import { useState, useMemo } from "react";
import { FDR_COLORS, POSITION_COLORS } from "../lib/constants";
import MiniSparkline from "../components/MiniSparkline";

// ============================================================
// MOCK DATA - Transfer planner
// Will be replaced with: GET /api/transfers/plan + GET /api/predictions/multi-gw
// ============================================================
const mockMyTeam = [
  { element: 20, web_name: "Raya", team: "ARS", position: "GK", value: 5.5, predicted: [4.2, 3.8, 4.5], form: 4.8, fdr: [4, 2, 3], pts_last5: [6, 2, 6, 1, 6] },
  { element: 15, web_name: "Alexander-Arnold", team: "LIV", position: "DEF", value: 7.1, predicted: [5.4, 4.8, 5.1], form: 6.1, fdr: [2, 3, 2], pts_last5: [2, 9, 6, 1, 8] },
  { element: 12, web_name: "Gabriel", team: "ARS", position: "DEF", value: 6.2, predicted: [5.1, 4.2, 4.8], form: 5.8, fdr: [4, 2, 3], pts_last5: [6, 2, 8, 6, 6] },
  { element: 25, web_name: "Saliba", team: "ARS", position: "DEF", value: 5.8, predicted: [4.8, 4.0, 4.5], form: 5.5, fdr: [4, 2, 3], pts_last5: [6, 1, 6, 2, 6] },
  { element: 3, web_name: "Salah", team: "LIV", position: "MID", value: 13.2, predicted: [6.8, 5.5, 6.2], form: 7.2, fdr: [2, 3, 2], pts_last5: [12, 3, 8, 5, 15] },
  { element: 7, web_name: "Palmer", team: "CHE", position: "MID", value: 9.5, predicted: [6.1, 5.8, 4.2], form: 9.2, fdr: [5, 2, 3], pts_last5: [5, 13, 2, 10, 8] },
  { element: 5, web_name: "Saka", team: "ARS", position: "MID", value: 10.1, predicted: [4.2, 5.8, 5.5], form: 6.5, fdr: [4, 2, 3], pts_last5: [8, 2, 6, 3, 9] },
  { element: 40, web_name: "Mbeumo", team: "BRE", position: "MID", value: 7.8, predicted: [4.5, 3.8, 5.2], form: 5.6, fdr: [2, 3, 2], pts_last5: [3, 7, 2, 5, 6] },
  { element: 2, web_name: "Haaland", team: "MCI", position: "FWD", value: 15.3, predicted: [7.2, 5.8, 6.5], form: 8.8, fdr: [2, 4, 2], pts_last5: [13, 2, 9, 5, 12] },
  { element: 50, web_name: "Isak", team: "NEW", position: "FWD", value: 8.8, predicted: [5.5, 6.2, 5.0], form: 7.0, fdr: [2, 3, 4], pts_last5: [8, 5, 2, 10, 6] },
  { element: 10, web_name: "Watkins", team: "AVL", position: "FWD", value: 9.0, predicted: [1.8, 0.0, 3.5], form: 5.4, fdr: [2, 3, 2], pts_last5: [2, 6, 3, 2, 5] },
];

const mockTransferTargets = [
  { element: 60, web_name: "Cunha", team: "WOL", position: "FWD", value: 7.2, predicted: [5.8, 5.2, 4.5], form: 7.5, fdr: [3, 2, 2], price_trend: "rise", pts_last5: [9, 2, 7, 5, 8] },
  { element: 61, web_name: "Solanke", team: "TOT", position: "FWD", value: 7.5, predicted: [5.0, 5.5, 6.0], form: 6.2, fdr: [2, 3, 2], price_trend: "stable", pts_last5: [5, 3, 6, 2, 7] },
  { element: 62, web_name: "Gordon", team: "NEW", position: "MID", value: 7.5, predicted: [5.2, 5.8, 4.8], form: 6.8, fdr: [2, 3, 4], price_trend: "rise", pts_last5: [6, 8, 2, 5, 7] },
  { element: 63, web_name: "Gross", team: "BHA", position: "MID", value: 6.2, predicted: [4.5, 4.8, 5.0], form: 5.5, fdr: [2, 2, 3], price_trend: "stable", pts_last5: [3, 5, 4, 6, 3] },
  { element: 64, web_name: "Wood", team: "NFO", position: "FWD", value: 6.5, predicted: [4.8, 4.2, 5.5], form: 6.0, fdr: [2, 4, 2], price_trend: "stable", pts_last5: [7, 2, 5, 8, 3] },
  { element: 65, web_name: "Eze", team: "CRY", position: "MID", value: 6.8, predicted: [4.2, 5.0, 5.5], form: 5.8, fdr: [3, 2, 2], price_trend: "rise", pts_last5: [4, 6, 2, 8, 5] },
  { element: 66, web_name: "Schär", team: "NEW", position: "DEF", value: 5.2, predicted: [4.5, 4.0, 3.8], form: 5.2, fdr: [2, 3, 4], price_trend: "stable", pts_last5: [6, 1, 2, 6, 2] },
  { element: 67, web_name: "Flekken", team: "BRE", position: "GK", value: 4.5, predicted: [3.8, 3.5, 4.2], form: 4.5, fdr: [2, 3, 2], price_trend: "stable", pts_last5: [3, 6, 1, 3, 6] },
];

const GW_LABELS = ["GW24", "GW25", "GW26"];


// ============================================================
// MAIN COMPONENT
// ============================================================
export default function TransferPlanner() {
  const [horizon, setHorizon] = useState(3); // 1, 2, or 3 GWs
  const [transfers, setTransfers] = useState([]); // [{out: elementId, in: elementId}]
  const [freeTransfers, setFreeTransfers] = useState(1);
  const [showTargets, setShowTargets] = useState(false);
  const [transferOutId, setTransferOutId] = useState(null);

  const budget = useMemo(() => {
    const spent = mockMyTeam.reduce((s, p) => s + p.value, 0);
    const base = 100.0;
    const remaining = base - spent;
    const transferSavings = transfers.reduce((s, t) => {
      const out = mockMyTeam.find(p => p.element === t.out);
      const inP = mockTransferTargets.find(p => p.element === t.in);
      return s + ((out?.value || 0) - (inP?.value || 0));
    }, 0);
    return (remaining + transferSavings).toFixed(1);
  }, [transfers]);

  const hitCost = Math.max(0, (transfers.length - freeTransfers)) * 4;

  const currentTeam = useMemo(() => {
    return mockMyTeam.map(p => {
      const transfer = transfers.find(t => t.out === p.element);
      if (transfer) {
        const replacement = mockTransferTargets.find(t => t.element === transfer.in);
        return { ...replacement, isTransferIn: true };
      }
      return p;
    });
  }, [transfers]);

  const teamPredicted = useMemo(() => {
    return GW_LABELS.slice(0, horizon).map((_, gwIdx) => {
      return currentTeam.reduce((sum, p) => sum + (p.predicted[gwIdx] || 0), 0);
    });
  }, [currentTeam, horizon]);

  const totalPredicted = teamPredicted.reduce((s, v) => s + v, 0) - hitCost;

  const handleTransferOut = (elementId) => {
    setTransferOutId(elementId);
    setShowTargets(true);
  };

  const handleTransferIn = (targetId) => {
    setTransfers(prev => [...prev, { out: transferOutId, in: targetId }]);
    setShowTargets(false);
    setTransferOutId(null);
  };

  const removeTransfer = (outId) => {
    setTransfers(prev => prev.filter(t => t.out !== outId));
  };

  const resetAll = () => {
    setTransfers([]);
    setShowTargets(false);
    setTransferOutId(null);
  };

  const outPlayer = transferOutId ? mockMyTeam.find(p => p.element === transferOutId) : null;
  const availableTargets = mockTransferTargets.filter(t =>
    !transfers.some(tr => tr.in === t.element) &&
    (outPlayer ? t.position === outPlayer.position : true)
  );

  return (
    <div className="space-y-6 stagger">
      {/* Controls */}
      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 uppercase tracking-wide">Horizon</span>
          {[1, 2, 3].map(h => (
            <button key={h} onClick={() => setHorizon(h)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                horizon === h ? "bg-brand-600 text-white" : "bg-surface-800 text-surface-400"
              }`}>
              {h} GW{h > 1 ? "s" : ""}
            </button>
          ))}
        </div>
        <button onClick={resetAll} className="btn-ghost text-xs">Reset</button>
      </div>

      {/* Summary Strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 uppercase">FTs</span>
          <select value={freeTransfers} onChange={e => setFreeTransfers(Number(e.target.value))}
            className="bg-surface-900 border border-surface-700 rounded px-2 py-1 text-lg font-bold text-surface-100 focus:border-brand-500 focus:outline-none cursor-pointer">
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={5}>Wildcard</option>
          </select>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-surface-100 font-data tabular-nums">{transfers.length}</span>
          <span className="text-xs text-surface-500 ml-1.5">made</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className={`text-xl font-bold font-data tabular-nums ${hitCost > 0 ? "text-danger-400" : "text-success-400"}`}>
            {hitCost > 0 ? `-${hitCost}` : "0"}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">hit</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className={`text-xl font-bold font-data tabular-nums ${Number(budget) >= 0 ? "text-surface-100" : "text-danger-400"}`}>
            £{budget}m
          </span>
          <span className="text-xs text-surface-500 ml-1.5">ITB</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-brand-400 font-data tabular-nums">{totalPredicted.toFixed(1)}</span>
          <span className="text-xs text-surface-500 ml-1.5">net pts ({horizon} GW)</span>
          {hitCost > 0 && <span className="text-2xs text-surface-500 ml-1">after hit</span>}
        </div>
      </div>

      {/* GW Prediction Breakdown */}
      <div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-surface-500 uppercase tracking-wide">Predicted by GW:</span>
          {teamPredicted.map((pts, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-surface-400">{GW_LABELS[i]}</span>
              <span className="text-sm font-bold text-surface-100">{pts.toFixed(1)}</span>
            </div>
          ))}
          {hitCost > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-danger-400">Hit: -{hitCost}</span>
            </div>
          )}
        </div>
      </div>

      {/* Team Table */}
      <div className="overflow-y-hidden overflow-x-auto border-t border-surface-800">
        <table className="w-full">
          <thead className="bg-surface-800/50">
            <tr>
              <th className="table-header text-left py-2.5 px-3">Player</th>
              <th className="table-header text-left py-2.5 px-3">Pos</th>
              <th className="table-header text-left py-2.5 px-3">Price</th>
              <th className="table-header text-left py-2.5 px-3">Form</th>
              {GW_LABELS.slice(0, horizon).map(gw => (
                <th key={gw} className="table-header text-center py-2.5 px-3">{gw}</th>
              ))}
              <th className="table-header text-center py-2.5 px-3">Total</th>
              <th className="table-header text-center py-2.5 px-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {currentTeam.map((p) => {
              const sum = p.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
              const isOut = transfers.some(t => t.out === p.element);
              const isNew = p.isTransferIn;
              return (
                <tr key={p.element} className={`border-t border-surface-800 ${
                  isNew ? "bg-success-500/5" : ""
                }`}>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      {isNew && <span className="w-1.5 h-1.5 rounded-full bg-success-400" />}
                      <div>
                        <p className={`text-sm font-medium ${isNew ? "text-success-400" : "text-surface-100"}`}>
                          {p.web_name}
                        </p>
                        <p className="text-2xs text-surface-500">{p.team}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-2xs font-medium ${POSITION_COLORS[p.position]}`}>{p.position}</span>
                  </td>
                  <td className="py-2.5 px-3 text-surface-100 font-data tabular-nums">£{p.value}m</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-surface-300">{p.form}</span>
                      <MiniSparkline pts={p.pts_last5} />
                    </div>
                  </td>
                  {p.predicted.slice(0, horizon).map((pts, gwIdx) => (
                    <td key={gwIdx} className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-sm font-bold ${pts >= 5 ? "text-brand-400" : pts >= 3 ? "text-surface-100" : "text-surface-500"}`}>
                          {pts.toFixed(1)}
                        </span>
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-bold ${FDR_COLORS[p.fdr[gwIdx]].bg} ${FDR_COLORS[p.fdr[gwIdx]].text}`}>
                          {p.fdr[gwIdx]}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-sm font-bold text-surface-100">{sum.toFixed(1)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {isNew ? (
                      <button onClick={() => removeTransfer(transfers.find(t => t.in === p.element)?.out)}
                        className="text-xs text-danger-400 hover:text-danger-300 transition-colors">
                        Undo
                      </button>
                    ) : !isOut ? (
                      <button onClick={() => handleTransferOut(p.element)}
                        className="text-xs text-warning-400 hover:text-warning-300 transition-colors">
                        Transfer Out
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Transfer Target Selector */}
      {showTargets && outPlayer && (
        <div className="card p-5 border-brand-500/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-100">
                Replace {outPlayer.web_name} ({outPlayer.position})
              </h3>
              <p className="text-xs text-surface-500">
                Budget: £{(Number(budget) + outPlayer.value).toFixed(1)}m available for this slot
              </p>
            </div>
            <button onClick={() => { setShowTargets(false); setTransferOutId(null); }}
              className="btn-ghost text-xs">Cancel</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableTargets.map(t => {
              const sum = t.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
              const outSum = outPlayer.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
              const gain = sum - outSum;
              return (
                <div key={t.element}
                  onClick={() => handleTransferIn(t.element)}
                  className="rounded-lg border border-surface-700 bg-surface-800/30 p-3 cursor-pointer hover:border-brand-500/40 hover:bg-brand-500/5 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium text-surface-100">{t.web_name}</p>
                        <p className="text-2xs text-surface-500">{t.team} · {t.position} · £{t.value}m</p>
                      </div>
                      <MiniSparkline pts={t.pts_last5} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-surface-100">{sum.toFixed(1)} pts</p>
                      <p className={`text-xs font-medium ${gain > 0 ? "text-success-400" : "text-danger-400"}`}>
                        {gain > 0 ? "+" : ""}{gain.toFixed(1)} vs {outPlayer.web_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {t.predicted.slice(0, horizon).map((pts, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-bold ${FDR_COLORS[t.fdr[i]].bg} ${FDR_COLORS[t.fdr[i]].text}`}>
                          {t.fdr[i]}
                        </span>
                        <span className="text-xs text-surface-300">{pts.toFixed(1)}</span>
                      </div>
                    ))}
                    {t.price_trend === "rise" && (
                      <span className="badge bg-success-500/15 text-success-400 text-2xs ml-auto">Price Rising</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transfer Impact Summary */}
      {transfers.length > 0 && (
        <div className="mt-8">
          <div className="space-y-2">
            {transfers.map(t => {
              const out = mockMyTeam.find(p => p.element === t.out);
              const inP = mockTransferTargets.find(p => p.element === t.in);
              if (!out || !inP) return null;
              const outSum = out.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
              const inSum = inP.predicted.slice(0, horizon).reduce((s, v) => s + v, 0);
              const delta = inSum - outSum;
              return (
                <div key={t.out} className="flex items-center gap-3 py-2 border-b border-surface-800 last:border-0">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm text-danger-400 line-through">{out.web_name}</span>
                    <span className="text-surface-500">→</span>
                    <span className="text-sm text-success-400 font-medium">{inP.web_name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-surface-400">£{out.value}m → £{inP.value}m</span>
                    <span className={`font-bold ${delta > 0 ? "text-success-400" : "text-danger-400"}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)} pts ({horizon} GW)
                    </span>
                  </div>
                  <button onClick={() => removeTransfer(t.out)} className="text-xs text-surface-500 hover:text-danger-400">
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-800">
            <span className="text-sm text-surface-400">Net point gain</span>
            <span className={`text-sm font-bold ${
              transfers.reduce((s, t) => {
                const out = mockMyTeam.find(p => p.element === t.out);
                const inP = mockTransferTargets.find(p => p.element === t.in);
                return s + ((inP?.predicted.slice(0, horizon).reduce((a, b) => a + b, 0) || 0) -
                  (out?.predicted.slice(0, horizon).reduce((a, b) => a + b, 0) || 0));
              }, 0) - hitCost > 0 ? "text-success-400" : "text-danger-400"
            }`}>
              {(() => {
                const gain = transfers.reduce((s, t) => {
                  const out = mockMyTeam.find(p => p.element === t.out);
                  const inP = mockTransferTargets.find(p => p.element === t.in);
                  return s + ((inP?.predicted.slice(0, horizon).reduce((a, b) => a + b, 0) || 0) -
                    (out?.predicted.slice(0, horizon).reduce((a, b) => a + b, 0) || 0));
                }, 0) - hitCost;
                return `${gain > 0 ? "+" : ""}${gain.toFixed(1)} pts (after ${hitCost > 0 ? `-${hitCost} hit` : "no hit"})`;
              })()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
