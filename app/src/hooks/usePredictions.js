import { useState, useEffect } from "react";
import { getPredictions } from "../lib/api";
import { MODEL_OPTIONS, DEFAULT_SHAP } from "../lib/constants";

export function usePredictions() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPredictions()
      .then((predictions) => {
        setData({
          predictions,
          localShap: {}, // populated when per-player SHAP API is wired
          defaultShap: DEFAULT_SHAP,
          modelOptions: MODEL_OPTIONS,
        });
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
