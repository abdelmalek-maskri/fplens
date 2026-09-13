import { useState, useEffect, useRef } from "react";
import { getPredictions, getModels } from "../lib/api";
import { DEFAULT_SHAP } from "../lib/constants";

export function usePredictions(modelId) {
  const [data, setData] = useState(null);
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    getModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Responses do not arrive in the order they were asked for. Switching models
    // quickly could let an earlier one land last and overwrite the current
    // selection, leaving the dropdown and the table disagreeing.
    cancelledRef.current = false;
    setIsLoading(true);
    setError(null);

    getPredictions(modelId)
      .then((predictions) => {
        if (cancelledRef.current) return;
        setData({
          predictions,
          localShap: {},
          defaultShap: DEFAULT_SHAP,
        });
      })
      .catch((err) => {
        if (!cancelledRef.current) setError(err);
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false);
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [modelId]);

  return { data, models, isLoading, error };
}
