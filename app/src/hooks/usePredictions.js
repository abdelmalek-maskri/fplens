import { useState, useEffect } from "react";
import { getPredictions, getModels } from "../lib/api";
import { DEFAULT_SHAP } from "../lib/constants";

export function usePredictions(modelId) {
  const [data, setData] = useState(null);
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load available models once
  useEffect(() => {
    getModels().then(setModels).catch(() => {});
  }, []);

  // Load predictions (re-fetch when modelId changes)
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    getPredictions(modelId)
      .then((predictions) => {
        setData({
          predictions,
          localShap: {},
          defaultShap: DEFAULT_SHAP,
        });
      })
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [modelId]);

  return { data, models, isLoading, error };
}
