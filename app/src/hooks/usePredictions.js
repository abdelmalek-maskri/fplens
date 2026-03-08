import { useState, useEffect } from "react";
import { getPredictions } from "../lib/api";
import { mockPredictions, mockLocalShap, defaultShap, MODEL_OPTIONS } from "../mocks/predictions";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const _mockData = {
  predictions: mockPredictions,
  localShap: mockLocalShap,
  defaultShap,
  modelOptions: MODEL_OPTIONS,
};

export function usePredictions() {
  const [data, setData] = useState(USE_MOCKS ? _mockData : null);
  const [isLoading, setIsLoading] = useState(!USE_MOCKS);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (USE_MOCKS) return;

    getPredictions()
      .then((predictions) => {
        setData({
          predictions,
          localShap: mockLocalShap,
          defaultShap,
          modelOptions: MODEL_OPTIONS,
        });
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
