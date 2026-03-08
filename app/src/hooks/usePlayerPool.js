import { useState, useEffect } from "react";
import { getPredictions } from "../lib/api";
import { allPlayers, STATUS_CONFIG } from "../mocks/playerComparison";

export { STATUS_CONFIG };

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = { players: allPlayers };

export function usePlayerPool() {
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USE_MOCKS) return;

    getPredictions()
      .then((predictions) => {
        setData({
          players: predictions.map((p) => ({
            ...p,
            id: p.element,
            team: p.team_name,
          })),
        });
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
