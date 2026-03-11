import { useState, useEffect } from "react";
import { getPredictions } from "../lib/api";

export function usePlayerPool() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
