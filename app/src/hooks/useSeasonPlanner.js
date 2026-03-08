import { useState, useEffect, useRef } from "react";
import { getBestSquad, getPredictions } from "../lib/api";
import { playerPool, BUDGET, POS_LIMITS, MAX_PER_TEAM } from "../mocks/seasonPlanner";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

// Build mock recommended squad from player pool (greedy pick by predicted_6gw)
const _buildMockRecommended = () => {
  const byPos = { GK: [], DEF: [], MID: [], FWD: [] };
  [...playerPool]
    .sort((a, b) => b.predicted_6gw - a.predicted_6gw)
    .forEach((p) => byPos[p.position].push(p));
  const squad = [
    ...byPos.GK.slice(0, POS_LIMITS.GK),
    ...byPos.DEF.slice(0, POS_LIMITS.DEF),
    ...byPos.MID.slice(0, POS_LIMITS.MID),
    ...byPos.FWD.slice(0, POS_LIMITS.FWD),
  ];
  const totalValue = squad.reduce((s, p) => s + p.value, 0);
  // Best XI: 4-4-2 from the 15
  const gks = squad
    .filter((p) => p.position === "GK")
    .sort((a, b) => b.predicted_1gw - a.predicted_1gw);
  const defs = squad
    .filter((p) => p.position === "DEF")
    .sort((a, b) => b.predicted_1gw - a.predicted_1gw);
  const mids = squad
    .filter((p) => p.position === "MID")
    .sort((a, b) => b.predicted_1gw - a.predicted_1gw);
  const fwds = squad
    .filter((p) => p.position === "FWD")
    .sort((a, b) => b.predicted_1gw - a.predicted_1gw);
  const starters = [gks[0], ...defs.slice(0, 4), ...mids.slice(0, 4), ...fwds.slice(0, 2)];
  const starterIds = new Set(starters.map((p) => p.element));
  const bench = squad.filter((p) => !starterIds.has(p.element));
  const sorted = [...starters].sort((a, b) => b.predicted_1gw - a.predicted_1gw);
  const totalPoints = starters.reduce((s, p) => s + p.predicted_1gw, 0);
  return {
    squad,
    totalValue,
    totalPoints,
    budgetRemaining: BUDGET - totalValue,
    starters,
    bench,
    captainId: sorted[0].element,
    viceId: sorted[1].element,
    formation: "4-4-2",
    totalWithCaptain: totalPoints + sorted[0].predicted_1gw,
  };
};

const _mockData = {
  recommended: _buildMockRecommended(),
  playerPool,
  budget: BUDGET,
  posLimits: POS_LIMITS,
  maxPerTeam: MAX_PER_TEAM,
};

export function useSeasonPlanner(budget = 100) {
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (USE_MOCKS) return;

    cancelledRef.current = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    Promise.allSettled([getBestSquad(budget), getPredictions()])
      .then(([squadSettled, predictionsSettled]) => {
        if (cancelledRef.current) return;

        const squadResult = squadSettled.status === "fulfilled" ? squadSettled.value : null;
        const predictions =
          predictionsSettled.status === "fulfilled" ? predictionsSettled.value : null;

        if (!squadResult && !predictions) {
          setError(new Error("Failed to load season planner data."));
          return;
        }

        const result = { budget, posLimits: POS_LIMITS, maxPerTeam: MAX_PER_TEAM };

        if (squadResult) {
          const xi = squadResult.best_xi || {};
          result.recommended = {
            squad: squadResult.squad || [],
            totalValue: squadResult.total_value,
            totalPoints: squadResult.total_points,
            budgetRemaining: squadResult.budget_remaining,
            starters: xi.starters || [],
            bench: xi.bench || [],
            captainId: xi.captain_id,
            viceId: xi.vice_id,
            formation: xi.formation,
            totalWithCaptain: xi.total_with_captain,
          };
        }

        if (predictions) {
          result.playerPool = predictions.map((p) => ({
            ...p,
            team: p.team_name,
            predicted_1gw: p.predicted_points,
            predicted_6gw: p.predicted_points * 6,
            ownership: p.selected_by_percent || 0,
          }));
        }

        setData(result);
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false);
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [budget]);

  return { data, isLoading, error };
}
