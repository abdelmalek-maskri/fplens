import { useState, useEffect, useRef } from "react";
import { getBestSquad, getPredictions } from "../lib/api";
import { playerPool, BUDGET, POS_LIMITS, MAX_PER_TEAM } from "../mocks/seasonPlanner";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = { playerPool, budget: BUDGET, posLimits: POS_LIMITS, maxPerTeam: MAX_PER_TEAM };

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

    Promise.all([getBestSquad(budget), getPredictions()])
      .then(([squadResult, predictions]) => {
        if (cancelledRef.current) return;
        const xi = squadResult.best_xi || {};
        setData({
          recommended: {
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
          },
          playerPool: predictions.map((p) => ({
            ...p,
            team: p.team_name,
            predicted_1gw: p.predicted_points,
            predicted_6gw: p.predicted_points * 6,
            ownership: p.selected_by_percent || 0,
          })),
          budget: budget,
          posLimits: POS_LIMITS,
          maxPerTeam: MAX_PER_TEAM,
        });
      })
      .catch((err) => {
        if (!cancelledRef.current) setError(err);
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
