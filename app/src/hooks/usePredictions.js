import { useState, useEffect } from "react";
import { getPredictions, getModels } from "../lib/api";
import { DEFAULT_SHAP } from "../lib/constants";

export function usePredictions(modelId) {
  const [data, setData] = useState(null);
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Local to this run, not a ref. A shared ref does not work here: the cleanup
    // sets it true, but the next effect immediately sets it back to false, so a
    // slow earlier response still passes the check and overwrites the newer one.
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getPredictions(modelId)
      .then((predictions) => {
        if (cancelled) return;
        setData({
          predictions,
          localShap: {},
          defaultShap: DEFAULT_SHAP,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelId]);

  return { data, models, isLoading, error };
}
