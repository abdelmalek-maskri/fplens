import { useState, useEffect } from "react";
import { getBestSquad } from "../lib/api";
import { playerPool, BUDGET, POS_LIMITS, MAX_PER_TEAM } from "../mocks/seasonPlanner";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = { playerPool, budget: BUDGET, posLimits: POS_LIMITS, maxPerTeam: MAX_PER_TEAM };

export function useSeasonPlanner(budget = 100) {
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USE_MOCKS) return;

    setData(null);
    setIsLoading(true);
    setError(null);

    getBestSquad(budget)
      .then((result) => {
        setData({
          playerPool: result.squad || result,
          budget: result.budget || budget,
          posLimits: result.pos_limits || POS_LIMITS,
          maxPerTeam: result.max_per_team || MAX_PER_TEAM,
        });
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [budget]);

  return { data, isLoading, error };
}
