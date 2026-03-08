import { useState, useEffect } from "react";
import { getBestXI } from "../lib/api";
import { mockSquad, FORMATIONS } from "../mocks/squad";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = { squad: mockSquad, formations: FORMATIONS };

export function useSquad() {
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USE_MOCKS) return;

    getBestXI()
      .then((result) => {
        setData({
          squad: [...(result.starters || []), ...(result.bench || [])],
          formations: FORMATIONS,
        });
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
