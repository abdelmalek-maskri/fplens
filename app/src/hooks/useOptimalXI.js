import { useState, useEffect } from "react";
import { getBestSquad, getPredictions } from "../lib/api";
import { FPL_BUDGET, POS_LIMITS, MAX_PER_TEAM } from "../lib/constants";

export function useOptimalXI() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setIsLoading(true);
    setError(null);

    Promise.allSettled([getBestSquad(), getPredictions()])
      .then(([squadSettled, predictionsSettled]) => {
        if (cancelled) return;

        const squad = squadSettled.status === "fulfilled" ? squadSettled.value : null;
        const preds = predictionsSettled.status === "fulfilled" ? predictionsSettled.value : null;

        if (!squad && !preds) {
          setError(new Error("Failed to load season planner data."));
          return;
        }

        const res = { budget: FPL_BUDGET, posLimits: POS_LIMITS, maxPerTeam: MAX_PER_TEAM };

        if (squad) {
          const xi = squad.best_xi || {};
          res.recommended = {
            squad: squad.squad || [],
            totalValue: squad.total_value,
            totalPoints: squad.total_points,
            budgetRemaining: squad.budget_remaining,
            starters: xi.starters || [],
            bench: xi.bench || [],
            captainId: xi.captain_id,
            viceId: xi.vice_id,
            formation: xi.formation,
            totalWithCaptain: xi.total_with_captain,
          };
        }

        if (preds) {
          res.playerPool = preds.map((p) => ({
            ...p,
            team: p.team_name,
            predicted_1gw: p.predicted_points,
            ownership: p.selected_by_percent || 0,
          }));
        }

        setData(res);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
