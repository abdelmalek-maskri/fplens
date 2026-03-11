import { useState, useEffect, useRef } from "react";
import { getBestSquad, getPredictions } from "../lib/api";
import { POS_LIMITS, MAX_PER_TEAM } from "../lib/constants";

export function useSeasonPlanner(budget = 100) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
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
